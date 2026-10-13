import { Router } from 'express'
import {
  createReport,
  createSuggestion,
  dismissReport,
  listAllReports,
  listAllSuggestions,
  listModerationFeedback,
  listMySuggestions,
  resolveReport,
  updateReport,
  updateSuggestion,
} from '../controllers/communityController.js'
import { requireAuth, requireRoles, optionalAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { communityStatusSchema, reportSchema, suggestionSchema, dismissReportSchema, resolveReportSchema } from '../validators/community.js'

export const communityRouter = Router()
communityRouter.post('/suggestions', requireAuth, validate(suggestionSchema), createSuggestion)
communityRouter.get('/suggestions/mine', requireAuth, listMySuggestions)
communityRouter.post('/resources/:resourceId/reports', optionalAuth, validate(reportSchema), createReport)

// Admin moderation
communityRouter.get('/admin/feedback', requireAuth, requireRoles('ADMIN', 'MODERATOR'), listModerationFeedback)
communityRouter.get('/admin/reports', requireAuth, requireRoles('ADMIN', 'MODERATOR'), listAllReports)
communityRouter.get('/admin/suggestions/all', requireAuth, requireRoles('ADMIN', 'MODERATOR'), listAllSuggestions)
communityRouter.patch('/admin/suggestions/:id', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(communityStatusSchema), updateSuggestion)
communityRouter.patch('/admin/reports/:id', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(communityStatusSchema), updateReport)
communityRouter.post('/admin/reports/:id/resolve', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(resolveReportSchema), resolveReport)
communityRouter.post('/admin/reports/:id/dismiss', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(dismissReportSchema), dismissReport)
