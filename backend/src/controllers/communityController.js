import { Report, Suggestion } from '../models/Community.js'
import { Resource } from '../models/Resource.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'

export async function createSuggestion(req, res) { return successResponse(res, await Suggestion.create({ ...req.body, universityId: env.UNIVERSITY_ID, userId: req.user._id }), 'Suggestion submitted', 201) }
export async function listMySuggestions(req, res) { return successResponse(res, await Suggestion.find({ universityId: env.UNIVERSITY_ID, userId: req.user._id }).sort({ createdAt: -1 })) }
export async function createReport(req, res) { if (!await Resource.exists({ _id: req.params.resourceId, universityId: env.UNIVERSITY_ID, status: 'APPROVED' })) throw new HttpError(404, 'Resource not found'); return successResponse(res, await Report.create({ ...req.body, universityId: env.UNIVERSITY_ID, resourceId: req.params.resourceId, userId: req.user?._id || null }), 'Report submitted', 201) }
export async function listModerationFeedback(req, res) { const [suggestions, reports] = await Promise.all([Suggestion.find({ universityId: env.UNIVERSITY_ID, status: 'OPEN' }).populate('userId', 'name email').sort({ createdAt: 1 }), Report.find({ universityId: env.UNIVERSITY_ID, status: 'OPEN' }).populate('resourceId', 'title').sort({ createdAt: 1 })]); return successResponse(res, { suggestions, reports }) }
export async function updateSuggestion(req, res) { const suggestion = await Suggestion.findOneAndUpdate({ _id: req.params.id, universityId: env.UNIVERSITY_ID }, { status: req.body.status, adminReply: req.body.reply }, { new: true }); if (!suggestion) throw new HttpError(404, 'Suggestion not found'); return successResponse(res, suggestion, 'Suggestion updated') }
export async function updateReport(req, res) { const report = await Report.findOneAndUpdate({ _id: req.params.id, universityId: env.UNIVERSITY_ID }, { status: req.body.status, moderatorReply: req.body.reply }, { new: true }); if (!report) throw new HttpError(404, 'Report not found'); return successResponse(res, report, 'Report updated') }
