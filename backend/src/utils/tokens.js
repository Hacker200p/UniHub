import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'

export function createAccessToken(user) {
  return jwt.sign(
    { sub: user._id.toString(), role: user.role, universityId: user.universityId },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN },
  )
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_SECRET)
}

export function createOpaqueToken() {
  return crypto.randomBytes(32).toString('hex')
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex')
}

export function createRefreshToken() {
  return createOpaqueToken()
}

export function createFamilyId() {
  return crypto.randomUUID()
}

export function parseDurationMs(val) {
  if (typeof val === 'number') return val
  if (!val || typeof val !== 'string') return 7 * 24 * 60 * 60 * 1000
  const match = val.trim().match(/^(\d+)([smhdw]?)$/)
  if (!match) return 7 * 24 * 60 * 60 * 1000
  const num = parseInt(match[1], 10)
  const unit = match[2]
  switch (unit) {
    case 's': return num * 1000
    case 'm': return num * 60 * 1000
    case 'h': return num * 60 * 60 * 1000
    case 'd': return num * 24 * 60 * 60 * 1000
    case 'w': return num * 7 * 24 * 60 * 60 * 1000
    default: return num
  }
}
