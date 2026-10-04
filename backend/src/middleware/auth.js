import { User } from '../models/User.js'
import { verifyAccessToken } from '../utils/tokens.js'
import { HttpError } from '../utils/httpError.js'

export async function requireAuth(req, res, next) {
  try {
    const header = req.get('authorization')
    if (!header?.startsWith('Bearer ')) throw new HttpError(401, 'Authentication required')
    const payload = verifyAccessToken(header.slice(7))
    const user = await User.findOne({ _id: payload.sub, universityId: payload.universityId, isActive: true })
    if (!user) throw new HttpError(401, 'Authentication required')
    req.user = user
    next()
  } catch (error) { next(error instanceof HttpError ? error : new HttpError(401, 'Invalid or expired token')) }
}

export function requireRoles(...roles) { return (req, res, next) => { if (!req.user || !roles.includes(req.user.role)) return next(new HttpError(403, 'You do not have permission to perform this action')); next() } }
