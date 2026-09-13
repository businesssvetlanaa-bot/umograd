import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'

export const CHILD_PIN_PATTERN = /^\d{4}$/u
export const CHILD_LOGIN_MAX_FAILURES = 5
export const CHILD_LOGIN_WINDOW_MS = 15 * 60 * 1000

export const CHILD_LOGIN_ERROR = 'Не удалось войти. Проверьте профиль и PIN-код.'

export function isValidChildPin(value: unknown): value is string {
  return typeof value === 'string' && CHILD_PIN_PATTERN.test(value)
}

export function normalizeParentEmail(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const normalized = value.trim().toLocaleLowerCase('en-US')
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(normalized) ? normalized : null
}

export async function hashChildPin(pin: string): Promise<string> {
  if (!isValidChildPin(pin)) throw new Error('PIN-код должен состоять ровно из 4 цифр')
  return bcrypt.hash(pin, 10)
}

function isBcryptHash(value: string): boolean {
  return /^\$2[aby]\$\d{2}\$/u.test(value)
}

function legacyPinMatches(storedPin: string, candidatePin: string): boolean {
  if (!isValidChildPin(storedPin) || !isValidChildPin(candidatePin)) return false
  return crypto.timingSafeEqual(Buffer.from(storedPin), Buffer.from(candidatePin))
}

export async function verifyChildPin(
  storedPin: string | null,
  candidatePin: string,
): Promise<{ valid: boolean; needsRehash: boolean }> {
  if (!storedPin || !isValidChildPin(candidatePin)) return { valid: false, needsRehash: false }
  if (isBcryptHash(storedPin)) {
    try {
      return { valid: await bcrypt.compare(candidatePin, storedPin), needsRehash: false }
    } catch {
      return { valid: false, needsRehash: false }
    }
  }
  const valid = legacyPinMatches(storedPin, candidatePin)
  return { valid, needsRehash: valid }
}

export function safeChildResponse<T extends { pin: string | null }>(child: T): Omit<T, 'pin'> & { has_pin: boolean } {
  const { pin, ...safe } = child
  return { ...safe, has_pin: Boolean(pin) }
}

export function publicChildResponse(child: { id: string; name: string; grade: number; pin: string | null }) {
  return { id: child.id, name: child.name, grade: child.grade, has_pin: Boolean(child.pin) }
}

export function parentOwnsChild(parentId: string, childParentId: string): boolean {
  return parentId === childParentId
}

type FailureState = { failures: number; resetAt: number }

export class ChildLoginThrottle {
  private readonly failures = new Map<string, FailureState>()

  constructor(
    private readonly maxFailures = CHILD_LOGIN_MAX_FAILURES,
    private readonly windowMs = CHILD_LOGIN_WINDOW_MS,
  ) {}

  key(ip: string | undefined, childId: string): string {
    return `${ip || 'unknown'}\u0000${childId}`
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
    if (!current || current.resetAt <= now) {
      this.failures.set(key, { failures: 1, resetAt: now + this.windowMs })
      return
    }
    current.failures += 1
  }

  clear(key: string): void {
    this.failures.delete(key)
  }

  clearChild(childId: string): void {
    const suffix = `\u0000${childId}`
    for (const key of this.failures.keys()) {
      if (key.endsWith(suffix)) this.failures.delete(key)
    }
  }

  reset(): void {
    this.failures.clear()
  }
}

export const childLoginThrottle = new ChildLoginThrottle()
