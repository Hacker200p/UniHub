import { Router } from 'express'
import {
  addBookmark,
  addRecentlyViewed,
  dashboard,
  getSecurityDetails,
  listBookmarks,
  listRecentlyViewed,
  listSessions,
  logoutOtherSessions,
  removeBookmark,
  revokeSession,
  setPassword,
  unlinkProvider,
  updatePrivacySettings,
  updateProfile,
  getUniversityEmailStatus,
  requestUniversityEmailOtp,
  verifyUniversityEmailOtp,
} from '../controllers/userController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  privacyUpdateSchema,
  profileUpdateSchema,
  setPasswordSchema,
  unlinkProviderSchema,
  requestUniversityEmailOtpSchema,
  verifyUniversityEmailOtpSchema,
} from '../validators/auth.js'

export const userRouter = Router()
userRouter.use(requireAuth)

// Dashboard & Profile
userRouter.get('/dashboard', dashboard)
userRouter.patch('/profile', validate(profileUpdateSchema), updateProfile)

// University Email Verification
userRouter.get('/university-email/status', getUniversityEmailStatus)
userRouter.post('/university-email/request-otp', validate(requestUniversityEmailOtpSchema), requestUniversityEmailOtp)
userRouter.post('/university-email/verify-otp', validate(verifyUniversityEmailOtpSchema), verifyUniversityEmailOtp)

// Security, Credentials & Account Linking
userRouter.get('/security', getSecurityDetails)
userRouter.post('/unlink-provider', validate(unlinkProviderSchema), unlinkProvider)
userRouter.post('/set-password', validate(setPasswordSchema), setPassword)
userRouter.patch('/privacy', validate(privacyUpdateSchema), updatePrivacySettings)

// Session Management
userRouter.get('/sessions', listSessions)
userRouter.delete('/sessions/:id', revokeSession)
userRouter.post('/sessions/logout-others', logoutOtherSessions)

// Bookmarks & Recently Viewed
userRouter.get('/bookmarks', listBookmarks)
userRouter.post('/bookmarks/:resourceId', addBookmark)
userRouter.delete('/bookmarks/:resourceId', removeBookmark)
userRouter.get('/recently-viewed', listRecentlyViewed)
userRouter.post('/recently-viewed/:resourceId', addRecentlyViewed)
