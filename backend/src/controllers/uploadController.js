import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Resource } from '../models/Resource.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { slugify } from '../utils/slug.js'
import { storePdf } from '../services/storageProvider.js'
import { validateAcademicHierarchy } from '../utils/academicValidation.js'

const storageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../storage')

export async function uploadResource(req, res) {
  // University email verification is strictly required before uploading study materials
  if (!req.user?.universityEmailVerifiedAt) {
    throw new HttpError(
      403,
      'University email verification required before uploading study materials. Please verify your @silicon.ac.in email address.',
      {
        code: 'UNIVERSITY_EMAIL_VERIFICATION_REQUIRED',
        requiresUniversityEmailVerification: true,
      },
    )
  }

  const metadata = { ...req.body, academicYear: req.body.academicYear || undefined }
  await validateAcademicHierarchy({
    universityId: env.UNIVERSITY_ID,
    programId: metadata.programId,
    branchId: metadata.branchId,
    semesterId: metadata.semesterId,
    subjectId: metadata.subjectId,
    academicYear: metadata.academicYear,
  })

  const sha256 = crypto.createHash('sha256').update(req.file.buffer).digest('hex')
  if (await Resource.exists({ universityId: env.UNIVERSITY_ID, 'file.sha256': sha256 })) {
    throw new HttpError(409, 'This resource already exists')
  }

  const file = await storePdf(req.file)
  let resource
  try {
    resource = await Resource.create({
      ...metadata,
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      slug: `${slugify(metadata.title)}-${Date.now()}`,
      file,
    })
  } catch (error) {
    if (env.STORAGE_PROVIDER !== 's3' && file?.storageKey) {
      const other = await Resource.exists({ 'file.sha256': file.sha256 })
      if (!other) {
        await fs.unlink(path.resolve(storageRoot, file.storageKey)).catch(() => {})
      }
    }
    throw error
  }

  return successResponse(
    res,
    { resource: { id: resource._id, title: resource.title, status: resource.status } },
    'Your resource has been submitted and is waiting for review',
    201,
  )
}
