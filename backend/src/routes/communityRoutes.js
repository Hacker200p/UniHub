import { Router } from 'express'
import { createReport, createSuggestion, listModerationFeedback, listMySuggestions, updateReport, updateSuggestion } from '../controllers/communityController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { communityStatusSchema, reportSchema, suggestionSchema } from '../validators/community.js'

export const communityRouter = Router()
communityRouter.post('/suggestions', requireAuth, validate(suggestionSchema), createSuggestion)
communityRouter.get('/suggestions/mine', requireAuth, listMySuggestions)
communityRouter.post('/resources/:resourceId/reports', validate(reportSchema), createReport)
communityRouter.get('/admin/feedback', requireAuth, requireRoles('ADMIN', 'MODERATOR'), listModerationFeedback)
communityRouter.patch('/admin/suggestions/:id', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(communityStatusSchema), updateSuggestion)
communityRouter.patch('/admin/reports/:id', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(communityStatusSchema), updateReport)
