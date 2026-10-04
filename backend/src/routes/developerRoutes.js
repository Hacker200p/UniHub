import { Router } from 'express'
import { createDeveloper, deleteDeveloper, listDevelopers, updateDeveloper } from '../controllers/developerController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

export const developerRouter = Router()
developerRouter.get('/team', listDevelopers)
developerRouter.post('/admin/team', requireAuth, requireRoles('ADMIN'), createDeveloper)
developerRouter.patch('/admin/team/:id', requireAuth, requireRoles('ADMIN'), updateDeveloper)
developerRouter.delete('/admin/team/:id', requireAuth, requireRoles('ADMIN'), deleteDeveloper)
