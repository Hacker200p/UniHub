import bcrypt from 'bcryptjs'
import { Bookmark, RecentlyViewed } from '../models/UserActivity.js'
import { Resource } from '../models/Resource.js'
import { Suggestion } from '../models/Community.js'
import { Notification } from '../models/Notification.js'
import { Program, Branch, Semester } from '../models/Academic.js'
import { RefreshSession } from '../models/RefreshSession.js'
import { User } from '../models/User.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { recordAudit } from '../utils/audit.js'
import { getRefreshCookie } from '../utils/refreshCookie.js'
import { hashToken } from '../utils/tokens.js'
import { isValidUniversityEmail, generateNumericOtp, hashOtp } from '../utils/universityEmail.js'
import { sendOtpEmail } from '../services/mailer.js'

const visibleResource = { universityId: env.UNIVERSITY_ID, status: 'APPROVED' }

export async function dashboard(req, res) {
  const [
    approved,
    pending,
    rejected,
    changes,
    downloads,
    suggestions,
    uploads,
    bookmarks,
    recentlyViewed,
    unreadNotifications,
    notifications,
  ] = await Promise.all([
    Resource.countDocuments({
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      status: 'APPROVED',
    }),
    Resource.countDocuments({
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      status: 'PENDING_REVIEW',
    }),
    Resource.countDocuments({
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      status: 'REJECTED',
    }),
    Resource.countDocuments({
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      status: 'CHANGES_REQUESTED',
    }),
    Resource.aggregate([
      { $match: { universityId: env.UNIVERSITY_ID, contributorId: req.user._id } },
      { $group: { _id: null, total: { $sum: '$downloadCount' } } },
    ]),
    Suggestion.find({ universityId: env.UNIVERSITY_ID, userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    Resource.find({ universityId: env.UNIVERSITY_ID, contributorId: req.user._id })
      .select(
        'title resourceType status academicYear subjectId createdAt reviewedAt rejectionReason requestedChanges downloadCount',
      )
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean(),
    Bookmark.find({ userId: req.user._id, universityId: env.UNIVERSITY_ID })
      .populate({
        path: 'resourceId',
        match: visibleResource,
        select: 'title resourceType academicYear file.url',
      })
      .sort({ createdAt: -1 })
      .limit(20)
      .lean(),
    RecentlyViewed.find({ userId: req.user._id, universityId: env.UNIVERSITY_ID })
      .populate({
        path: 'resourceId',
        match: visibleResource,
        select: 'title resourceType academicYear file.url',
      })
      .sort({ viewedAt: -1 })
      .limit(20)
      .lean(),
    Notification.countDocuments({
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
      readAt: null,
    }),
    Notification.find({
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
    })
      .sort({ createdAt: -1 })
      .limit(30)
      .lean(),
  ])

  return successResponse(res, {
    statistics: {
      approvedContributions: approved,
      pendingContributions: pending,
      rejectedContributions: rejected,
      changesRequested: changes,
      totalDownloads: downloads[0]?.total || 0,
      savedResources: bookmarks.filter((item) => item.resourceId).length,
      unreadNotifications,
    },
    uploads,
    suggestions,
    notifications: (notifications || []).map((item) => ({
      ...item,
      isRead: Boolean(item.readAt),
    })),
    bookmarks: bookmarks.filter((item) => item.resourceId),
    recentlyViewed: recentlyViewed.filter((item) => item.resourceId),
  })
}

export async function updateProfile(req, res) {
  const updates = { ...req.body }
  if (updates.programId) {
    const program = await Program.exists({
      _id: updates.programId,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    })
    if (!program) throw new HttpError(400, 'Invalid program')
  }
  if (
    updates.branchId &&
    !(await Branch.exists({
      _id: updates.branchId,
      programId: updates.programId || req.user.programId,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    }))
  ) {
    throw new HttpError(400, 'Invalid branch')
  }
  if (
    updates.semesterId &&
    !(await Semester.exists({
      _id: updates.semesterId,
      programId: updates.programId || req.user.programId,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    }))
  ) {
    throw new HttpError(400, 'Invalid semester')
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
    runValidators: true,
  })

  return successResponse(res, { user: user.toPrivateJSON() }, 'Profile updated')
}

// ==========================================
// SECURITY & ACCOUNT SETTINGS
// ==========================================

export async function getSecurityDetails(req, res) {
  const user = await User.findById(req.user._id).select('+passwordHash')
  if (!user) throw new HttpError(404, 'User not found')

  const now = new Date()
  const activeSessionsCount = await RefreshSession.countDocuments({
    universityId: env.UNIVERSITY_ID,
    userId: user._id,
    revokedAt: null,
    expiresAt: { $gt: now },
  })

  return successResponse(res, {
    email: user.email,
    isEmailVerified: Boolean(user.emailVerifiedAt),
    hasPassword: Boolean(user.passwordHash),
    authProviders: (user.authProviders || []).map((p) => ({
      provider: p.provider,
      email: p.email,
      emailVerified: p.emailVerified,
      avatarUrl: p.avatarUrl,
      linkedAt: p.linkedAt,
    })),
    activeSessionsCount,
    universityEmail: user.universityEmail,
    isUniversityEmailVerified: Boolean(user.universityEmailVerifiedAt),
    universityEmailVerifiedAt: user.universityEmailVerifiedAt,
    privacySettings: user.privacySettings || {},
    publicProfile: user.publicProfile,
  })
}

export async function unlinkProvider(req, res) {
  const { provider } = req.body
  const user = await User.findById(req.user._id).select('+passwordHash')
  if (!user) throw new HttpError(404, 'User not found')

  const hasPassword = Boolean(user.passwordHash)
  const remainingProviders = (user.authProviders || []).filter((p) => p.provider !== provider)

  if (!hasPassword && remainingProviders.length === 0) {
    throw new HttpError(
      400,
      'Cannot disconnect your only sign-in method. Please set a password or connect another account first.',
    )
  }

  user.authProviders = remainingProviders
  await user.save()

  await Notification.create({
    universityId: env.UNIVERSITY_ID,
    userId: user._id,
    type: 'SECURITY_ALERT',
    title: `${provider.toUpperCase()} Disconnected`,
    message: `Your ${provider} account was disconnected from your UniHub profile.`,
  })

  await recordAudit({
    actorId: user._id,
    action: 'AUTH_PROVIDER_UNLINKED',
    entityType: 'User',
    entityId: user._id,
    metadata: { provider },
  })

  return successResponse(
    res,
    { user: user.toPrivateJSON() },
    `Successfully disconnected ${provider.toUpperCase()}`,
  )
}

export async function setPassword(req, res) {
  const password = req.body.newPassword || req.body.password
  const { currentPassword } = req.body
  const user = await User.findById(req.user._id).select('+passwordHash')
  if (!user) throw new HttpError(404, 'User not found')

  if (user.passwordHash) {
    if (!currentPassword || !(await user.comparePassword(currentPassword))) {
      throw new HttpError(400, 'Current password does not match')
    }
  }

  user.passwordHash = await bcrypt.hash(password, 12)
  await user.save()

  await Notification.create({
    universityId: env.UNIVERSITY_ID,
    userId: user._id,
    type: 'SECURITY_ALERT',
    title: 'Password Updated',
    message: 'Your account password has been updated successfully.',
  })

  await recordAudit({
    actorId: user._id,
    action: 'PASSWORD_UPDATED',
    entityType: 'User',
    entityId: user._id,
  })

  return successResponse(res, user.toPrivateJSON(), 'Password saved successfully')
}

function parseDeviceMetadata(userAgent = '') {
  let browser = 'Web Browser'
  let os = 'Unknown OS'
  let deviceType = 'desktop'

  if (/mobile|android|iphone|ipad|ipod/i.test(userAgent)) {
    deviceType = 'mobile'
  }

  if (/firefox/i.test(userAgent)) browser = 'Firefox'
  else if (/edg/i.test(userAgent)) browser = 'Edge'
  else if (/chrome|crios/i.test(userAgent)) browser = 'Chrome'
  else if (/safari/i.test(userAgent)) browser = 'Safari'

  if (/windows/i.test(userAgent)) os = 'Windows'
  else if (/macintosh|mac os x/i.test(userAgent)) os = 'macOS'
  else if (/android/i.test(userAgent)) os = 'Android'
  else if (/iphone|ipad|ipod/i.test(userAgent)) os = 'iOS'
  else if (/linux/i.test(userAgent)) os = 'Linux'

  return { browser, os, deviceType }
}

export async function listSessions(req, res) {
  const now = new Date()
  const rawCookie = getRefreshCookie(req)
  const currentHash = rawCookie ? hashToken(rawCookie) : null

  const sessions = await RefreshSession.find({
    universityId: env.UNIVERSITY_ID,
    userId: req.user._id,
    revokedAt: null,
    expiresAt: { $gt: now },
  })
    .sort({ lastUsedAt: -1, createdAt: -1 })
    .lean()

  const safeSessions = sessions.map((s) => {
    const device = s.device || parseDeviceMetadata(s.userAgent)
    return {
      id: s._id,
      familyId: s.familyId,
      device: {
        browser: device.browser || 'Web Browser',
        os: device.os || 'Unknown OS',
        deviceType: device.deviceType || 'desktop',
      },
      createdAt: s.createdAt,
      lastUsedAt: s.lastUsedAt,
      isCurrentSession: Boolean(currentHash && s.tokenHash === currentHash),
    }
  })

  return successResponse(res, safeSessions)
}

export async function revokeSession(req, res) {
  const session = await RefreshSession.findOneAndUpdate(
    {
      _id: req.params.id,
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: 'USER_REVOKED',
      },
    },
    { new: true },
  )

  if (!session) throw new HttpError(404, 'Active session not found')

  return successResponse(res, null, 'Session revoked successfully')
}

export async function logoutOtherSessions(req, res) {
  const rawCookie = getRefreshCookie(req)
  const currentHash = rawCookie ? hashToken(rawCookie) : null

  const query = {
    universityId: env.UNIVERSITY_ID,
    userId: req.user._id,
    revokedAt: null,
  }

  if (currentHash) {
    query.tokenHash = { $ne: currentHash }
  }

  const result = await RefreshSession.updateMany(query, {
    $set: {
      revokedAt: new Date(),
      revokedReason: 'USER_LOGOUT_OTHERS',
    },
  })

  await recordAudit({
    actorId: req.user._id,
    action: 'LOGOUT_OTHER_SESSIONS',
    entityType: 'User',
    entityId: req.user._id,
    metadata: { count: result.modifiedCount },
  })

  return successResponse(res, { revokedCount: result.modifiedCount }, 'Other sessions revoked')
}

export async function updatePrivacySettings(req, res) {
  const updates = {}
  if (typeof req.body.publicProfile !== 'undefined') {
    updates.publicProfile = Boolean(req.body.publicProfile)
  }

  const existingPrivacy = req.user.privacySettings?.toObject?.() || req.user.privacySettings || {}
  const nested = {}
  if (typeof req.body.showAvatar !== 'undefined') nested.showAvatar = Boolean(req.body.showAvatar)
  if (typeof req.body.showBio !== 'undefined') nested.showBio = Boolean(req.body.showBio)
  if (typeof req.body.showGithub !== 'undefined') nested.showGithub = Boolean(req.body.showGithub)
  if (typeof req.body.showLinkedin !== 'undefined') nested.showLinkedin = Boolean(req.body.showLinkedin)
  if (typeof req.body.showAcademicInfo !== 'undefined') nested.showAcademicInfo = Boolean(req.body.showAcademicInfo)

  if (req.body.privacySettings || Object.keys(nested).length > 0) {
    updates.privacySettings = {
      ...existingPrivacy,
      ...(req.body.privacySettings || {}),
      ...nested,
    }
  }

  const user = await User.findByIdAndUpdate(req.user._id, updates, {
    new: true,
  })

  return successResponse(res, user.toPrivateJSON(), 'Privacy settings updated')
}

// ==========================================
// BOOKMARKS & ACTIVITY
// ==========================================

export async function listBookmarks(req, res) {
  const bookmarks = await Bookmark.find({
    userId: req.user._id,
    universityId: env.UNIVERSITY_ID,
  })
    .populate({ path: 'resourceId', match: visibleResource })
    .sort({ createdAt: -1 })
    .lean()
  return successResponse(res, bookmarks.filter((item) => item.resourceId))
}

export async function addBookmark(req, res) {
  if (!(await Resource.exists({ _id: req.params.resourceId, ...visibleResource }))) {
    throw new HttpError(404, 'Resource not found')
  }
  const bookmark = await Bookmark.findOneAndUpdate(
    { userId: req.user._id, resourceId: req.params.resourceId },
    {
      userId: req.user._id,
      resourceId: req.params.resourceId,
      universityId: env.UNIVERSITY_ID,
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )
  return successResponse(res, bookmark, 'Resource bookmarked', 201)
}

export async function removeBookmark(req, res) {
  await Bookmark.deleteOne({
    userId: req.user._id,
    resourceId: req.params.resourceId,
  })
  return successResponse(res, null, 'Bookmark removed')
}

export async function addRecentlyViewed(req, res) {
  if (!(await Resource.exists({ _id: req.params.resourceId, ...visibleResource }))) {
    throw new HttpError(404, 'Resource not found')
  }
  await RecentlyViewed.findOneAndUpdate(
    { userId: req.user._id, resourceId: req.params.resourceId },
    {
      userId: req.user._id,
      resourceId: req.params.resourceId,
      universityId: env.UNIVERSITY_ID,
      viewedAt: new Date(),
    },
    { upsert: true, setDefaultsOnInsert: true },
  )
  return successResponse(res, null, 'Recently viewed updated')
}

export async function listRecentlyViewed(req, res) {
  const viewed = await RecentlyViewed.find({
    userId: req.user._id,
    universityId: env.UNIVERSITY_ID,
  })
    .populate({ path: 'resourceId', match: visibleResource })
    .sort({ viewedAt: -1 })
    .limit(20)
    .lean()
  return successResponse(res, viewed.filter((item) => item.resourceId))
}

// ==========================================
// UNIVERSITY EMAIL OTP VERIFICATION
// ==========================================

export async function getUniversityEmailStatus(req, res) {
  const user = await User.findById(req.user._id).select(
    'email universityEmail universityEmailVerifiedAt',
  )
  if (!user) throw new HttpError(404, 'User not found')

  const defaultUniEmail = isValidUniversityEmail(user.email) ? user.email : ''
  const currentEmail = user.universityEmail || defaultUniEmail

  return successResponse(res, {
    universityEmail: currentEmail,
    isVerified: Boolean(user.universityEmailVerifiedAt),
    verifiedAt: user.universityEmailVerifiedAt || null,
  })
}

export async function requestUniversityEmailOtp(req, res) {
  const email = (req.body.email || '').trim().toLowerCase()

  if (!isValidUniversityEmail(email)) {
    throw new HttpError(400, 'Only @silicon.ac.in university email addresses are permitted')
  }

  const user = await User.findById(req.user._id).select(
    '+universityEmailOtpHash +universityEmailOtpExpiresAt +universityEmailOtpAttempts +universityEmailOtpSentAt',
  )
  if (!user) throw new HttpError(404, 'User not found')

  // Check resend cooldown: 60 seconds
  const now = Date.now()
  if (user.universityEmailOtpSentAt && now - user.universityEmailOtpSentAt.getTime() < 60000) {
    const remaining = Math.ceil((60000 - (now - user.universityEmailOtpSentAt.getTime())) / 1000)
    throw new HttpError(429, `Please wait ${remaining} seconds before requesting a new verification code`)
  }

  const otp = generateNumericOtp()
  const otpHash = hashOtp(otp)
  const expiresAt = new Date(now + 10 * 60 * 1000) // 10 minutes

  // If changing university email address, invalidate previous verification
  if (user.universityEmail && user.universityEmail !== email) {
    user.universityEmailVerifiedAt = null
  }

  user.universityEmail = email
  user.universityEmailOtpHash = otpHash
  user.universityEmailOtpExpiresAt = expiresAt
  user.universityEmailOtpAttempts = 0
  user.universityEmailOtpSentAt = new Date(now)
  await user.save()

  // Send OTP email
  const mailResult = await sendOtpEmail({
    to: email,
    recipientName: user.name,
    otp,
    expirationMinutes: 10,
  })

  await recordAudit({
    actorId: user._id,
    action: 'UNIVERSITY_EMAIL_OTP_REQUESTED',
    entityType: 'User',
    entityId: user._id,
    metadata: {
      universityEmail: email,
      deliveryStatus: mailResult.success ? 'SENT' : 'FAILED',
    },
  })

  return successResponse(res, {
    message: 'Verification code sent to your university email address',
    universityEmail: email,
    cooldownSeconds: 60,
    expiresInMinutes: 10,
  })
}

export async function verifyUniversityEmailOtp(req, res) {
  const email = (req.body.email || '').trim().toLowerCase()
  const otp = (req.body.otp || '').trim()

  if (!isValidUniversityEmail(email)) {
    throw new HttpError(400, 'Only @silicon.ac.in university email addresses are permitted')
  }

  if (!/^\d{6}$/.test(otp)) {
    throw new HttpError(400, 'Verification code must be exactly 6 digits')
  }

  const user = await User.findById(req.user._id).select(
    '+universityEmailOtpHash +universityEmailOtpExpiresAt +universityEmailOtpAttempts',
  )
  if (!user) throw new HttpError(404, 'User not found')

  if (!user.universityEmail || user.universityEmail !== email) {
    throw new HttpError(400, 'Verification code was requested for a different email address')
  }

  if (!user.universityEmailOtpHash || !user.universityEmailOtpExpiresAt) {
    throw new HttpError(400, 'No active verification code found. Please request a new code.')
  }

  if (user.universityEmailOtpExpiresAt <= new Date()) {
    throw new HttpError(400, 'Verification code has expired. Please request a new code.')
  }

  if (user.universityEmailOtpAttempts >= 5) {
    throw new HttpError(429, 'Too many failed verification attempts. Please request a new verification code.')
  }

  const incomingHash = hashOtp(otp)
  if (incomingHash !== user.universityEmailOtpHash) {
    user.universityEmailOtpAttempts = (user.universityEmailOtpAttempts || 0) + 1
    await user.save()
    const remaining = 5 - user.universityEmailOtpAttempts
    throw new HttpError(
      400,
      remaining > 0
        ? `Invalid verification code. ${remaining} attempt${remaining === 1 ? '' : 's'} remaining.`
        : 'Invalid verification code. Maximum attempts exceeded. Please request a new code.',
    )
  }

  // Verification succeeded - single use
  user.universityEmailVerifiedAt = new Date()
  user.universityEmailOtpHash = undefined
  user.universityEmailOtpExpiresAt = undefined
  user.universityEmailOtpAttempts = 0
  user.universityEmailOtpSentAt = undefined
  await user.save()

  await recordAudit({
    actorId: user._id,
    action: 'UNIVERSITY_EMAIL_VERIFIED',
    entityType: 'User',
    entityId: user._id,
    metadata: { universityEmail: email },
  })

  return successResponse(res, {
    message: 'University email verified successfully',
    isVerified: true,
    universityEmail: user.universityEmail,
    verifiedAt: user.universityEmailVerifiedAt,
  })
}
