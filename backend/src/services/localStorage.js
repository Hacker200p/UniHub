import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage')
export async function storePdf(file) {
  const sha256 = crypto.createHash('sha256').update(file.buffer).digest('hex')
  const fileName = `${sha256}.pdf`
  await fs.mkdir(root, { recursive: true })
  await fs.writeFile(path.join(root, fileName), file.buffer, { flag: 'wx' }).catch((error) => { if (error.code !== 'EEXIST') throw error })
  return { url: `/uploads/${fileName}`, storageKey: fileName, fileName: file.originalname, mimeType: file.mimetype, sizeBytes: file.size, sha256 }
}
