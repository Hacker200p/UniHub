import { Router } from 'express'
import {
  exchangeOAuthCode,
  forgotPassword,
  getProviders,
  handleOAuthCallback,
  initiateOAuth,
  login,
  logout,
  logoutAll,
  me,
  register,
  resetPassword,
  refresh,
  verifyResetOtp,
  verifyEmail,
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyResetOtpSchema,
  verifyEmailSchema,
} from '../validators/auth.js'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

export const authRouter = Router()

// Strict brute-force limiter for password authentication & credentials
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' ? 10000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    return res.status(429).json({
      success: false,
      message: 'Too many authentication attempts. Please try again later.',
    })
  },
})

// Dedicated rate limiter for OAuth flows
const oauthLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' ? 10000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  handler: (req, res) => {
    if (req.accepts('html')) {
      return res.redirect(
        `${env.CLIENT_URL}/login?error=too_many_requests&message=${encodeURIComponent('Too many OAuth attempts. Please try again later.')}`,
      )
    }
    return res.status(429).json({
      success: false,
      message: 'Too many OAuth attempts. Please try again later.',
    })
  },
})

// Core Authentication
authRouter.post('/register', authLimiter, validate(registerSchema), register)
authRouter.post('/login', authLimiter, validate(loginSchema), login)
authRouter.post('/logout', logout)
authRouter.post('/logout-all', requireAuth, logoutAll)
authRouter.get('/me', requireAuth, me)
authRouter.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), forgotPassword)
authRouter.post('/forgot-password/verify', authLimiter, validate(verifyResetOtpSchema), verifyResetOtp)
authRouter.post('/reset-password', authLimiter, validate(resetPasswordSchema), resetPassword)
authRouter.post('/refresh', refresh)
authRouter.post('/verify-email', validate(verifyEmailSchema), verifyEmail)

// Social OAuth
authRouter.get('/providers', getProviders)
authRouter.post('/oauth/exchange', oauthLimiter, exchangeOAuthCode)

// Provider-specific OAuth start & callback routes
authRouter.get('/google', oauthLimiter, (req, res, next) => {
  req.params.provider = 'google'
  return initiateOAuth(req, res, next)
})
authRouter.get('/google/callback', oauthLimiter, (req, res, next) => {
  req.params.provider = 'google'
  return handleOAuthCallback(req, res, next)
})

authRouter.get('/github', oauthLimiter, (req, res, next) => {
  req.params.provider = 'github'
  return initiateOAuth(req, res, next)
})
authRouter.get('/github/callback', oauthLimiter, (req, res, next) => {
  req.params.provider = 'github'
  return handleOAuthCallback(req, res, next)
})

authRouter.get('/microsoft', oauthLimiter, (req, res, next) => {
  req.params.provider = 'microsoft'
  return initiateOAuth(req, res, next)
})
authRouter.get('/microsoft/callback', oauthLimiter, (req, res, next) => {
  req.params.provider = 'microsoft'
  return handleOAuthCallback(req, res, next)
})

// Generic parameter matching fallback
authRouter.get('/:provider', oauthLimiter, initiateOAuth)
authRouter.get('/:provider/callback', oauthLimiter, handleOAuthCallback)
