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
  STORAGE_PROVIDER: z.enum(['local', 's3', 'r2', 'b2', 'google-drive']).default('local'),
  STORAGE_ENABLED_PROVIDERS: z.string().default('local'),
  STORAGE_DEFAULT_PROVIDER: z.enum(['local', 's3', 'r2', 'b2', 'google-drive']).optional(),
  STORAGE_UPLOAD_POLICY: z.enum(['default', 'admin-selected']).default('default'),
  STORAGE_STAGING_PROVIDER: z.preprocess(
    (value) => value === '' ? undefined : value,
    z.enum(['local', 's3', 'r2', 'b2', 'google-drive']).optional(),
  ),
  STORAGE_STAGING_PROVIDERS: z.preprocess((value) => value === '' ? undefined : value, z.string().default('')),
  RETENTION_ENABLED: z.string().transform((value) => value === 'true').default('false'),
  RETENTION_DAYS: z.coerce.number().int().positive().default(120),
  RETENTION_JOB_INTERVAL_MS: z.coerce.number().int().positive().default(3600000),
  STORAGE_BUCKET: z.string().optional(),
  STORAGE_REGION: z.string().default('auto'),
  STORAGE_ENDPOINT: z.string().url().optional(),
  STORAGE_ACCESS_KEY: z.string().optional(),
  STORAGE_SECRET_KEY: z.string().optional(),
  STORAGE_PUBLIC_BASE_URL: z.string().url().optional(),
  R2_ENDPOINT: z.string().url().optional(),
  R2_BUCKET: z.string().optional(),
  R2_REGION: z.string().default('auto'),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  B2_ENDPOINT: z.string().url().optional(),
  B2_BUCKET: z.string().optional(),
  B2_REGION: z.string().default('us-west-004'),
  B2_ACCESS_KEY_ID: z.string().optional(),
  B2_SECRET_ACCESS_KEY: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_ID: z.string().optional(),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_DRIVE_REFRESH_TOKEN: z.string().optional(),
  GOOGLE_DRIVE_FOLDER_ID: z.string().optional(),
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

const requestedProviders = parsed.data.STORAGE_ENABLED_PROVIDERS
  .split(',')
  .map((provider) => provider.trim().toLowerCase())
  .filter(Boolean)
if (requestedProviders.some((provider) => !['local', 's3', 'r2', 'b2', 'google-drive'].includes(provider))) {
  throw new Error('STORAGE_ENABLED_PROVIDERS contains an unsupported provider')
}
const requestedStagingProviders = (parsed.data.STORAGE_STAGING_PROVIDERS || parsed.data.STORAGE_STAGING_PROVIDER || '')
  .split(',')
  .map((provider) => provider.trim().toLowerCase())
  .filter(Boolean)
if (requestedStagingProviders.some((provider) => !['s3', 'r2', 'b2'].includes(provider))) {
  throw new Error('STORAGE_STAGING_PROVIDERS contains an unsupported provider')
}

if (
  parsed.data.NODE_ENV === 'production' &&
  (!parsed.data.COOKIE_SECURE ||
    (parsed.data.COOKIE_SAMESITE === 'none' && !parsed.data.CLIENT_URL.startsWith('https://')))
) {
  throw new Error('Production cookies require COOKIE_SECURE=true and a compatible HTTPS configuration')
}

export const env = parsed.data

const configuredProviders = new Set(
  requestedProviders,
)
if (parsed.data.STORAGE_PROVIDER !== 'local') configuredProviders.add(parsed.data.STORAGE_PROVIDER)
for (const provider of requestedStagingProviders) configuredProviders.add(provider)
if (!configuredProviders.size) configuredProviders.add('local')

const defaultProvider = parsed.data.STORAGE_DEFAULT_PROVIDER || (
  parsed.data.STORAGE_PROVIDER !== 'local' ? parsed.data.STORAGE_PROVIDER : 'local'
)
export const storageConfig = {
  enabledProviders: [...configuredProviders],
  defaultProvider,
  stagingProvider: requestedStagingProviders[0],
  stagingProviders: requestedStagingProviders,
  uploadPolicy: parsed.data.STORAGE_UPLOAD_POLICY,
}

for (const provider of configuredProviders) {
  if (provider === 's3' && (!parsed.data.STORAGE_BUCKET || !parsed.data.STORAGE_ACCESS_KEY || !parsed.data.STORAGE_SECRET_KEY)) {
    throw new Error('S3 storage is enabled but STORAGE_BUCKET, STORAGE_ACCESS_KEY, and STORAGE_SECRET_KEY are incomplete')
  }
  if (provider === 'google-drive' && (!parsed.data.GOOGLE_DRIVE_CLIENT_ID || !parsed.data.GOOGLE_DRIVE_CLIENT_SECRET || !parsed.data.GOOGLE_DRIVE_REFRESH_TOKEN)) {
    throw new Error('Google Drive storage is enabled but its OAuth client and refresh-token settings are incomplete')
  }
  if (provider === 'r2' && (!parsed.data.R2_ENDPOINT || !parsed.data.R2_BUCKET || !parsed.data.R2_ACCESS_KEY_ID || !parsed.data.R2_SECRET_ACCESS_KEY)) {
    throw new Error('R2 storage is enabled but R2_ENDPOINT, R2_BUCKET, R2_ACCESS_KEY_ID, and R2_SECRET_ACCESS_KEY are incomplete')
  }
  if (provider === 'b2' && (!parsed.data.B2_ENDPOINT || !parsed.data.B2_BUCKET || !parsed.data.B2_ACCESS_KEY_ID || !parsed.data.B2_SECRET_ACCESS_KEY)) {
    throw new Error('B2 storage is enabled but B2_ENDPOINT, B2_BUCKET, B2_ACCESS_KEY_ID, and B2_SECRET_ACCESS_KEY are incomplete')
  }
}
if (!configuredProviders.has(defaultProvider)) {
  throw new Error('STORAGE_DEFAULT_PROVIDER must be one of STORAGE_ENABLED_PROVIDERS')
}
