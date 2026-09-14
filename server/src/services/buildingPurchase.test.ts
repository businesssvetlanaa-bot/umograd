import test from 'node:test'
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import {
  BuildingPurchaseOverloadedError,
  KeyedMutex,
  buildingPlacementResponse,
  canonicalBuilding,
  parseBuildingPlacement,
} from './buildingPurchase'

test('placement validation accepts only exact type and finite map coordinates', () => {
  assert.deepEqual(parseBuildingPlacement({ building_type: 'tree', position_x: 60, position_y: 450 }), {
    building_type: 'tree', position_x: 60, position_y: 450,
  })
  for (const invalid of [
    null,
    { building_type: '', position_x: 60, position_y: 60 },
    { building_type: 'x'.repeat(65), position_x: 60, position_y: 60 },
    { building_type: 'tree', position_x: '60', position_y: 60 },
    { building_type: 'tree', position_x: Number.NaN, position_y: 60 },
    { building_type: 'tree', position_x: 59.99, position_y: 60 },
    { building_type: 'tree', position_x: 741, position_y: 60 },
    { building_type: 'tree', position_x: 60, position_y: 59 },
    { building_type: 'tree', position_x: 60, position_y: 451 },
  ]) assert.equal(parseBuildingPlacement(invalid), null)
})

test('canonical building is earliest purchased, then smallest id, without mutating input', () => {
  const buildings = [
    { id: 'z', purchased_at: new Date('2026-01-01T00:00:00Z') },
    { id: 'b', purchased_at: new Date('2025-01-01T00:00:00Z') },
    { id: 'a', purchased_at: new Date('2025-01-01T00:00:00Z') },
  ]
  assert.equal(canonicalBuilding(buildings)?.id, 'a')
  assert.deepEqual(buildings.map((building) => building.id), ['z', 'b', 'a'])
})

test('response exposes exact stable keys only', () => {
  const response = buildingPlacementResponse({
    id: 'building-1', building_type: 'tree', placed: true, position_x: 100, position_y: 200,
  }, 70, true)
  assert.deepEqual(response, {
    success: true,
    purchased_now: true,
    coins: 70,
    building: { id: 'building-1', building_type: 'tree', placed: true, position_x: 100, position_y: 200 },
  })
  assert.deepEqual(Object.keys(response), ['success', 'purchased_now', 'coins', 'building'])
  assert.deepEqual(Object.keys(response.building), ['id', 'building_type', 'placed', 'position_x', 'position_y'])
})

test('mutex serializes same child and lets different children overlap', async () => {
  const mutex = new KeyedMutex()
  let activeForChild = 0
  let maxForChild = 0
  const order: string[] = []
  let releaseFirst!: () => void
  const firstGate = new Promise<void>((resolve) => { releaseFirst = resolve })
  const first = mutex.run('child-1', async () => {
    activeForChild += 1; maxForChild = Math.max(maxForChild, activeForChild); order.push('first:start')
    await firstGate
    order.push('first:end'); activeForChild -= 1
  })
  const second = mutex.run('child-1', async () => {
    activeForChild += 1; maxForChild = Math.max(maxForChild, activeForChild); order.push('second:start')
    activeForChild -= 1
  })
  let otherStarted = false
  await mutex.run('child-2', async () => { otherStarted = true })
  assert.equal(otherStarted, true)
  assert.deepEqual(order, ['first:start'])
  releaseFirst()
  await Promise.all([first, second])
  assert.equal(maxForChild, 1)
  assert.deepEqual(order, ['first:start', 'first:end', 'second:start'])
  assert.equal(mutex.activeKeys(), 0)
})

test('mutex cleans rejection, does not poison queue and enforces key/queue bounds', async () => {
  const mutex = new KeyedMutex(1, 2)
  let release!: () => void
  const gate = new Promise<void>((resolve) => { release = resolve })
  const failed = mutex.run('child-1', async () => { await gate; throw new Error('expected') })
  const recovered = mutex.run('child-1', async () => 'ok')
  await assert.rejects(() => mutex.run('child-1', async () => 'overflow'), BuildingPurchaseOverloadedError)
  await assert.rejects(() => mutex.run('child-2', async () => 'overflow'), BuildingPurchaseOverloadedError)
  assert.equal(mutex.pendingFor('child-1'), 2)
  release()
  await assert.rejects(failed, /expected/u)
  assert.equal(await recovered, 'ok')
  assert.equal(mutex.activeKeys(), 0)
})
test('client sets synchronous in-flight guard before request and gates only unowned unaffordable items', async () => {
  const source = await readFile(path.resolve('../client/src/pages/ChildWorld.tsx'), 'utf8')
  const guard = source.indexOf('placementRequestRef.current = true')
  const request = source.indexOf('await childrenApi.placeBuilding')
  const reset = source.indexOf('placementRequestRef.current = false')
  assert.ok(guard >= 0 && request > guard && reset > request)
  assert.match(source, /const unaffordable = !b\.owned && coins < b\.cost/u)
  assert.match(source, /disabled=\{busy \|\| unaffordable\}/u)
})