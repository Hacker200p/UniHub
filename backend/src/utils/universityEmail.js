import crypto from 'node:crypto'

export const UNIVERSITY_EMAIL_DOMAIN = 'silicon.ac.in'

/**
 * Validates that an email address belongs specifically to the silicon.ac.in domain.
 * Performs a strict case-insensitive domain match.
 */
export function isValidUniversityEmail(email) {
  if (!email || typeof email !== 'string') return false
  const trimmed = email.trim().toLowerCase()
  const parts = trimmed.split('@')
  if (parts.length !== 2) return false

  const [localPart, domainPart] = parts
  if (!localPart || !domainPart) return false

  // Disallow control characters or whitespace in local part
  if (/\s/.test(localPart) || localPart.length > 64) return false

  // Case-insensitive exact match to domain 'silicon.ac.in'
  return domainPart === UNIVERSITY_EMAIL_DOMAIN
}

/**
 * Generates a cryptographically secure 6-digit numeric OTP.
 */
export function generateNumericOtp() {
  return crypto.randomInt(100000, 1000000).toString()
}

/**
 * Creates a SHA-256 hash of the OTP for secure database storage.
 */
export function hashOtp(otp) {
  return crypto.createHash('sha256').update(String(otp).trim()).digest('hex')
}
