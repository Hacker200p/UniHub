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
  verifyEmail,
} from '../controllers/authController.js'
import { requireAuth } from '../middleware/auth.js'
import { validate } from '../middleware/validate.js'
import {
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../validators/auth.js'
import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

export const authRouter = Router()
const authLimiter = rateLimit({
  windowMs: env.RATE_LIMIT_WINDOW_MS,
  limit: env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' ? 10000 : env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
})

authRouter.use(authLimiter)

// Core Authentication
authRouter.post('/register', validate(registerSchema), register)
authRouter.post('/login', validate(loginSchema), login)
authRouter.post('/logout', logout)
authRouter.post('/logout-all', requireAuth, logoutAll)
authRouter.get('/me', requireAuth, me)
authRouter.post('/forgot-password', validate(forgotPasswordSchema), forgotPassword)
authRouter.post('/reset-password', validate(resetPasswordSchema), resetPassword)
authRouter.post('/refresh', refresh)
authRouter.post('/verify-email', validate(verifyEmailSchema), verifyEmail)

// Social OAuth
authRouter.get('/providers', getProviders)
authRouter.post('/oauth/exchange', exchangeOAuthCode)

// Provider-specific OAuth start & callback routes
authRouter.get('/google', (req, res, next) => {
  req.params.provider = 'google'
  return initiateOAuth(req, res, next)
})
authRouter.get('/google/callback', (req, res, next) => {
  req.params.provider = 'google'
  return handleOAuthCallback(req, res, next)
})

authRouter.get('/github', (req, res, next) => {
  req.params.provider = 'github'
  return initiateOAuth(req, res, next)
})
authRouter.get('/github/callback', (req, res, next) => {
  req.params.provider = 'github'
  return handleOAuthCallback(req, res, next)
})

authRouter.get('/microsoft', (req, res, next) => {
  req.params.provider = 'microsoft'
  return initiateOAuth(req, res, next)
})
authRouter.get('/microsoft/callback', (req, res, next) => {
  req.params.provider = 'microsoft'
  return handleOAuthCallback(req, res, next)
})

// Generic parameter matching fallback
authRouter.get('/:provider', initiateOAuth)
authRouter.get('/:provider/callback', handleOAuthCallback)
