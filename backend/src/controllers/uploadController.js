import { Resource } from '../models/Resource.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { slugify } from '../utils/slug.js'
import { storePdf } from '../services/storageProvider.js'
import { validateAcademicHierarchy } from '../utils/academicValidation.js'

export async function uploadResource(req, res) {
  const metadata = { ...req.body, academicYear: req.body.academicYear || undefined }
  await validateAcademicHierarchy({
    universityId: env.UNIVERSITY_ID,
    programId: metadata.programId,
    branchId: metadata.branchId,
    semesterId: metadata.semesterId,
    subjectId: metadata.subjectId,
    academicYear: metadata.academicYear,
  })
  const file = await storePdf(req.file)
  if (await Resource.exists({ universityId: env.UNIVERSITY_ID, 'file.sha256': file.sha256 })) throw new HttpError(409, 'This resource already exists')
  const resource = await Resource.create({ ...metadata, universityId: env.UNIVERSITY_ID, contributorId: req.user._id, slug: `${slugify(metadata.title)}-${Date.now()}`, file })
  return successResponse(res, { resource: { id: resource._id, title: resource.title, status: resource.status } }, 'Your resource has been submitted and is waiting for review', 201)
}
