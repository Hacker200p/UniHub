export function successResponse(res, data = null, message = 'OK', statusCode = 200) {
  return res.status(statusCode).json({ success: true, message, data })
}

export function errorResponse(res, message, statusCode = 500, details = undefined) {
  const payload = { success: false, message }
  if (details && process.env.NODE_ENV !== 'production') payload.details = details
  return res.status(statusCode).json(payload)
}
