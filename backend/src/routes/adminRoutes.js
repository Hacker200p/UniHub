import { Router } from 'express'
import {
  deleteAdminResource,
  getAdminUserDetail,
  getAnalytics,
  listAdminContributors,
  listAdminDevelopers,
  listAdminResources,
  listAdminUsers,
  overview,
  queue,
  updateAdminResource,
  updateUserRole,
  updateUserStatus,
} from '../controllers/adminController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'
import { listAuditLogs } from '../controllers/auditController.js'

export const adminRouter = Router()
adminRouter.use(requireAuth, requireRoles('ADMIN', 'MODERATOR'))

adminRouter.get('/overview', overview)
adminRouter.get('/queue', queue)
adminRouter.get('/analytics', getAnalytics)
adminRouter.get('/resources', listAdminResources)
adminRouter.patch('/resources/:id', updateAdminResource)
adminRouter.delete('/resources/:id', deleteAdminResource)

adminRouter.get('/contributors', listAdminContributors)
adminRouter.get('/developers', listAdminDevelopers)
adminRouter.get('/audit', listAuditLogs)

// Role-management routes restricted strictly to ADMIN only
adminRouter.get('/users', requireRoles('ADMIN'), listAdminUsers)
adminRouter.get('/users/:id', requireRoles('ADMIN'), getAdminUserDetail)
adminRouter.patch('/users/:id/role', requireRoles('ADMIN'), updateUserRole)
adminRouter.patch('/users/:id/status', requireRoles('ADMIN'), updateUserStatus)
