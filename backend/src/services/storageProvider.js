import crypto from 'node:crypto'
import { Readable } from 'node:stream'
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3'
import { env, storageConfig } from '../config/env.js'
import * as localStorage from './localStorage.js'

const PROVIDERS = new Set(['local', 's3', 'r2', 'b2', 'google-drive'])
let googleFolderId = null
let googleFolderPromise = null
let stagingRoundRobinIndex = 0

function configuredStagingProviders() {
  return storageConfig.stagingProviders.length
    ? storageConfig.stagingProviders
    : (storageConfig.stagingProvider ? [storageConfig.stagingProvider] : [])
}

function getProviderName(resourceOrName) {
  const name = typeof resourceOrName === 'string'
    ? resourceOrName
    : resourceOrName?.file?.provider || (resourceOrName?.file?.storageKey && env.STORAGE_PROVIDER === 's3' ? 's3' : 'local')
  return PROVIDERS.has(name) ? name : 'local'
}

function resourceFileId(resource) {
  return resource?.file?.providerFileId || resource?.file?.storageKey
}

export function resourceProvider(resource) {
  return getProviderName(resource)
}

function toNodeStream(body) {
  return body?.getReader ? Readable.fromWeb(body) : body
}

async function getGoogleAccessToken() {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: env.GOOGLE_DRIVE_CLIENT_ID,
      client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_DRIVE_REFRESH_TOKEN,
      grant_type: 'refresh_token',
    }),
  })
  const body = await response.json().catch(() => ({}))
  if (!response.ok || !body.access_token) {
    const error = new Error('Google Drive authorization failed')
    error.code = response.status === 401 ? 'GOOGLE_CREDENTIALS_EXPIRED' : 'GOOGLE_AUTH_FAILED'
    throw error
  }
  return body.access_token
}

async function googleRequest(url, options = {}) {
  const token = await getGoogleAccessToken()
  const response = await fetch(url, {
    ...options,
    headers: { Authorization: `Bearer ${token}`, ...(options.headers || {}) },
  })
  if (!response.ok) {
    const error = new Error(`Google Drive request failed (${response.status})`)
    error.code = response.status === 401 ? 'GOOGLE_CREDENTIALS_EXPIRED' : response.status === 404 ? 'FILE_NOT_FOUND' : 'GOOGLE_DRIVE_ERROR'
    throw error
  }
  return response
}

async function ensureGoogleFolder() {
  if (env.GOOGLE_DRIVE_FOLDER_ID) return env.GOOGLE_DRIVE_FOLDER_ID
  if (googleFolderId) return googleFolderId
  if (!googleFolderPromise) {
    googleFolderPromise = (async () => {
      const query = new URLSearchParams({
        q: "name = 'UniHub Resources' and mimeType = 'application/vnd.google-apps.folder' and trashed = false",
        spaces: 'drive',
        fields: 'files(id,name,mimeType)',
        pageSize: '1000',
      })
      const existingResponse = await googleRequest(`https://www.googleapis.com/drive/v3/files?${query.toString()}`)
      const existing = await existingResponse.json()
      const folders = Array.isArray(existing.files) ? existing.files : []
      if (folders.length > 1) {
        const error = new Error('Multiple accessible Google Drive folders named "UniHub Resources" were found. Select a canonical folder and configure GOOGLE_DRIVE_FOLDER_ID.')
        error.code = 'GOOGLE_DRIVE_FOLDER_AMBIGUOUS'
        throw error
      }
      if (folders.length === 1) {
        if (!folders[0].id) {
          throw new Error('The existing UniHub Resources folder could not be identified. Configure GOOGLE_DRIVE_FOLDER_ID with the canonical folder ID.')
        }
        googleFolderId = folders[0].id
        return googleFolderId
      }

      const response = await googleRequest('https://www.googleapis.com/drive/v3/files', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          name: 'UniHub Resources',
          mimeType: 'application/vnd.google-apps.folder',
        }),
      })
      const body = await response.json()
      if (!body.id) {
        throw new Error('Google Drive folder creation returned no folder ID')
      }
      googleFolderId = body.id
      return googleFolderId
    })().catch((error) => {
      googleFolderPromise = null
      throw error
    })
  }
  return googleFolderPromise
}

async function uploadGoogleDrive(file) {
  const folderId = await ensureGoogleFolder()
  const boundary = `unihub-${crypto.randomUUID()}`
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const metadata = JSON.stringify({
    name: `${sha256}.pdf`,
    parents: [folderId],
    mimeType: file.mimetype,
  })
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`),
    Buffer.from(`--${boundary}\r\nContent-Type: ${file.mimetype}\r\n\r\n`),
    file.buffer,
    Buffer.from(`\r\n--${boundary}--`),
  ])
  const response = await googleRequest('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,size,mimeType,modifiedTime', {
    method: 'POST',
    headers: { 'Content-Type': `multipart/related; boundary=${boundary}`, 'Content-Length': String(body.length) },
    body,
  })
  const uploaded = await response.json()
  return {
    provider: 'google-drive',
    url: `/api/resources/__RESOURCE_ID__/file`,
    storageKey: `${sha256}.pdf`,
    providerFileId: uploaded.id,
    folderId,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    status: 'READY',
    storedAt: new Date(),
  }

}

const s3ProviderConfig = {
  s3: {
    endpoint: env.STORAGE_ENDPOINT,
    bucket: env.STORAGE_BUCKET,
    region: env.STORAGE_REGION,
    accessKeyId: env.STORAGE_ACCESS_KEY,
    secretAccessKey: env.STORAGE_SECRET_KEY,
  },
  r2: {
    endpoint: env.R2_ENDPOINT,
    bucket: env.R2_BUCKET,
    region: env.R2_REGION,
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
  b2: {
    endpoint: env.B2_ENDPOINT,
    bucket: env.B2_BUCKET,
    region: env.B2_REGION,
    accessKeyId: env.B2_ACCESS_KEY_ID,
    secretAccessKey: env.B2_SECRET_ACCESS_KEY,
  },
}

function getS3Client(provider = 's3') {
  const config = s3ProviderConfig[provider] || s3ProviderConfig.s3
  return new S3Client({
    region: config.region,
    endpoint: config.endpoint,
    forcePathStyle: Boolean(config.endpoint),
    credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
  })
}

async function uploadS3(file, provider = 's3') {
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const key = `resources/${sha256}.pdf`
  const config = s3ProviderConfig[provider]
  const client = getS3Client(provider)
  try {
    await client.send(new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
    }))
  } catch (error) {
    try {
      await client.send(new HeadObjectCommand({ Bucket: config.bucket, Key: key }))
    } catch (verificationError) {
      error.uploadVerifiedAbsent = verificationError.name === 'NotFound' || verificationError.$metadata?.httpStatusCode === 404
      error.uploadVerificationError = verificationError.message
    }
    throw error
  }
  return {
    provider,
    url: `/api/resources/__RESOURCE_ID__/file`,
    storageKey: `${sha256}.pdf`,
    providerFileId: key,
    bucket: config.bucket,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    status: 'READY',
    storedAt: new Date(),
  }
}

function providerConfig(provider) {
  const config = s3ProviderConfig[provider]
  if (!config) throw new Error(`Unsupported S3-compatible provider: ${provider}`)
  return config
}

const adapters = {
  local: {
    upload: localStorage.storePdf,
    getReadStream: (resource) => localStorage.getReadStream(resourceFileId(resource)),
    getMetadata: (resource) => localStorage.getMetadata(resourceFileId(resource)),
    exists: (resource) => localStorage.exists(resourceFileId(resource)),
    delete: (resource) => localStorage.deleteFile(resourceFileId(resource)),
  },
  s3: {
    upload: (file) => uploadS3(file, 's3'),
    getReadStream: async (resource) => toNodeStream((await getS3Client('s3').send(new GetObjectCommand({ Bucket: resource.file.bucket || providerConfig('s3').bucket, Key: resourceFileId(resource) }))).Body),
    getMetadata: async (resource) => {
      const result = await getS3Client('s3').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('s3').bucket, Key: resourceFileId(resource) }))
      return { sizeBytes: result.ContentLength, mimeType: result.ContentType, lastModified: result.LastModified }
    },
    exists: async (resource) => getS3Client('s3').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('s3').bucket, Key: resourceFileId(resource) })).then(() => true).catch((error) => {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false
      throw error
    }),
    delete: (resource) => getS3Client('s3').send(new DeleteObjectCommand({ Bucket: resource.file.bucket || providerConfig('s3').bucket, Key: resourceFileId(resource) })),
  },
  r2: {
    upload: (file) => uploadS3(file, 'r2'),
    getReadStream: async (resource) => toNodeStream((await getS3Client('r2').send(new GetObjectCommand({ Bucket: resource.file.bucket || providerConfig('r2').bucket, Key: resourceFileId(resource) }))).Body),
    getMetadata: async (resource) => {
      const result = await getS3Client('r2').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('r2').bucket, Key: resourceFileId(resource) }))
      return { sizeBytes: result.ContentLength, mimeType: result.ContentType, lastModified: result.LastModified }
    },
    exists: async (resource) => getS3Client('r2').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('r2').bucket, Key: resourceFileId(resource) })).then(() => true).catch((error) => {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false
      throw error
    }),
    delete: (resource) => getS3Client('r2').send(new DeleteObjectCommand({ Bucket: resource.file.bucket || providerConfig('r2').bucket, Key: resourceFileId(resource) })),
  },
  b2: {
    upload: (file) => uploadS3(file, 'b2'),
    getReadStream: async (resource) => toNodeStream((await getS3Client('b2').send(new GetObjectCommand({ Bucket: resource.file.bucket || providerConfig('b2').bucket, Key: resourceFileId(resource) }))).Body),
    getMetadata: async (resource) => {
      const result = await getS3Client('b2').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('b2').bucket, Key: resourceFileId(resource) }))
      return { sizeBytes: result.ContentLength, mimeType: result.ContentType, lastModified: result.LastModified }
    },
    exists: async (resource) => getS3Client('b2').send(new HeadObjectCommand({ Bucket: resource.file.bucket || providerConfig('b2').bucket, Key: resourceFileId(resource) })).then(() => true).catch((error) => {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false
      throw error
    }),
    delete: (resource) => getS3Client('b2').send(new DeleteObjectCommand({ Bucket: resource.file.bucket || providerConfig('b2').bucket, Key: resourceFileId(resource) })),
  },
  'google-drive': {
    upload: uploadGoogleDrive,
    getReadStream: async (resource) => toNodeStream((await googleRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resourceFileId(resource))}?alt=media`)).body),
    getMetadata: async (resource) => {
      const response = await googleRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resourceFileId(resource))}?fields=size,mimeType,modifiedTime`)
      const body = await response.json()
      return { sizeBytes: Number(body.size), mimeType: body.mimeType, lastModified: body.modifiedTime }
    },
    exists: (resource) => googleRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resourceFileId(resource))}?fields=id`).then(() => true).catch((error) => {
      if (error.code === 'FILE_NOT_FOUND') return false
      throw error
    }),
    delete: (resource) => googleRequest(`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(resourceFileId(resource))}`, { method: 'DELETE' }),
  },
}

async function readBuffer(resource) {
  const stream = await adapters[getProviderName(resource)].getReadStream(resource)
  const chunks = []
  for await (const chunk of stream) chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  return Buffer.concat(chunks)
}

export function enabledStorageProviders() {
  return storageConfig.enabledProviders
}

export function selectStorageProvider(requestedProvider, user) {
  if (requestedProvider && storageConfig.uploadPolicy === 'admin-selected' && ['ADMIN', 'MODERATOR'].includes(user?.role)) {
    if (!storageConfig.enabledProviders.includes(requestedProvider)) throw new Error('Requested storage provider is not enabled')
    return requestedProvider
  }
  if (configuredStagingProviders().length) {
    const providers = configuredStagingProviders().filter((provider) => storageConfig.enabledProviders.includes(provider))
    if (!providers.length) throw new Error('No configured staging provider is enabled')
    const selected = providers[stagingRoundRobinIndex % providers.length]
    stagingRoundRobinIndex += 1
    return selected
  }
  return storageConfig.defaultProvider
}

export async function upload(file, { provider, user } = {}) {
  const selected = selectStorageProvider(provider, user)
  if (!storageConfig.enabledProviders.includes(selected)) throw new Error('Selected storage provider is not enabled')
  const stagingProviders = configuredStagingProviders().filter((name) => storageConfig.enabledProviders.includes(name))
  const candidates = stagingProviders.includes(selected)
    ? [selected, ...stagingProviders.filter((name) => name !== selected)]
    : [selected]
  let lastError
  for (const candidate of candidates) {
    try {
      return await adapters[candidate].upload(file)
    } catch (error) {
      lastError = error
      if (error.uploadVerifiedAbsent !== true || candidates.length === 1) throw error
    }
  }
  throw lastError
}

export async function transferToGoogleDrive(resource) {
  const buffer = await readBuffer(resource)
  const file = await uploadGoogleDrive({
    buffer,
    mimetype: resource.file.mimeType || 'application/pdf',
    originalname: resource.file.fileName,
    size: buffer.length,
  })
  const metadata = await adapters['google-drive'].getMetadata({ file })
  if (metadata.sizeBytes !== buffer.length) {
    await adapters['google-drive'].delete({ file })
    throw new Error('Permanent storage verification failed: file size mismatch')
  }
  return file
}

export function isStagingProvider(provider) {
  return configuredStagingProviders().includes(provider)
}

export async function getReadStream(resource) {
  return adapters[getProviderName(resource)].getReadStream(resource)
}

export async function getMetadata(resource) {
  return adapters[getProviderName(resource)].getMetadata(resource)
}

export async function exists(resource) {
  return adapters[getProviderName(resource)].exists(resource)
}

export async function remove(resource) {
  return adapters[getProviderName(resource)].delete(resource)
}

export function getPreviewAccess(resourceId) {
  return `/api/resources/${resourceId}/file`
}

export function normalizeResourceFile(file, resourceId) {
  if (!file) return file
  if (file.provider && file.provider !== 'local') file.url = getPreviewAccess(resourceId)
  return file
}

export function isStorageError(error) {
  return ['GOOGLE_CREDENTIALS_EXPIRED', 'GOOGLE_AUTH_FAILED', 'GOOGLE_DRIVE_ERROR', 'FILE_NOT_FOUND'].includes(error?.code)
}
