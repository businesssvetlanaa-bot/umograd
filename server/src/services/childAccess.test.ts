import test from 'node:test'
import assert from 'node:assert/strict'
import bcrypt from 'bcryptjs'
import {
  ChildLoginThrottle,
  hashChildPin,
  isValidChildPin,
  normalizeParentEmail,
  parentOwnsChild,
  publicChildResponse,
  safeChildResponse,
  verifyChildPin,
} from './childAccess'

test('PIN принимает только строку из четырёх цифр и хранится как bcrypt hash', async () => {
  for (const invalid of [undefined, null, 1234, '', '123', '12345', '12a4', '１２３４']) {
    assert.equal(isValidChildPin(invalid), false)
  }
  assert.equal(isValidChildPin('0427'), true)

  const hashed = await hashChildPin('0427')
  assert.notEqual(hashed, '0427')
  assert.equal(await bcrypt.compare('0427', hashed), true)
  assert.equal(await bcrypt.compare('0428', hashed), false)
})

test('проверка поддерживает bcrypt, запрещает no-PIN и помечает legacy PIN для rehash', async () => {
  const hashed = await hashChildPin('1357')
  assert.deepEqual(await verifyChildPin(hashed, '1357'), { valid: true, needsRehash: false })
  assert.deepEqual(await verifyChildPin(hashed, '1358'), { valid: false, needsRehash: false })
  assert.deepEqual(await verifyChildPin(null, '1357'), { valid: false, needsRehash: false })
  assert.deepEqual(await verifyChildPin('2468', '2468'), { valid: true, needsRehash: true })
  assert.deepEqual(await verifyChildPin('2468', '2467'), { valid: false, needsRehash: false })
})

test('throttle допускает пять ошибок, затем даёт Retry-After и очищается успехом', () => {
  const throttle = new ChildLoginThrottle(5, 15 * 60 * 1000)
  const key = throttle.key('127.0.0.1', 'child-1')
  const now = 10_000

  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(throttle.retryAfterSeconds(key, now), null)
    throttle.recordFailure(key, now)
  }
  assert.equal(throttle.retryAfterSeconds(key, now), 900)
  throttle.clear(key)
  assert.equal(throttle.retryAfterSeconds(key, now), null)

  throttle.recordFailure(key, now)
  assert.equal(throttle.retryAfterSeconds(key, now + 15 * 60 * 1000), null)
})

test('ownership и безопасные ответы не раскрывают PIN или игровую статистику', () => {
  assert.equal(parentOwnsChild('parent-1', 'parent-1'), true)
  assert.equal(parentOwnsChild('parent-2', 'parent-1'), false)

  const child = {
    id: 'child-1',
    name: 'Маша',
    grade: 4,
    pin: '$2b$10$secret',
    xp: 80,
    coins: 130,
  }
  const safe = safeChildResponse(child)
  assert.equal('pin' in safe, false)
  assert.equal(safe.has_pin, true)

  const publicChild = publicChildResponse(child)
  assert.deepEqual(publicChild, { id: 'child-1', name: 'Маша', grade: 4, has_pin: true })
  assert.deepEqual(Object.keys(publicChild), ['id', 'name', 'grade', 'has_pin'])
})

test('email родителя нормализуется и невалидные значения отклоняются', () => {
  assert.equal(normalizeParentEmail('  Parent@Example.COM '), 'parent@example.com')
  assert.equal(normalizeParentEmail('not-an-email'), null)
  assert.equal(normalizeParentEmail(undefined), null)
})
