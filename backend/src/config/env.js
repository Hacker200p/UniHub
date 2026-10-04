import 'dotenv/config'
import { z } from 'zod'

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGO_URI: z.string().min(1),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  COOKIE_SECURE: z.string().transform((value) => value === 'true').default('false'),
  COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  UNIVERSITY_ID: z.string().min(1).default('demo-university'),
  ADMIN_EMAIL: z.string().email().optional(),
  ADMIN_PASSWORD: z.string().min(12).optional(),
  SMTP_HOST: z.string().optional(),
  SMTP_PORT: z.coerce.number().int().positive().default(587),
  SMTP_USER: z.string().optional(),
  SMTP_PASSWORD: z.string().optional(),
  SMTP_FROM: z.string().email().default('no-reply@university-study-hub.local'),
  STORAGE_PROVIDER: z.enum(['local', 's3']).default('local'),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(30),
  UPLOAD_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),

  // Social Login: Google
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/google/callback'),

  // Social Login: GitHub
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/github/callback'),

  // Social Login: Microsoft
  MICROSOFT_CLIENT_ID: z.string().optional(),
  MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MICROSOFT_CALLBACK_URL: z.string().default('http://localhost:4000/api/auth/microsoft/callback'),

  // University Domain Policy
  AUTH_REQUIRE_UNIVERSITY_EMAIL: z.string().transform((value) => value === 'true').default('false'),
  ALLOWED_EMAIL_DOMAINS: z.string().default('silicon.ac.in,university.edu'),
})

const parsed = envSchema.safeParse(process.env)
if (!parsed.success) {
  console.error(parsed.error.flatten().fieldErrors)
  throw new Error('Invalid environment configuration')
}

if (
  parsed.data.NODE_ENV === 'production' &&
  (!parsed.data.COOKIE_SECURE ||
    (parsed.data.COOKIE_SAMESITE === 'none' && !parsed.data.CLIENT_URL.startsWith('https://')))
) {
  throw new Error('Production cookies require COOKIE_SECURE=true and a compatible HTTPS configuration')
}

export const env = parsed.data
