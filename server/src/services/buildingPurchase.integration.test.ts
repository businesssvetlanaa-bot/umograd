import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, rm } from 'node:fs/promises'
import { randomUUID } from 'node:crypto'
import { tmpdir } from 'node:os'
import path from 'node:path'
import type { AddressInfo } from 'node:net'

type ApiResult = { status: number; body: Record<string, unknown>; retryAfter: string | null }

test('building purchase is atomic, idempotent and ownership-safe on disposable SQLite', async () => {
  const tempDb = path.join(tmpdir(), `umograd-building-${randomUUID()}.db`)
  await copyFile(path.resolve('prisma/dev.db'), tempDb)
  process.env.DATABASE_URL = `file:${tempDb.replace(/\\/gu, '/')}`
  process.env.JWT_SECRET = 'building-purchase-test-secret-value-2026'

  const [{ default: express }, { default: authRouter }, { default: childrenRouter }, { prisma }] = await Promise.all([
    import('express'),
    import('../routes/auth'),
    import('../routes/children'),
    import('../lib/prisma'),
  ])
  const app = express()
  app.use(express.json())
  app.use('/api/auth', authRouter)
  app.use('/api/children', childrenRouter)
  const server = app.listen(0, '127.0.0.1')
  await new Promise<void>((resolve) => server.once('listening', resolve))
  const port = (server.address() as AddressInfo).port

  async function api(
    pathname: string,
    options: { method?: string; token?: string; body?: Record<string, unknown> } = {},
  ): Promise<ApiResult> {
    const response = await fetch(`http://127.0.0.1:${port}/api${pathname}`, {
      method: options.method ?? 'GET',
      headers: {
        ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
    })
    return {
      status: response.status,
      body: await response.json() as Record<string, unknown>,
      retryAfter: response.headers.get('retry-after'),
    }
  }

  async function register(label: string) {
    const result = await api('/auth/register', {
      method: 'POST',
      body: { name: label, email: `${label}-${randomUUID()}@example.test`, password: 'password-1' },
    })
    assert.equal(result.status, 201)
    return { token: result.body.token as string, user: result.body.user as { id: string } }
  }

  async function createChild(token: string, name: string) {
    const result = await api('/children', {
      method: 'POST', token,
      body: { name, grade: 4, avatar_type: 'explorer', avatar_color: 'blue' },
    })
    assert.equal(result.status, 201)
    return result.body as unknown as { id: string }
  }

  function place(token: string, childId: string, buildingType: string, x = 120, y = 120) {
    return api(`/children/${childId}/buildings`, {
      method: 'POST', token,
      body: { building_type: buildingType, position_x: x, position_y: y },
    })
  }

  async function unlockFirstTier(childId: string, coins: number) {
    await prisma.child.update({ where: { id: childId }, data: { coins } })
    await prisma.session.create({ data: { child_id: childId, subject: 'math', completed: true } })
  }

  try {
    const family = await register('building-family')
    const other = await register('building-other')

    const paidChild = await createChild(family.token, 'Paid')
    await unlockFirstTier(paidChild.id, 100)
    const parallel = await Promise.all(Array.from({ length: 6 }, (_, index) =>
      place(family.token, paidChild.id, 'campfire', 120 + index, 140 + index),
    ))
    assert.deepEqual(parallel.map((result) => result.status).sort(), [200, 200, 200, 200, 200, 201])
    assert.equal(parallel.filter((result) => result.body.purchased_now === true).length, 1)
    assert.equal(parallel.filter((result) => result.body.purchased_now === false).length, 5)
    for (const result of parallel) {
      assert.deepEqual(Object.keys(result.body).sort(), ['building', 'coins', 'purchased_now', 'success'])
      assert.deepEqual(Object.keys(result.body.building as object).sort(), [
        'building_type', 'id', 'placed', 'position_x', 'position_y',
      ])
    }
    assert.equal(await prisma.building.count({ where: { child_id: paidChild.id, building_type: 'campfire' } }), 1)
    assert.equal((await prisma.child.findUniqueOrThrow({ where: { id: paidChild.id } })).coins, 80)

    const replay = await place(family.token, paidChild.id, 'campfire', 300, 220)
    assert.equal(replay.status, 200)
    assert.equal(replay.body.purchased_now, false)
    assert.equal(replay.body.coins, 80)
    assert.equal((replay.body.building as Record<string, unknown>).position_x, 300)

    const poorChild = await createChild(family.token, 'Poor')
    await unlockFirstTier(poorChild.id, 30)
    const competing = await Promise.all([
      place(family.token, poorChild.id, 'campfire'),
      place(family.token, poorChild.id, 'tree'),
    ])
    assert.deepEqual(competing.map((result) => result.status).sort(), [201, 400])
    const poorAfter = await prisma.child.findUniqueOrThrow({ where: { id: poorChild.id } })
    assert.ok(poorAfter.coins >= 0)
    assert.equal(await prisma.building.count({
      where: { child_id: poorChild.id, building_type: { in: ['campfire', 'tree'] } },
    }), 1)

    const starterChild = await createChild(family.token, 'Starter')
    await prisma.building.deleteMany({ where: { child_id: starterChild.id, building_type: 'house' } })
    await prisma.child.update({ where: { id: starterChild.id }, data: { coins: 0 } })
    const starterParallel = await Promise.all(Array.from({ length: 4 }, () =>
      place(family.token, starterChild.id, 'house'),
    ))
    assert.deepEqual(starterParallel.map((result) => result.status).sort(), [200, 200, 200, 201])
    assert.equal(starterParallel.filter((result) => result.body.purchased_now === true).length, 1)
    assert.equal(await prisma.building.count({ where: { child_id: starterChild.id, building_type: 'house' } }), 1)
    assert.equal((await prisma.child.findUniqueOrThrow({ where: { id: starterChild.id } })).coins, 0)

    const lockedChild = await createChild(family.token, 'Locked')
    const lockedBefore = await prisma.child.findUniqueOrThrow({ where: { id: lockedChild.id } })
    assert.equal((await place(family.token, lockedChild.id, 'tree')).status, 400)
    assert.equal((await place(family.token, lockedChild.id, 'unknown')).status, 400)
    assert.equal((await place(family.token, lockedChild.id, 'house', 59, 120)).status, 400)
    assert.equal((await prisma.child.findUniqueOrThrow({ where: { id: lockedChild.id } })).coins, lockedBefore.coins)
    assert.equal(await prisma.building.count({ where: { child_id: lockedChild.id } }), 1)

    const otherChild = await createChild(other.token, 'Other')
    assert.equal((await place(family.token, otherChild.id, 'house')).status, 403)
    await api(`/children/${paidChild.id}/pin`, { method: 'PUT', token: family.token, body: { pin: '2468' } })
    const childLogin = await api('/auth/child-login', {
      method: 'POST', body: { child_id: paidChild.id, pin: '2468' },
    })
    assert.equal(childLogin.status, 200)
    assert.equal((await place(childLogin.body.token as string, otherChild.id, 'house')).status, 403)

    const legacyChild = await createChild(family.token, 'Legacy')
    const early = await prisma.building.create({
      data: { id: `a-${randomUUID()}`, child_id: legacyChild.id, building_type: 'tree', purchased_at: new Date(1000) },
    })
    const late = await prisma.building.create({
      data: { id: `z-${randomUUID()}`, child_id: legacyChild.id, building_type: 'tree', purchased_at: new Date(2000) },
    })
    const legacyMove = await place(family.token, legacyChild.id, 'tree', 333, 222)
    assert.equal(legacyMove.status, 200)
    assert.equal((legacyMove.body.building as Record<string, unknown>).id, early.id)
    assert.equal(await prisma.building.count({ where: { child_id: legacyChild.id, building_type: 'tree' } }), 2)
    assert.equal((await prisma.building.findUniqueOrThrow({ where: { id: late.id } })).position_x, null)

    const rollbackChild = await createChild(family.token, 'Rollback')
    await unlockFirstTier(rollbackChild.id, 100)
    await prisma.$executeRawUnsafe(`CREATE TRIGGER reject_campfire BEFORE INSERT ON buildings
      WHEN NEW.child_id = '${rollbackChild.id.replace(/'/gu, "''")}' AND NEW.building_type = 'campfire'
      BEGIN SELECT RAISE(ABORT, 'forced test failure'); END`)
    const rollback = await place(family.token, rollbackChild.id, 'campfire')
    assert.equal(rollback.status, 500)
    assert.deepEqual(rollback.body, { error: 'Ошибка сервера' })
    assert.equal((await prisma.child.findUniqueOrThrow({ where: { id: rollbackChild.id } })).coins, 100)
    assert.equal(await prisma.building.count({ where: { child_id: rollbackChild.id, building_type: 'campfire' } }), 0)
    await prisma.$executeRawUnsafe('DROP TRIGGER reject_campfire')

    const casChild = await createChild(family.token, 'CAS')
    await prisma.child.update({ where: { id: casChild.id }, data: { coins: 100 } })
    const stale = await prisma.child.findUniqueOrThrow({ where: { id: casChild.id } })
    await prisma.child.update({ where: { id: casChild.id }, data: { updated_at: new Date(stale.updated_at.getTime() + 1) } })
    const conflict = await prisma.child.updateMany({
      where: { id: casChild.id, coins: { gte: 20 }, updated_at: stale.updated_at },
      data: { coins: { decrement: 20 }, updated_at: new Date(stale.updated_at.getTime() + 2) },
    })
    assert.equal(conflict.count, 0)
    assert.equal((await prisma.child.findUniqueOrThrow({ where: { id: casChild.id } })).coins, 100)
  } finally {
    await prisma.$disconnect()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(tempDb, { force: true })
  }
})
