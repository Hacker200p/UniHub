import crypto from 'node:crypto'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { HttpError } from '../utils/httpError.js'

export function getEnabledProviders() {
  return {
    google: Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    github: Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
    microsoft: Boolean(env.MICROSOFT_CLIENT_ID && env.MICROSOFT_CLIENT_SECRET),
  }
}

export function validateUniversityDomain(email) {
  if (!env.AUTH_REQUIRE_UNIVERSITY_EMAIL) return true
  if (!email || typeof email !== 'string') return false
  const allowed = (env.ALLOWED_EMAIL_DOMAINS || '')
    .split(',')
    .map((d) => d.trim().toLowerCase())
    .filter(Boolean)
  if (allowed.length === 0) return true
  const domain = email.split('@')[1]?.toLowerCase()
  if (!domain) return false
  return allowed.some((allowedDomain) => domain === allowedDomain || domain.endsWith(`.${allowedDomain}`))
}

/**
 * Creates cryptographically secure state with PKCE parameters.
 */
export function createOAuthState({ provider, intent = 'login', userId = null }) {
  const nonce = crypto.randomBytes(24).toString('hex')
  const codeVerifier = crypto.randomBytes(32).toString('base64url')
  const codeChallenge = crypto
    .createHash('sha256')
    .update(codeVerifier)
    .digest('base64url')

  const payload = {
    nonce,
    provider,
    intent,
    userId: userId ? String(userId) : null,
    codeVerifier,
  }

  const stateToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: '10m',
    issuer: 'university-study-hub',
    audience: 'oauth-state',
  })

  return { stateToken, codeChallenge, codeVerifier }
}

/**
 * Verifies the incoming state parameter and returns the original intent and PKCE verifier.
 */
export function verifyOAuthState(stateToken, expectedProvider) {
  try {
    const decoded = jwt.verify(stateToken, env.JWT_SECRET, {
      issuer: 'university-study-hub',
      audience: 'oauth-state',
    })

    if (decoded.provider !== expectedProvider) {
      throw new HttpError(400, 'OAuth provider mismatch in state verification')
    }

    return decoded
  } catch (err) {
    if (err instanceof HttpError) throw err
    throw new HttpError(400, 'Invalid or expired OAuth state parameter')
  }
}

/**
 * Builds the provider authorization redirect URL.
 */
export function getAuthorizationUrl(provider, stateToken, codeChallenge) {
  switch (provider) {
    case 'google': {
      if (!env.GOOGLE_CLIENT_ID) throw new HttpError(503, 'Google authentication is not configured')
      const params = new URLSearchParams({
        client_id: env.GOOGLE_CLIENT_ID,
        redirect_uri: env.GOOGLE_CALLBACK_URL,
        response_type: 'code',
        scope: 'openid email profile',
        state: stateToken,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        access_type: 'offline',
        prompt: 'select_account',
      })
      return `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`
    }

    case 'github': {
      if (!env.GITHUB_CLIENT_ID) throw new HttpError(503, 'GitHub authentication is not configured')
      const params = new URLSearchParams({
        client_id: env.GITHUB_CLIENT_ID,
        redirect_uri: env.GITHUB_CALLBACK_URL,
        scope: 'read:user user:email',
        state: stateToken,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
      })
      return `https://github.com/login/oauth/authorize?${params.toString()}`
    }

    case 'microsoft': {
      if (!env.MICROSOFT_CLIENT_ID) throw new HttpError(503, 'Microsoft authentication is not configured')
      const params = new URLSearchParams({
        client_id: env.MICROSOFT_CLIENT_ID,
        redirect_uri: env.MICROSOFT_CALLBACK_URL,
        response_type: 'code',
        scope: 'openid email profile User.Read',
        state: stateToken,
        code_challenge: codeChallenge,
        code_challenge_method: 'S256',
        response_mode: 'query',
      })
      return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?${params.toString()}`
    }

    default:
      throw new HttpError(400, `Unsupported OAuth provider: ${provider}`)
  }
}

/**
 * Exchanges the authorization code with the provider and returns identity claims.
 */
export async function exchangeCodeForIdentity(provider, code, codeVerifier) {
  switch (provider) {
    case 'google': {
      const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          code,
          client_id: env.GOOGLE_CLIENT_ID,
          client_secret: env.GOOGLE_CLIENT_SECRET,
          redirect_uri: env.GOOGLE_CALLBACK_URL,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      })

      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new HttpError(400, tokenData.error_description || 'Failed to exchange Google OAuth code')
      }

      const userRes = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const userinfo = await userRes.json()
      if (!userRes.ok || !userinfo.sub) {
        throw new HttpError(400, 'Failed to retrieve Google user profile')
      }

      return {
        providerUserId: String(userinfo.sub),
        email: (userinfo.email || '').trim().toLowerCase(),
        emailVerified: Boolean(userinfo.email_verified),
        name: userinfo.name || userinfo.given_name || 'Google User',
        avatarUrl: userinfo.picture || '',
      }
    }

    case 'github': {
      const tokenBody = {
        client_id: env.GITHUB_CLIENT_ID,
        client_secret: env.GITHUB_CLIENT_SECRET,
        code,
        redirect_uri: env.GITHUB_CALLBACK_URL,
      }
      if (codeVerifier) {
        tokenBody.code_verifier = codeVerifier
      }

      const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(tokenBody),
      })

      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new HttpError(400, tokenData.error_description || 'Failed to exchange GitHub OAuth code')
      }

      const userRes = await fetch('https://api.github.com/user', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'University-Study-Hub-Auth',
        },
      })
      const userinfo = await userRes.json()
      if (!userRes.ok || !userinfo.id) {
        throw new HttpError(400, 'Failed to retrieve GitHub user profile')
      }

      // Fetch user emails to get verified primary email
      const emailRes = await fetch('https://api.github.com/user/emails', {
        headers: {
          Authorization: `Bearer ${tokenData.access_token}`,
          'User-Agent': 'University-Study-Hub-Auth',
        },
      })
      const emails = await emailRes.json().catch(() => [])
      let primaryEmail = ''
      let isVerified = false

      if (Array.isArray(emails) && emails.length > 0) {
        const primary = emails.find((e) => e.primary && e.verified) || emails.find((e) => e.verified) || emails[0]
        primaryEmail = primary?.email || ''
        isVerified = Boolean(primary?.verified)
      } else if (userinfo.email) {
        primaryEmail = userinfo.email
        isVerified = true
      }

      return {
        providerUserId: String(userinfo.id),
        email: (primaryEmail || '').trim().toLowerCase(),
        emailVerified: isVerified,
        name: userinfo.name || userinfo.login || 'GitHub User',
        avatarUrl: userinfo.avatar_url || '',
      }
    }

    case 'microsoft': {
      const tokenRes = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: env.MICROSOFT_CLIENT_ID,
          client_secret: env.MICROSOFT_CLIENT_SECRET,
          code,
          redirect_uri: env.MICROSOFT_CALLBACK_URL,
          grant_type: 'authorization_code',
          code_verifier: codeVerifier,
        }).toString(),
      })

      const tokenData = await tokenRes.json()
      if (!tokenRes.ok || !tokenData.access_token) {
        throw new HttpError(400, tokenData.error_description || 'Failed to exchange Microsoft OAuth code')
      }

      const userRes = await fetch('https://graph.microsoft.com/v1.0/me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      })
      const userinfo = await userRes.json()
      if (!userRes.ok || !userinfo.id) {
        throw new HttpError(400, 'Failed to retrieve Microsoft user profile')
      }

      const email = (userinfo.mail || userinfo.userPrincipalName || '').trim().toLowerCase()

      return {
        providerUserId: String(userinfo.id),
        email,
        emailVerified: true,
        name: userinfo.displayName || 'Microsoft User',
        avatarUrl: '',
      }
    }

    default:
      throw new HttpError(400, `Unsupported OAuth provider: ${provider}`)
  }
}

/**
 * Single-use ticket generation for secure frontend authentication handoff.
 */
export function createOAuthHandoff(user) {
  return jwt.sign(
    {
      sub: String(user._id),
      universityId: user.universityId,
    },
    env.JWT_SECRET,
    {
      expiresIn: '5m',
      issuer: 'university-study-hub',
      audience: 'oauth-handoff',
    },
  )
}

export function verifyOAuthHandoff(code) {
  try {
    return jwt.verify(code, env.JWT_SECRET, {
      issuer: 'university-study-hub',
      audience: 'oauth-handoff',
      clockTolerance: 15,
    })
  } catch {
    throw new HttpError(401, 'Invalid or expired authentication handoff ticket')
  }
}
