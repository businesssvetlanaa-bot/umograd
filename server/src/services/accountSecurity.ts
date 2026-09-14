import crypto from 'node:crypto'

export const ACCOUNT_AUTH_MAX_FAILURES = 5
export const ACCOUNT_AUTH_WINDOW_MS = 15 * 60 * 1000
export const DELETE_ACCOUNT_CONFIRMATION = 'УДАЛИТЬ АККАУНТ'

export function isValidNewPassword(value: unknown): value is string {
  if (typeof value !== 'string') return false
  const bytes = Buffer.byteLength(value, 'utf8')
  return bytes >= 8 && bytes <= 72
}

export function isValidCurrentPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0 && Buffer.byteLength(value, 'utf8') <= 1024
}

export function parentAuthVersion(secret: string, userId: string, passwordHash: string): string {
  return crypto
    .createHmac('sha256', secret)
    .update('umograd:parent-auth:v1\0')
    .update(userId)
    .update('\0')
    .update(passwordHash)
    .digest('base64url')
}

export function parentAuthVersionMatches(
  candidate: unknown,
  secret: string,
  userId: string,
  passwordHash: string,
): boolean {
  if (typeof candidate !== 'string') return false
  const expected = parentAuthVersion(secret, userId, passwordHash)
  const candidateBuffer = Buffer.from(candidate, 'utf8')
  const expectedBuffer = Buffer.from(expected, 'utf8')
  return candidateBuffer.length === expectedBuffer.length
    && crypto.timingSafeEqual(candidateBuffer, expectedBuffer)
}

export function childDeletionConfirmation(childName: string): string {
  return `УДАЛИТЬ ${childName}`
}

export function confirmsChildDeletion(candidate: unknown, childName: string): boolean {
  return typeof candidate === 'string' && candidate === childDeletionConfirmation(childName)
}

export function confirmsAccountDeletion(candidate: unknown): boolean {
  return candidate === DELETE_ACCOUNT_CONFIRMATION
}

type FailureState = { failures: number; resetAt: number }

export class SensitiveActionThrottle {
  private readonly failures = new Map<string, FailureState>()

  constructor(
    private readonly maxFailures = ACCOUNT_AUTH_MAX_FAILURES,
    private readonly windowMs = ACCOUNT_AUTH_WINDOW_MS,
    private readonly maxKeys = 10_000,
  ) {}

  key(ip: string | undefined, parentId: string): string {
    return `${ip || 'unknown'}\0${parentId}`
  }

  retryAfterSeconds(key: string, now = Date.now()): number | null {
    const state = this.failures.get(key)
    if (!state) return null
    if (state.resetAt <= now) {
      this.failures.delete(key)
      return null
    }
    if (state.failures < this.maxFailures) return null
    return Math.max(1, Math.ceil((state.resetAt - now) / 1000))
  }

  recordFailure(key: string, now = Date.now()): void {
    const current = this.failures.get(key)
    if (current && current.resetAt > now) {
      current.failures += 1
      return
    }

    this.prune(now)
    if (!this.failures.has(key) && this.failures.size >= this.maxKeys) {
      const oldestKey = this.failures.keys().next().value as string | undefined
      if (oldestKey) this.failures.delete(oldestKey)
    }
    this.failures.set(key, { failures: 1, resetAt: now + this.windowMs })
  }

  clear(key: string): void {
    this.failures.delete(key)
  }

  clearParent(parentId: string): void {
    const suffix = `\0${parentId}`
    for (const key of this.failures.keys()) {
      if (key.endsWith(suffix)) this.failures.delete(key)
    }
  }

  size(): number {
    return this.failures.size
  }

  reset(): void {
    this.failures.clear()
  }

  private prune(now: number): void {
    for (const [key, state] of this.failures) {
      if (state.resetAt <= now) this.failures.delete(key)
    }
  }
}

export const sensitiveActionThrottle = new SensitiveActionThrottle()
