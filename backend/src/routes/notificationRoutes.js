import { Router } from 'express'
import { listNotifications, markNotificationsRead } from '../controllers/notificationController.js'
import { requireAuth } from '../middleware/auth.js'

export const notificationRouter = Router()
notificationRouter.use(requireAuth)
notificationRouter.get('/notifications', listNotifications)
notificationRouter.post('/notifications/read', markNotificationsRead)
