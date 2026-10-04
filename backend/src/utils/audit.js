import { AuditLog } from '../models/AuditLog.js'
import { env } from '../config/env.js'
export function recordAudit({ actorId, action, entityType, entityId, reason = '', metadata = {} }) { return AuditLog.create({ universityId: env.UNIVERSITY_ID, actorId, action, entityType, entityId, reason, metadata }) }
