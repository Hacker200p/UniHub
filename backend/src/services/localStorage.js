import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createReadStream } from 'node:fs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage')
export async function storePdf(file) {
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const fileName = `${sha256}.pdf`
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, fileName), file.buffer, { flag: 'wx' }).catch((error) => { if (error.code !== 'EEXIST') throw error })
  return {
    provider: 'local',
    url: `/uploads/${fileName}`,
    storageKey: fileName,
    providerFileId: fileName,
    fileName: file.originalname,
    mimeType: file.mimetype,
    sizeBytes: file.size,
    sha256,
    status: 'READY',
    storedAt: new Date(),
  }
}

export function getLocalPath(storageKey) {
  return path.join(root, path.basename(storageKey))
}

export async function getMetadata(storageKey) {
  const stats = await fs.stat(getLocalPath(storageKey))
  return { sizeBytes: stats.size, lastModified: stats.mtime }
}

export async function exists(storageKey) {
  return fs.access(getLocalPath(storageKey)).then(() => true).catch(() => false)
}

export function getReadStream(storageKey) {
  return createReadStream(getLocalPath(storageKey))
}

export async function deleteFile(storageKey) {
  await fs.unlink(getLocalPath(storageKey)).catch((error) => {
    if (error.code !== 'ENOENT') throw error
  })
}
