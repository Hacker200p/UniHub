import { Router } from 'express'
import {
  approveResource,
  contributorProfile,
  createResource,
  downloadResource,
  getResource,
  listContributors,
  listResources,
  pendingResources,
  rejectResource,
  requestChangesResource,
} from '../controllers/resourceController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import { moderationSchema } from '../validators/resource.js'
import { resourceCreateSchema } from '../validators/resource.js'
import { pdfUpload } from '../middleware/upload.js'
import { uploadResource } from '../controllers/uploadController.js'
import { uploadMetadataSchema } from '../validators/upload.js'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

export const resourceRouter = Router()
const uploadLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' ? 10000 : env.UPLOAD_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

resourceRouter.get('/resources', listResources)
resourceRouter.post(
  '/resources/upload',
  uploadLimiter,
  requireAuth,
  pdfUpload,
  validate(uploadMetadataSchema, 'body'),
  uploadResource,
)
resourceRouter.get('/resources/:id', getResource)
resourceRouter.post('/resources', requireAuth, validate(resourceCreateSchema), createResource)
resourceRouter.post('/resources/:id/download', downloadResource)
resourceRouter.get('/contributors', listContributors)
resourceRouter.get('/contributors/:id', contributorProfile)
resourceRouter.get(
  '/admin/resources/pending',
  requireAuth,
  requireRoles('ADMIN', 'MODERATOR'),
  pendingResources,
)
resourceRouter.patch(
  '/admin/resources/:id/approve',
  requireAuth,
  requireRoles('ADMIN', 'MODERATOR'),
  approveResource,
)
resourceRouter.patch(
  '/admin/resources/:id/reject',
  requireAuth,
  requireRoles('ADMIN', 'MODERATOR'),
  validate(moderationSchema),
  rejectResource,
)
resourceRouter.patch(
  '/admin/resources/:id/changes-requested',
  requireAuth,
  requireRoles('ADMIN', 'MODERATOR'),
  requestChangesResource,
)
