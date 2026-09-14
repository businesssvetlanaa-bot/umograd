import test from 'node:test'
import assert from 'node:assert/strict'
import { copyFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { randomUUID } from 'node:crypto'
import type { AddressInfo } from 'node:net'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'

type ApiResult = { status: number; body: Record<string, unknown>; retryAfter: string | null }

test('account lifecycle revokes tokens, enforces ownership and cascades only owned data', async () => {
  const tempDb = path.join(tmpdir(), `umograd-account-${randomUUID()}.db`)
  await copyFile(path.resolve('prisma/dev.db'), tempDb)
  process.env.DATABASE_URL = `file:${tempDb.replace(/\\/gu, '/')}`
  process.env.JWT_SECRET = 'account-lifecycle-test-secret-value-2026'

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

  async function register(suffix: string, password = 'password-1') {
    const result = await api('/auth/register', {
      method: 'POST',
      body: { name: suffix, email: `${suffix}-${randomUUID()}@example.test`, password },
    })
    assert.equal(result.status, 201)
    return { token: result.body.token as string, user: result.body.user as { id: string } }
  }

  async function createChild(token: string, name: string) {
    const result = await api('/children', {
      method: 'POST',
      token,
      body: { name, grade: 4, avatar_type: 'explorer', avatar_color: 'blue' },
    })
    assert.equal(result.status, 201)
    return result.body as unknown as { id: string; name: string }
  }

  try {
    const family = await register('family')
    const other = await register('other')
    const throttleFamily = await register('throttle')

    const legacyToken = jwt.sign({ id: family.user.id, role: 'parent' }, process.env.JWT_SECRET!, { expiresIn: '1h' })
    assert.equal((await api('/auth/me', { token: legacyToken })).status, 401)

    const changed = await api('/auth/password', {
      method: 'PUT', token: family.token,
      body: { current_password: 'password-1', new_password: 'password-2' },
    })
    assert.equal(changed.status, 200)
    assert.deepEqual(Object.keys(changed.body).sort(), ['success', 'token'])
    const currentToken = changed.body.token as string
    const changedUser = await prisma.user.findUniqueOrThrow({ where: { id: family.user.id } })
    assert.notEqual(changedUser.password, 'password-2')
    assert.equal(await bcrypt.compare('password-2', changedUser.password), true)
    assert.equal((await api('/auth/me', { token: family.token })).status, 401)
    assert.equal((await api('/auth/me', { token: currentToken })).status, 200)

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const wrong = await api('/auth/password', {
        method: 'PUT', token: throttleFamily.token,
        body: { current_password: 'wrong-password', new_password: 'new-password' },
      })
      assert.equal(wrong.status, 401)
    }
    const throttled = await api('/auth/account', {
      method: 'DELETE', token: throttleFamily.token,
      body: { current_password: 'password-1', confirmation: 'УДАЛИТЬ АККАУНТ' },
    })
    assert.equal(throttled.status, 429)
    assert.ok(Number(throttled.retryAfter) > 0)

    const child = await createChild(currentToken, 'Маша')
    const otherChild = await createChild(other.token, 'Петя')
    const topic = await prisma.topic.findFirstOrThrow()
    const globalTopicCount = await prisma.topic.count()
    const systemCurriculumCount = await prisma.curriculum.count({ where: { is_system: true } })
    const customCurriculum = await prisma.curriculum.create({
      data: { parent_id: family.user.id, name: 'Custom', grade: 4, subject: 'math', topics: [] },
    })
    const subjectProgress = await prisma.subjectProgress.upsert({
      where: { child_id_subject: { child_id: child.id, subject: 'math' } },
      create: { child_id: child.id, subject: 'math' }, update: {},
    })
    await prisma.topicProgress.create({ data: { subject_progress_id: subjectProgress.id, topic_id: topic.id } })
    const session = await prisma.session.create({ data: { child_id: child.id, subject: 'math', topic_id: topic.id } })
    await prisma.message.create({ data: { session_id: session.id, role: 'user', content: 'test' } })
    await prisma.voiceUsageEvent.create({ data: { session_id: session.id, kind: 'speech_input' } })
    if (await prisma.building.count({ where: { child_id: child.id } }) === 0) {
      await prisma.building.create({ data: { child_id: child.id, building_type: 'house' } })
    }
    await prisma.childTopicSetting.create({
      data: { child_id: child.id, curriculum_id: customCurriculum.id, topic_key: 'test', enabled: false },
    })

    await api(`/children/${child.id}/pin`, { method: 'PUT', token: currentToken, body: { pin: '2468' } })
    const childLogin = await api('/auth/child-login', { method: 'POST', body: { child_id: child.id, pin: '2468' } })
    assert.equal(childLogin.status, 200)
    const childToken = childLogin.body.token as string

    const foreign = await api(`/children/${otherChild.id}`, {
      method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ Петя' },
    })
    const missing = await api('/children/missing-child', {
      method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ Петя' },
    })
    assert.equal(foreign.status, 404)
    assert.deepEqual(foreign.body, missing.body)

    const invalidChildConfirmation = await api(`/children/${child.id}`, {
      method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ' },
    })
    assert.equal(invalidChildConfirmation.status, 400)
    assert.equal(await prisma.child.count({ where: { id: child.id } }), 1)

    const deletedChild = await api(`/children/${child.id}`, {
      method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ Маша' },
    })
    assert.deepEqual(deletedChild, { status: 200, body: { success: true }, retryAfter: null })
    assert.equal((await api('/auth/me', { token: childToken })).status, 401)
    assert.equal(await prisma.session.count({ where: { child_id: child.id } }), 0)
    assert.equal(await prisma.message.count({ where: { session_id: session.id } }), 0)
    assert.equal(await prisma.voiceUsageEvent.count({ where: { session_id: session.id } }), 0)
    assert.equal(await prisma.subjectProgress.count({ where: { child_id: child.id } }), 0)
    assert.equal(await prisma.topicProgress.count({ where: { subject_progress_id: subjectProgress.id } }), 0)
    assert.equal(await prisma.building.count({ where: { child_id: child.id } }), 0)
    assert.equal(await prisma.childTopicSetting.count({ where: { child_id: child.id } }), 0)
    assert.equal(await prisma.curriculum.count({ where: { id: customCurriculum.id } }), 1)

    const raceChild = await createChild(currentToken, 'Гоша')
    const raceResults = await Promise.all([
      api(`/children/${raceChild.id}`, { method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ Гоша' } }),
      api(`/children/${raceChild.id}`, { method: 'DELETE', token: currentToken, body: { confirmation: 'УДАЛИТЬ Гоша' } }),
    ])
    assert.deepEqual(raceResults.map((result) => result.status).sort(), [200, 404])

    const accountChild = await createChild(currentToken, 'Лев')
    await prisma.childTopicSetting.create({
      data: { child_id: accountChild.id, curriculum_id: customCurriculum.id, topic_key: 'account-test' },
    })
    await api(`/children/${accountChild.id}/pin`, { method: 'PUT', token: currentToken, body: { pin: '1357' } })
    const accountProgress = await prisma.subjectProgress.upsert({
      where: { child_id_subject: { child_id: accountChild.id, subject: 'math' } },
      create: { child_id: accountChild.id, subject: 'math' }, update: {},
    })
    await prisma.topicProgress.create({ data: { subject_progress_id: accountProgress.id, topic_id: topic.id } })
    const accountSession = await prisma.session.create({ data: { child_id: accountChild.id, subject: 'math', topic_id: topic.id } })
    await prisma.message.create({ data: { session_id: accountSession.id, role: 'user', content: 'account test' } })
    await prisma.voiceUsageEvent.create({ data: { session_id: accountSession.id, kind: 'speech_input' } })
    const accountChildLogin = await api('/auth/child-login', { method: 'POST', body: { child_id: accountChild.id, pin: '1357' } })
    const accountChildToken = accountChildLogin.body.token as string

    const invalidAccountConfirmation = await api('/auth/account', {
      method: 'DELETE', token: currentToken,
      body: { current_password: 'password-2', confirmation: 'УДАЛИТЬ' },
    })
    assert.equal(invalidAccountConfirmation.status, 400)
    const deletedAccount = await api('/auth/account', {
      method: 'DELETE', token: currentToken,
      body: { current_password: 'password-2', confirmation: 'УДАЛИТЬ АККАУНТ' },
    })
    assert.deepEqual(deletedAccount.body, { success: true })
    assert.equal(deletedAccount.status, 200)
    assert.equal((await api('/auth/me', { token: currentToken })).status, 401)
    assert.equal((await api('/auth/me', { token: accountChildToken })).status, 401)
    assert.equal(await prisma.user.count({ where: { id: family.user.id } }), 0)
    assert.equal(await prisma.child.count({ where: { parent_id: family.user.id } }), 0)
    assert.equal(await prisma.curriculum.count({ where: { id: customCurriculum.id } }), 0)
    assert.equal(await prisma.session.count({ where: { id: accountSession.id } }), 0)
    assert.equal(await prisma.message.count({ where: { session_id: accountSession.id } }), 0)
    assert.equal(await prisma.voiceUsageEvent.count({ where: { session_id: accountSession.id } }), 0)
    assert.equal(await prisma.subjectProgress.count({ where: { id: accountProgress.id } }), 0)
    assert.equal(await prisma.topicProgress.count({ where: { subject_progress_id: accountProgress.id } }), 0)
    assert.equal(await prisma.building.count({ where: { child_id: accountChild.id } }), 0)
    assert.equal(await prisma.user.count({ where: { id: other.user.id } }), 1)
    assert.equal(await prisma.child.count({ where: { id: otherChild.id } }), 1)
    assert.equal(await prisma.topic.count(), globalTopicCount)
    assert.equal(await prisma.curriculum.count({ where: { is_system: true } }), systemCurriculumCount)
  } finally {
    await prisma.$disconnect()
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    await rm(tempDb, { force: true })
  }
})
