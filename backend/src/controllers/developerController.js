import { Developer } from '../models/Developer.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { recordAudit } from '../utils/audit.js'
function validateLinks(body) { for (const field of ['websiteUrl', 'githubUrl', 'linkedinUrl']) { if (body[field] && !/^https?:\/\//i.test(body[field])) throw new HttpError(400, `${field} must use http or https`) } }

export async function listDevelopers(req, res) { return successResponse(res, await Developer.find({ universityId: env.UNIVERSITY_ID, isPublished: true }).sort({ displayOrder: 1, createdAt: 1 }).lean()) }
export async function createDeveloper(req, res) { validateLinks(req.body); const developer = await Developer.create({ ...req.body, universityId: env.UNIVERSITY_ID }); await recordAudit({ actorId: req.user._id, action: 'DEVELOPER_CREATED', entityType: 'Developer', entityId: developer._id }); return successResponse(res, developer, 'Developer profile created', 201) }
export async function updateDeveloper(req, res) { validateLinks(req.body); const developer = await Developer.findOneAndUpdate({ _id: req.params.id, universityId: env.UNIVERSITY_ID }, req.body, { new: true, runValidators: true }); if (!developer) throw new HttpError(404, 'Developer profile not found'); await recordAudit({ actorId: req.user._id, action: 'DEVELOPER_UPDATED', entityType: 'Developer', entityId: developer._id }); return successResponse(res, developer, 'Developer profile updated') }
export async function deleteDeveloper(req, res) { const developer = await Developer.findOneAndDelete({ _id: req.params.id, universityId: env.UNIVERSITY_ID }); if (!developer) throw new HttpError(404, 'Developer profile not found'); await recordAudit({ actorId: req.user._id, action: 'DEVELOPER_DELETED', entityType: 'Developer', entityId: developer._id }); return successResponse(res, null, 'Developer profile deleted') }
