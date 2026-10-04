import crypto from 'node:crypto'
import { PutObjectCommand, S3Client } from '@aws-sdk/client-s3'
import { env } from '../config/env.js'
import { storePdf as storeLocalPdf } from './localStorage.js'

async function storeS3(file) {
  if (!env.STORAGE_BUCKET || !env.STORAGE_ACCESS_KEY || !env.STORAGE_SECRET_KEY) throw new Error('S3 storage is not fully configured')
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const key = `resources/${sha256}.pdf`
  const client = new S3Client({ region: env.STORAGE_REGION, endpoint: env.STORAGE_ENDPOINT, forcePathStyle: Boolean(env.STORAGE_ENDPOINT), credentials: { accessKeyId: env.STORAGE_ACCESS_KEY, secretAccessKey: env.STORAGE_SECRET_KEY } })
  await client.send(new PutObjectCommand({ Bucket: env.STORAGE_BUCKET, Key: key, Body: file.buffer, ContentType: file.mimetype }))
  const url = env.STORAGE_ENDPOINT ? `${env.STORAGE_ENDPOINT}/${env.STORAGE_BUCKET}/${key}` : `https://${env.STORAGE_BUCKET}.s3.${env.STORAGE_REGION}.amazonaws.com/${key}`
  return { url, storageKey: key, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, sha256 }
}

export function storePdf(file) { return env.STORAGE_PROVIDER === 's3' ? storeS3(file) : storeLocalPdf(file) }
