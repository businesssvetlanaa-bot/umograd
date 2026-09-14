import test from 'node:test'
import assert from 'node:assert/strict'
import {
  DELETE_ACCOUNT_CONFIRMATION,
  SensitiveActionThrottle,
  childDeletionConfirmation,
  confirmsAccountDeletion,
  confirmsChildDeletion,
  isValidCurrentPassword,
  isValidNewPassword,
  parentAuthVersion,
  parentAuthVersionMatches,
} from './accountSecurity'

test('new password accepts only 8..72 UTF-8 bytes', () => {
  assert.equal(isValidNewPassword('1234567'), false)
  assert.equal(isValidNewPassword('12345678'), true)
  assert.equal(isValidNewPassword('a'.repeat(72)), true)
  assert.equal(isValidNewPassword('a'.repeat(73)), false)
  assert.equal(isValidNewPassword('я'.repeat(36)), true)
  assert.equal(isValidNewPassword('я'.repeat(37)), false)
  assert.equal(isValidNewPassword(12345678), false)
  assert.equal(isValidCurrentPassword('existing password'), true)
  assert.equal(isValidCurrentPassword(''), false)
})

test('parent auth version is opaque, scoped and changes with user/hash', () => {
  const version = parentAuthVersion('test-secret', 'parent-1', '$2b$10$hash')
  assert.equal(version.includes('test-secret'), false)
  assert.equal(version.includes('$2b$10$hash'), false)
  assert.equal(parentAuthVersionMatches(version, 'test-secret', 'parent-1', '$2b$10$hash'), true)
  assert.equal(parentAuthVersionMatches(version, 'test-secret', 'parent-2', '$2b$10$hash'), false)
  assert.equal(parentAuthVersionMatches(version, 'test-secret', 'parent-1', '$2b$10$changed'), false)
  assert.equal(parentAuthVersionMatches(undefined, 'test-secret', 'parent-1', '$2b$10$hash'), false)
})

test('destructive confirmations are exact', () => {
  assert.equal(childDeletionConfirmation('Маша'), 'УДАЛИТЬ Маша')
  assert.equal(confirmsChildDeletion('УДАЛИТЬ Маша', 'Маша'), true)
  assert.equal(confirmsChildDeletion('удалить Маша', 'Маша'), false)
  assert.equal(confirmsAccountDeletion(DELETE_ACCOUNT_CONFIRMATION), true)
  assert.equal(confirmsAccountDeletion(`${DELETE_ACCOUNT_CONFIRMATION} `), false)
})

test('shared throttle blocks after five failures, resets on success/expiry and stays bounded', () => {
  const throttle = new SensitiveActionThrottle(5, 900_000, 2)
  const key = throttle.key('127.0.0.1', 'parent-1')
  const now = 10_000
  for (let attempt = 0; attempt < 5; attempt += 1) {
    assert.equal(throttle.retryAfterSeconds(key, now), null)
    throttle.recordFailure(key, now)
  }
  assert.equal(throttle.retryAfterSeconds(key, now), 900)
  throttle.clear(key)
  assert.equal(throttle.retryAfterSeconds(key, now), null)

  throttle.recordFailure(throttle.key('1', 'one'), now)
  throttle.recordFailure(throttle.key('2', 'two'), now)
  throttle.recordFailure(throttle.key('3', 'three'), now)
  assert.equal(throttle.size(), 2)
  assert.equal(throttle.retryAfterSeconds(throttle.key('2', 'two'), now + 900_000), null)
})
