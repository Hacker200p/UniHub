import { ZodError } from 'zod'
import { errorResponse } from '../utils/apiResponse.js'
import { logger } from '../utils/logger.js'

export function notFoundHandler(req, res) {
  return errorResponse(res, `Route not found: ${req.method} ${req.originalUrl}`, 404)
}

export function errorHandler(error, req, res, next) {
  if (res.headersSent) return next(error)
  if (error instanceof ZodError) return errorResponse(res, 'Validation failed', 400, error.flatten())
  if (error.code === 11000) return errorResponse(res, 'A record with these values already exists', 409)
  const statusCode = error.statusCode || 500
  const message = statusCode >= 500 ? 'Internal server error' : error.message
  if (statusCode >= 500) logger.error('unhandled_error', { method: req.method, path: req.originalUrl, error: error.message })
  return errorResponse(res, message, statusCode, error.details)
}
