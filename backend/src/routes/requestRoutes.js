import { Router } from 'express'
import {
  adminReplyRequest,
  createRequest,
  fulfillRequest,
  listRequests,
  upvoteRequest,
} from '../controllers/requestController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { requestCreateSchema, requestReplySchema } from '../validators/request.js'

export const requestRouter = Router()
requestRouter.get('/requests', listRequests)
requestRouter.post('/requests', requireAuth, validate(requestCreateSchema), createRequest)
requestRouter.post('/requests/:id/upvote', requireAuth, upvoteRequest)
requestRouter.patch('/admin/requests/:id/fulfill', requireAuth, requireRoles('ADMIN', 'MODERATOR'), fulfillRequest)
requestRouter.patch('/admin/requests/:id', requireAuth, requireRoles('ADMIN', 'MODERATOR'), validate(requestReplySchema), adminReplyRequest)
