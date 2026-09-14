import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'
import { prisma } from '../lib/prisma'
import { parentAuthVersionMatches } from '../services/accountSecurity'

const AUTH_ERROR = '\u0421\u0435\u0441\u0441\u0438\u044f \u0438\u0441\u0442\u0435\u043a\u043b\u0430. \u0412\u043e\u0439\u0434\u0438\u0442\u0435 \u0441\u043d\u043e\u0432\u0430'

export interface JwtPayload {
  id: string
  email?: string
  role: 'parent' | 'child'
  authv?: string
}

export interface AuthRequest extends Request {
  user?: JwtPayload
}

function isJwtPayload(value: unknown): value is JwtPayload {
  if (typeof value !== 'object' || value === null) return false
  const candidate = value as Partial<JwtPayload>
  return typeof candidate.id === 'string'
    && candidate.id.length > 0
    && candidate.id.length <= 128
    && (candidate.role === 'parent' || candidate.role === 'child')
}

export async function authMiddleware(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: AUTH_ERROR })
    return
  }

  const token = header.slice(7)
  try {
    const verified = jwt.verify(token, process.env.JWT_SECRET!, { algorithms: ['HS256'] })
    if (!isJwtPayload(verified)) {
      res.status(401).json({ error: AUTH_ERROR })
      return
    }

    const payload = verified
    if (payload.role === 'parent') {
      const user = await prisma.user.findUnique({ where: { id: payload.id }, select: { password: true } })
      if (!user || !parentAuthVersionMatches(payload.authv, process.env.JWT_SECRET!, payload.id, user.password)) {
        res.status(401).json({ error: AUTH_ERROR })
        return
      }
    } else {
      const child = await prisma.child.findUnique({ where: { id: payload.id }, select: { id: true } })
      if (!child) {
        res.status(401).json({ error: AUTH_ERROR })
        return
      }
    }

    req.user = payload
    next()
  } catch {
    res.status(401).json({ error: AUTH_ERROR })
  }
}
export function requireParent(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'parent') {
    res.status(403).json({ error: 'Доступ только для родителей' })
    return
  }
  next()
}

export function requireChild(req: AuthRequest, res: Response, next: NextFunction): void {
  if (req.user?.role !== 'child') {
    res.status(403).json({ error: 'Доступ только для детей' })
    return
  }
  next()
}
