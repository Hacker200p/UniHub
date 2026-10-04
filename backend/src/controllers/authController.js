import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { User } from '../models/User.js'
import { RefreshSession } from '../models/RefreshSession.js'
import { Program, Branch, Semester } from '../models/Academic.js'
import { Notification } from '../models/Notification.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import {
  createAccessToken,
  createFamilyId,
  createOpaqueToken,
  createRefreshToken,
  hashToken,
  parseDurationMs,
} from '../utils/tokens.js'
import { sendLink } from '../services/mailer.js'
import { clearRefreshCookie, getRefreshCookie, setRefreshCookie } from '../utils/refreshCookie.js'
import { recordAudit } from '../utils/audit.js'
import { logger } from '../utils/logger.js'
import {
  createOAuthHandoff,
  createOAuthState,
  exchangeCodeForIdentity,
  getAuthorizationUrl,
  getEnabledProviders,
  validateUniversityDomain,
  verifyOAuthHandoff,
  verifyOAuthState,
} from '../services/oauthService.js'

function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

/**
 * Creates an initial refresh token session with a new family ID.
 */
async function issueNewRefreshSession(user, req) {
  const token = createRefreshToken()
  const familyId = createFamilyId()
  const durationMs = parseDurationMs(env.REFRESH_TOKEN_EXPIRES_IN)
  const expiresAt = new Date(Date.now() + durationMs)

  await RefreshSession.create({
    universityId: user.universityId || env.UNIVERSITY_ID,
    userId: user._id,
    familyId,
    tokenHash: hashToken(token),
    expiresAt,
    userAgent: req?.get ? req.get('user-agent') || '' : '',
    ip: req?.ip || '',
  })

  return token
}

export async function register(req, res) {
  const { name, password, programId, branchId, semesterId } = req.body
  const email = normalizeEmail(req.body.email)

  if (env.AUTH_REQUIRE_UNIVERSITY_EMAIL && !validateUniversityDomain(email)) {
    throw new HttpError(400, 'Registration is restricted to authorized university email domains')
  }

  const program = await Program.findOne({
    _id: programId,
    universityId: env.UNIVERSITY_ID,
    isActive: true,
  })
  if (!program) throw new HttpError(400, 'Invalid program')

  if (
    branchId &&
    !(await Branch.exists({
      _id: branchId,
      programId: program._id,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    }))
  ) {
    throw new HttpError(400, 'Branch does not belong to this program')
  }

  if (
    semesterId &&
    !(await Semester.exists({
      _id: semesterId,
      programId: program._id,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    }))
  ) {
    throw new HttpError(400, 'Semester does not belong to this program')
  }

  if (await User.exists({ universityId: env.UNIVERSITY_ID, email })) {
    throw new HttpError(409, 'An account with this email already exists')
  }

  const passwordHash = await bcrypt.hash(password, 12)
  const verificationToken = createOpaqueToken()
  const user = await User.create({
    universityId: env.UNIVERSITY_ID,
    name,
    email,
    passwordHash,
    programId,
    branchId,
    semesterId,
    emailVerificationHash: hashToken(verificationToken),
    emailVerificationExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
  })

  await sendLink({
    to: email,
    subject: 'Verify your UniHub account',
    text: `${env.CLIENT_URL}/verify-email?token=${verificationToken}`,
  })

  const token = await issueNewRefreshSession(user, req)
  setRefreshCookie(res, token)

  return successResponse(
    res,
    { user: user.toPrivateJSON(), accessToken: createAccessToken(user) },
    'Registration successful',
    201,
  )
}

export async function login(req, res) {
  const email = normalizeEmail(req.body.email)
  const user = await User.findOne({ universityId: env.UNIVERSITY_ID, email }).select('+passwordHash')

  if (!user || !user.isActive || !(await user.comparePassword(req.body.password))) {
    throw new HttpError(401, 'Invalid email or password')
  }

  const token = await issueNewRefreshSession(user, req)
  setRefreshCookie(res, token)

  return successResponse(
    res,
    { user: user.toPrivateJSON(), accessToken: createAccessToken(user) },
    'Login successful',
  )
}

export async function refresh(req, res) {
  const origin = req.get('origin')
  if (origin && origin !== env.CLIENT_URL) {
    throw new HttpError(403, 'Origin is not allowed')
  }

  const token = getRefreshCookie(req)
  if (!token) {
    throw new HttpError(401, 'Invalid refresh session')
  }

  const incomingHash = hashToken(token)
  const now = new Date()
  const durationMs = parseDurationMs(env.REFRESH_TOKEN_EXPIRES_IN)
  const nextRawToken = createRefreshToken()
  const nextTokenHash = hashToken(nextRawToken)
  const nextExpiresAt = new Date(Date.now() + durationMs)

  const activeSession = await RefreshSession.findOneAndUpdate(
    {
      universityId: env.UNIVERSITY_ID,
      tokenHash: incomingHash,
      revokedAt: null,
      expiresAt: { $gt: now },
    },
    {
      $set: {
        revokedAt: now,
        revokedReason: 'ROTATED',
        replacedByTokenHash: nextTokenHash,
        lastUsedAt: now,
      },
    },
    { new: false },
  )

  if (activeSession) {
    const user = await User.findOne({
      _id: activeSession.userId,
      universityId: env.UNIVERSITY_ID,
      isActive: true,
    })

    if (!user) {
      clearRefreshCookie(res)
      throw new HttpError(401, 'Invalid refresh session')
    }

    await RefreshSession.create({
      universityId: env.UNIVERSITY_ID,
      userId: user._id,
      familyId: activeSession.familyId,
      tokenHash: nextTokenHash,
      expiresAt: nextExpiresAt,
      userAgent: req.get('user-agent') || '',
      ip: req.ip || '',
    })

    setRefreshCookie(res, nextRawToken)
    return successResponse(
      res,
      { user: user.toPrivateJSON(), accessToken: createAccessToken(user) },
      'Session refreshed',
    )
  }

  const existingSession = await RefreshSession.findOne({
    universityId: env.UNIVERSITY_ID,
    tokenHash: incomingHash,
  })

  if (!existingSession) {
    clearRefreshCookie(res)
    throw new HttpError(401, 'Invalid refresh session')
  }

  if (existingSession.expiresAt <= now && !existingSession.revokedAt) {
    clearRefreshCookie(res)
    throw new HttpError(401, 'Refresh session expired')
  }

  await RefreshSession.updateMany(
    {
      universityId: env.UNIVERSITY_ID,
      familyId: existingSession.familyId,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: now,
        revokedReason: 'REUSE_DETECTED',
      },
    },
  )

  await recordAudit({
    actorId: existingSession.userId,
    action: 'REFRESH_TOKEN_REUSE_DETECTED',
    entityType: 'RefreshTokenFamily',
    entityId: existingSession.userId,
    reason: 'Reuse of rotated refresh token detected — revoked token family',
    metadata: {
      familyId: existingSession.familyId,
      ip: req.ip || undefined,
      userAgent: req.get('user-agent') || undefined,
    },
  })

  logger.warn('REFRESH_TOKEN_REUSE_DETECTED', {
    userId: existingSession.userId?.toString(),
    familyId: existingSession.familyId,
  })

  clearRefreshCookie(res)
  throw new HttpError(401, 'Invalid refresh session')
}

export async function logout(req, res) {
  const token = getRefreshCookie(req)
  if (token) {
    const incomingHash = hashToken(token)
    await RefreshSession.updateOne(
      {
        universityId: env.UNIVERSITY_ID,
        tokenHash: incomingHash,
        revokedAt: null,
      },
      {
        $set: {
          revokedAt: new Date(),
          revokedReason: 'LOGOUT',
        },
      },
    )
  }

  clearRefreshCookie(res)
  return successResponse(res, null, 'Logged out successfully')
}

export async function logoutAll(req, res) {
  await RefreshSession.updateMany(
    {
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
      revokedAt: null,
    },
    {
      $set: {
        revokedAt: new Date(),
        revokedReason: 'LOGOUT_ALL',
      },
    },
  )

  await recordAudit({
    actorId: req.user._id,
    action: 'LOGOUT_ALL_DEVICES',
    entityType: 'User',
    entityId: req.user._id,
  })

  clearRefreshCookie(res)
  return successResponse(res, null, 'Logged out from all devices')
}

export async function me(req, res) {
  return successResponse(res, { user: req.user.toPrivateJSON() })
}

export async function verifyEmail(req, res) {
  const hash = hashToken(req.body.token)
  const user = await User.findOne({
    universityId: env.UNIVERSITY_ID,
    emailVerificationHash: hash,
    emailVerificationExpiresAt: { $gt: new Date() },
  })

  if (!user) {
    throw new HttpError(400, 'Invalid or expired verification token')
  }

  user.emailVerifiedAt = new Date()
  user.emailVerificationHash = undefined
  user.emailVerificationExpiresAt = undefined
  await user.save()

  await recordAudit({
    actorId: user._id,
    action: 'EMAIL_VERIFIED',
    entityType: 'User',
    entityId: user._id,
  })

  return successResponse(res, { user: user.toPrivateJSON() }, 'Email verified successfully')
}

export async function forgotPassword(req, res) {
  const email = normalizeEmail(req.body.email)
  const user = await User.findOne({ universityId: env.UNIVERSITY_ID, email })
  if (user) {
    const token = createOpaqueToken()
    user.resetPasswordHash = hashToken(token)
    user.resetPasswordExpiresAt = new Date(Date.now() + 60 * 60 * 1000)
    await user.save()

    await sendLink({
      to: email,
      subject: 'Reset your password',
      text: `${env.CLIENT_URL}/reset-password?token=${token}`,
    })
  }

  return successResponse(
    res,
    null,
    'If an account exists with that email, a password reset link has been sent',
  )
}

export async function resetPassword(req, res) {
  const hash = hashToken(req.body.token)
  const user = await User.findOne({
    universityId: env.UNIVERSITY_ID,
    resetPasswordHash: hash,
    resetPasswordExpiresAt: { $gt: new Date() },
  })

  if (!user) {
    throw new HttpError(400, 'Invalid or expired reset token')
  }

  user.passwordHash = await bcrypt.hash(req.body.password, 12)
  user.resetPasswordHash = undefined
  user.resetPasswordExpiresAt = undefined
  await user.save()

  await RefreshSession.updateMany(
    { universityId: env.UNIVERSITY_ID, userId: user._id, revokedAt: null },
    { $set: { revokedAt: new Date(), revokedReason: 'PASSWORD_RESET' } },
  )

  await recordAudit({
    actorId: user._id,
    action: 'PASSWORD_RESET',
    entityType: 'User',
    entityId: user._id,
  })

  return successResponse(res, null, 'Password reset successfully. Please sign in with your new password.')
}

// ==========================================
// SOCIAL OAUTH CONTROLLERS
// ==========================================

export async function getProviders(req, res) {
  return successResponse(res, getEnabledProviders())
}

export async function initiateOAuth(req, res) {
  const { provider } = req.params
  const intent = req.query.intent === 'link' ? 'link' : 'login'
  let userId = null

  if (intent === 'link') {
    // If linking, user must pass valid auth token
    const authHeader = req.headers.authorization
    if (authHeader?.startsWith('Bearer ')) {
      try {
        const decoded = jwt.verify(authHeader.slice(7), env.JWT_SECRET)
        userId = decoded.sub
      } catch {
        throw new HttpError(401, 'Authentication required to link social provider')
      }
    } else {
      throw new HttpError(401, 'Authentication required to link social provider')
    }
  }

  const { stateToken, codeChallenge } = createOAuthState({
    provider,
    intent,
    userId,
  })

  const url = getAuthorizationUrl(provider, stateToken, codeChallenge)

  if (req.query.format === 'json') {
    return successResponse(res, { url, stateToken })
  }

  return res.redirect(url)
}

export async function handleOAuthCallback(req, res) {
  const { provider } = req.params
  const { code, state, error, error_description } = req.query

  if (error || !code || !state) {
    const errorMsg = error_description || error || 'oauth_cancelled'
    logger.warn('OAuth callback rejected', { provider, error: errorMsg })
    return res.redirect(`${env.CLIENT_URL}/login?error=${encodeURIComponent(errorMsg)}`)
  }

  try {
    const statePayload = verifyOAuthState(String(state), provider)
    const identity = await exchangeCodeForIdentity(
      provider,
      String(code),
      statePayload.codeVerifier,
    )

    if (env.AUTH_REQUIRE_UNIVERSITY_EMAIL && !validateUniversityDomain(identity.email)) {
      return res.redirect(
        `${env.CLIENT_URL}/login?error=${encodeURIComponent('Your email domain is not authorized for this platform.')}`,
      )
    }

    if (statePayload.intent === 'link') {
      if (!statePayload.userId) {
        return res.redirect(
          `${env.CLIENT_URL}/settings/security?error=${encodeURIComponent('Authentication session lost during linking')}`,
        )
      }

      const user = await User.findOne({
        _id: statePayload.userId,
        universityId: env.UNIVERSITY_ID,
      })
      if (!user) {
        return res.redirect(
          `${env.CLIENT_URL}/settings/security?error=${encodeURIComponent('User account not found')}`,
        )
      }

      // Check if this provider identity is already connected to another user
      const existingOwner = await User.findOne({
        universityId: env.UNIVERSITY_ID,
        'authProviders.provider': provider,
        'authProviders.providerUserId': identity.providerUserId,
      })

      if (existingOwner && String(existingOwner._id) !== String(user._id)) {
        return res.redirect(
          `${env.CLIENT_URL}/settings/security?error=${encodeURIComponent('This social account is already linked to another user profile.')}`,
        )
      }

      // If not already present on current user, add it
      const alreadyLinked = user.authProviders.some((p) => p.provider === provider)
      if (!alreadyLinked) {
        user.authProviders.push({
          provider,
          providerUserId: identity.providerUserId,
          email: identity.email,
          emailVerified: identity.emailVerified,
          avatarUrl: identity.avatarUrl || '',
          linkedAt: new Date(),
        })

        if (!user.avatarUrl && identity.avatarUrl) {
          user.avatarUrl = identity.avatarUrl
        }

        await user.save()

        await Notification.create({
          universityId: env.UNIVERSITY_ID,
          userId: user._id,
          type: 'SECURITY_ALERT',
          title: `Connected ${provider.toUpperCase()} Account`,
          message: `Your ${provider} account (${identity.email || identity.providerUserId}) is now linked for single sign-on.`,
        })

        await recordAudit({
          actorId: user._id,
          action: 'AUTH_PROVIDER_LINKED',
          entityType: 'User',
          entityId: user._id,
          metadata: { provider, email: identity.email },
        })
      }

      return res.redirect(
        `${env.CLIENT_URL}/settings/security?success=${encodeURIComponent(`Successfully connected ${provider.toUpperCase()}`)}`,
      )
    }

    // Standard Login / Registration Intent
    let user = await User.findOne({
      universityId: env.UNIVERSITY_ID,
      'authProviders.provider': provider,
      'authProviders.providerUserId': identity.providerUserId,
    })

    if (!user) {
      // Check if user with that email already exists
      const emailUser = identity.email
        ? await User.findOne({ universityId: env.UNIVERSITY_ID, email: identity.email })
        : null

      if (emailUser) {
        // Safe account merging principle: require user to log in and link from settings
        return res.redirect(
          `${env.CLIENT_URL}/login?error=${encodeURIComponent('An account with this email already exists. Please log in with your existing password and connect this provider under Settings > Connected Accounts.')}&email=${encodeURIComponent(identity.email)}`,
        )
      }

      // Register new user with strict STUDENT role
      const defaultProgram = await Program.findOne({
        universityId: env.UNIVERSITY_ID,
        isActive: true,
      })

      user = await User.create({
        universityId: env.UNIVERSITY_ID,
        name: identity.name || `${provider} Student`,
        email: identity.email || `${provider}_${identity.providerUserId}@university.local`,
        role: 'STUDENT',
        programId: defaultProgram?._id,
        avatarUrl: identity.avatarUrl || '',
        emailVerifiedAt: identity.emailVerified ? new Date() : null,
        authProviders: [
          {
            provider,
            providerUserId: identity.providerUserId,
            email: identity.email,
            emailVerified: identity.emailVerified,
            avatarUrl: identity.avatarUrl || '',
            linkedAt: new Date(),
          },
        ],
      })

      await recordAudit({
        actorId: user._id,
        action: 'AUTH_SOCIAL_REGISTER',
        entityType: 'User',
        entityId: user._id,
        metadata: { provider, email: identity.email },
      })
    }

    if (!user.isActive) {
      return res.redirect(
        `${env.CLIENT_URL}/login?error=${encodeURIComponent('Your student account is currently suspended.')}`,
      )
    }

    const rawRefreshToken = await issueNewRefreshSession(user, req)
    setRefreshCookie(res, rawRefreshToken)

    const handoffCode = createOAuthHandoff(user)
    return res.redirect(`${env.CLIENT_URL}/auth/callback?code=${encodeURIComponent(handoffCode)}`)
  } catch (err) {
    logger.error('OAuth processing failure', { provider, error: err.message })
    return res.redirect(
      `${env.CLIENT_URL}/login?error=${encodeURIComponent(err.message || 'Social sign-in failed. Please try again.')}`,
    )
  }
}

export async function exchangeOAuthCode(req, res) {
  const { code } = req.body
  if (!code) throw new HttpError(400, 'Exchange code is required')

  const decoded = verifyOAuthHandoff(code)
  const user = await User.findOne({
    _id: decoded.sub,
    universityId: env.UNIVERSITY_ID,
    isActive: true,
  })

  if (!user) {
    throw new HttpError(401, 'User account not found or inactive')
  }

  return successResponse(
    res,
    {
      user: user.toPrivateJSON(),
      accessToken: createAccessToken(user),
    },
    'Authentication exchange successful',
  )
}
