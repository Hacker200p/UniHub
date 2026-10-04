import { AuditLog } from '../models/AuditLog.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
export async function listAuditLogs(req, res) { return successResponse(res, await AuditLog.find({ universityId: env.UNIVERSITY_ID }).populate('actorId', 'name role').sort({ createdAt: -1 }).limit(200).lean()) }
