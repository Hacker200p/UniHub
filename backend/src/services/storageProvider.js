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

const PROVIDERS = new Set(['local', 's3', 'google-drive'])
let googleFolderId = null

function getProviderName(resourceOrName) {
  const name = typeof resourceOrName === 'string'
    ? resourceOrName
    : resourceOrName?.file?.provider || (resourceOrName?.file?.storageKey && env.STORAGE_PROVIDER === 's3' ? 's3' : 'local')
  return PROVIDERS.has(name) ? name : 'local'
}

function resourceFileId(resource) {
  return resource?.file?.providerFileId || resource?.file?.storageKey
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
  const response = await googleRequest('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name: 'UniHub Resources',
      mimeType: 'application/vnd.google-apps.folder',
    }),
  })
  const body = await response.json()
  googleFolderId = body.id
  return googleFolderId
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

function getS3Client() {
  return new S3Client({
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
    forcePathStyle: Boolean(env.STORAGE_ENDPOINT),
    credentials: { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY },
  })
}

async function uploadS3(file) {
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const key = `resources/${sha256}.pdf`
  await getS3Client().send(new PutObjectCommand({
    Bucket: env.STORAGE_BUCKET,
    Key: key,
    Body: file.buffer,
    ContentType: file.mimetype,
  }))
  return {
    provider: 's3',
    url: `/api/resources/__RESOURCE_ID__/file`,
    storageKey: `${sha256}.pdf`,
    providerFileId: key,
    bucket: env.STORAGE_BUCKET,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    status: 'READY',
    storedAt: new Date(),
  }
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
    upload: uploadS3,
    getReadStream: async (resource) => toNodeStream((await getS3Client().send(new GetObjectCommand({ Bucket: resource.file.bucket || env.STORAGE_BUCKET, Key: resourceFileId(resource) }))).Body),
    getMetadata: async (resource) => {
      const result = await getS3Client().send(new HeadObjectCommand({ Bucket: resource.file.bucket || env.STORAGE_BUCKET, Key: resourceFileId(resource) }))
      return { sizeBytes: result.ContentLength, mimeType: result.ContentType, lastModified: result.LastModified }
    },
    exists: async (resource) => getS3Client().send(new HeadObjectCommand({ Bucket: resource.file.bucket || env.STORAGE_BUCKET, Key: resourceFileId(resource) })).then(() => true).catch((error) => {
      if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) return false
      throw error
    }),
    delete: (resource) => getS3Client().send(new DeleteObjectCommand({ Bucket: resource.file.bucket || env.STORAGE_BUCKET, Key: resourceFileId(resource) })),
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

export function enabledStorageProviders() {
  return storageConfig.enabledProviders
}

export function selectStorageProvider(requestedProvider, user) {
  if (requestedProvider && storageConfig.uploadPolicy === 'admin-selected' && ['ADMIN', 'MODERATOR'].includes(user?.role)) {
    if (!storageConfig.enabledProviders.includes(requestedProvider)) throw new Error('Requested storage provider is not enabled')
    return requestedProvider
  }
  return storageConfig.defaultProvider
}

export async function upload(file, { provider, user } = {}) {
  const selected = selectStorageProvider(provider, user)
  if (!storageConfig.enabledProviders.includes(selected)) throw new Error('Selected storage provider is not enabled')
  return adapters[selected].upload(file)
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
