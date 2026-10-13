import { Notification } from '../models/Notification.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'

export async function listNotifications(req, res) {
  const items = await Notification.find({
    universityId: env.UNIVERSITY_ID,
    userId: req.user._id,
  })
    .sort({ createdAt: -1 })
    .limit(50)
    .lean()

  return successResponse(
    res,
    items.map((item) => ({
      ...item,
      isRead: Boolean(item.readAt),
    })),
  )
}
export async function markNotificationsRead(req, res) {
  await Notification.updateMany(
    { universityId: env.UNIVERSITY_ID, userId: req.user._id, readAt: null },
    { readAt: new Date() },
  )
  return successResponse(res, null, 'Notifications marked as read')
}
