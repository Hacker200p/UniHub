import { z } from 'zod'

const password = z.string().min(12).max(128)
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')

export const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().email().max(254),
  password,
})

export const loginSchema = z.object({
  email: z.string().trim().email(),
  password: z.string().min(1).max(128),
})

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email(),
})

export const resetPasswordSchema = z.object({
  grant: z.string().min(32),
  password,
})

export const verifyResetOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().regex(/^\d{6}$/, 'Reset code must be exactly 6 digits'),
})

export const refreshSchema = z.object({
  refreshToken: z.string().min(32),
})

export const verifyEmailSchema = z.object({
  token: z.string().min(32),
})

export const profileUpdateSchema = z.object({
  name: z.string().trim().min(2).max(100).optional(),
  bio: z.string().trim().max(500).optional(),
  avatarUrl: z.string().url().or(z.literal('')).optional(),
  githubUrl: z.string().url().or(z.literal('')).optional(),
  linkedinUrl: z.string().url().or(z.literal('')).optional(),
  programId: objectId.optional(),
  branchId: objectId.optional(),
  semesterId: objectId.optional(),
  publicProfile: z.boolean().optional(),
  privacySettings: z
    .object({
      showAvatar: z.boolean().optional(),
      showBio: z.boolean().optional(),
      showGithub: z.boolean().optional(),
      showLinkedin: z.boolean().optional(),
      showAcademicInfo: z.boolean().optional(),
    })
    .optional(),
})

export const setPasswordSchema = z
  .object({
    password: password.optional(),
    newPassword: password.optional(),
    confirmPassword: z.string().optional(),
    currentPassword: z.string().optional(),
  })
  .refine((data) => data.password || data.newPassword, {
    message: 'Password is required and must be at least 12 characters',
  })

export const unlinkProviderSchema = z.object({
  provider: z.enum(['google', 'github', 'microsoft']),
})

export const privacyUpdateSchema = z.object({
  publicProfile: z.boolean().optional(),
  showAvatar: z.boolean().optional(),
  showBio: z.boolean().optional(),
  showGithub: z.boolean().optional(),
  showLinkedin: z.boolean().optional(),
  showAcademicInfo: z.boolean().optional(),
  privacySettings: z
    .object({
      showAvatar: z.boolean().optional(),
      showBio: z.boolean().optional(),
      showGithub: z.boolean().optional(),
      showLinkedin: z.boolean().optional(),
      showAcademicInfo: z.boolean().optional(),
    })
    .optional(),
})

export const requestUniversityEmailOtpSchema = z.object({
  email: z.string().trim().email().max(254),
})

export const verifyUniversityEmailOtpSchema = z.object({
  email: z.string().trim().email().max(254),
  otp: z.string().trim().regex(/^\d{6}$/, 'Verification code must be exactly 6 digits'),
})
