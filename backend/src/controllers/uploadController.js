import crypto from 'node:crypto'
import { Resource } from '../models/Resource.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { slugify } from '../utils/slug.js'
import { getPreviewAccess, remove, upload } from '../services/storageProvider.js'
import { validateAcademicHierarchy } from '../utils/academicValidation.js'

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

  const file = await upload(req.file, {
    provider: metadata.storageProvider,
    user: req.user,
  })
  delete metadata.storageProvider
  let resource
  try {
    resource = await Resource.create({
      ...metadata,
      universityId: env.UNIVERSITY_ID,
      contributorId: req.user._id,
      slug: `${slugify(metadata.title)}-${Date.now()}`,
      file,
    })
    if (file.provider !== 'local') {
      resource.file.url = getPreviewAccess(resource._id)
      await resource.save()
    }
  } catch (error) {
    await remove({ file }).catch(() => {})
    throw error
  }

  return successResponse(
    res,
    { resource: { id: resource._id, title: resource.title, status: resource.status } },
    'Your resource has been submitted and is waiting for review',
    201,
  )
}
