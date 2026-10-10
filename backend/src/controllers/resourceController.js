import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { Resource } from '../models/Resource.js'
import { Download } from '../models/Download.js'
import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { recordAudit } from '../utils/audit.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { slugify } from '../utils/slug.js'
import { validateAcademicHierarchy } from '../utils/academicValidation.js'

import { Program, Branch, Subject } from '../models/Academic.js'

const publicResourceQuery = { universityId: env.UNIVERSITY_ID, status: 'APPROVED' }
const publicResourceFields = '-file.storageKey -file.sha256 -reviewedBy -rejectionReason'

export async function listResources(req, res) {
  const { q, programId, branchId, semesterId, subjectId, resourceType, examType, academicYear } = req.query
  const query = { ...publicResourceQuery }

  const trimmedQ = (q || '').trim()
  if (trimmedQ) {
    const escaped = trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const regex = new RegExp(escaped, 'i')

    const [matchingSubjects, matchingPrograms, matchingBranches, matchingContributors] = await Promise.all([
      Subject.find({ universityId: env.UNIVERSITY_ID, $or: [{ name: regex }, { code: regex }] })
        .select('_id')
        .lean(),
      Program.find({ universityId: env.UNIVERSITY_ID, $or: [{ name: regex }, { code: regex }] })
        .select('_id')
        .lean(),
      Branch.find({ universityId: env.UNIVERSITY_ID, $or: [{ name: regex }, { code: regex }] })
        .select('_id')
        .lean(),
      User.find({ universityId: env.UNIVERSITY_ID, name: regex, publicProfile: { $ne: false }, isActive: true })
        .select('_id')
        .lean(),
    ])

    const orClauses = [
      { title: regex },
      { description: regex },
    ]
    if (matchingSubjects.length) orClauses.push({ subjectId: { $in: matchingSubjects.map((s) => s._id) } })
    if (matchingPrograms.length) orClauses.push({ programId: { $in: matchingPrograms.map((p) => p._id) } })
    if (matchingBranches.length) orClauses.push({ branchId: { $in: matchingBranches.map((b) => b._id) } })
    if (matchingContributors.length) orClauses.push({ contributorId: { $in: matchingContributors.map((c) => c._id) } })

    const upperQ = trimmedQ.toUpperCase()
    if (['NOTES', 'PYQ', 'ASSIGNMENT', 'LAB_MATERIAL', 'REFERENCE', 'SYLLABUS', 'OTHER'].includes(upperQ)) {
      orClauses.push({ resourceType: upperQ })
    }
    const numQ = Number(trimmedQ)
    if (!Number.isNaN(numQ) && numQ >= 1 && numQ <= 10) {
      orClauses.push({ academicYear: numQ })
    }

    query.$or = orClauses
  }

  if (programId) query.programId = programId
  if (branchId) query.branchId = branchId
  if (semesterId) query.semesterId = semesterId
  if (subjectId) query.subjectId = subjectId
  if (resourceType && resourceType !== 'all') query.resourceType = resourceType
  if (examType && examType !== 'all') query.examType = examType
  if (academicYear) query.academicYear = Number(academicYear)

  const resources = await Resource.find(query)
    .select(publicResourceFields)
    .populate('contributorId', 'name publicProfile avatarUrl')
    .populate('programId branchId semesterId subjectId', 'name code number')
    .sort({ createdAt: -1 })
    .limit(100)
    .lean()

  return successResponse(
    res,
    resources.map((resource) => ({
      ...resource,
      contributor: resource.contributorId?.publicProfile === false ? null : resource.contributorId?.name || null,
      contributorId: resource.contributorId?.publicProfile === false ? null : resource.contributorId?._id || null,
    }))
  )
}

export async function getResource(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Resource not found')
  const resource = await Resource.findOne({ ...publicResourceQuery, _id: req.params.id }).select(publicResourceFields).populate('contributorId', 'name publicProfile').populate('programId branchId semesterId subjectId', 'name code number').lean()
  if (!resource) throw new HttpError(404, 'Resource not found')
  const contributor = resource.contributorId?.publicProfile === false ? null : resource.contributorId?.name || null
  return successResponse(res, { ...resource, contributor, contributorId: resource.contributorId?.publicProfile === false ? null : resource.contributorId?._id || null })
}

export async function createResource(req, res) {
  await validateAcademicHierarchy({
    universityId: env.UNIVERSITY_ID,
    programId: req.body.programId,
    branchId: req.body.branchId,
    semesterId: req.body.semesterId,
    subjectId: req.body.subjectId,
    academicYear: req.body.academicYear,
  })
  const resource = await Resource.create({ ...req.body, universityId: env.UNIVERSITY_ID, contributorId: req.user._id, slug: `${slugify(req.body.title)}-${Date.now()}` })
  return successResponse(res, { resource }, 'Resource submitted and is waiting for review', 201)
}

export async function downloadResource(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Resource not found')
  const resource = await Resource.findOne({ ...publicResourceQuery, _id: req.params.id })
  if (!resource) throw new HttpError(404, 'Resource not found')

  if (env.STORAGE_PROVIDER !== 's3' && resource.file?.storageKey) {
    const storagePath = path.resolve(
      path.dirname(fileURLToPath(import.meta.url)),
      '../../storage',
      resource.file.storageKey,
    )
    const exists = await fs.access(storagePath).then(() => true).catch(() => false)
    if (!exists) throw new HttpError(404, 'Resource file is not available')
  }

  await Download.create({ universityId: env.UNIVERSITY_ID, resourceId: resource._id, userId: req.user?._id || null })
  await Resource.updateOne({ _id: resource._id }, { $inc: { downloadCount: 1 } })
  return successResponse(res, { url: resource.file.url, fileName: resource.file.fileName }, 'Download recorded')
}

export async function pendingResources(req, res) { return successResponse(res, await Resource.find({ universityId: env.UNIVERSITY_ID, status: 'PENDING_REVIEW' }).populate('contributorId', 'name email').sort({ createdAt: 1 })) }
export async function approveResource(req, res) { const resource = await Resource.findOneAndUpdate({ _id: req.params.id, universityId: env.UNIVERSITY_ID, status: 'PENDING_REVIEW' }, { status: 'APPROVED', verified: true, reviewedBy: req.user._id, reviewedAt: new Date(), rejectionReason: '' }, { new: true }); if (!resource) throw new HttpError(404, 'Pending resource not found'); await Promise.all([Notification.create({ universityId: env.UNIVERSITY_ID, userId: resource.contributorId, type: 'UPLOAD_APPROVED', title: 'Resource approved', message: `${resource.title} is now available in the community library.`, resourceId: resource._id }), recordAudit({ actorId: req.user._id, action: 'RESOURCE_APPROVED', entityType: 'Resource', entityId: resource._id })]); return successResponse(res, resource, 'Resource approved') }
export async function rejectResource(req, res) { const resource = await Resource.findOneAndUpdate({ _id: req.params.id, universityId: env.UNIVERSITY_ID, status: 'PENDING_REVIEW' }, { status: 'REJECTED', verified: false, rejectionReason: req.body.reason, reviewedBy: req.user._id, reviewedAt: new Date() }, { new: true }); if (!resource) throw new HttpError(404, 'Pending resource not found'); await Promise.all([Notification.create({ universityId: env.UNIVERSITY_ID, userId: resource.contributorId, type: 'UPLOAD_REJECTED', title: 'Resource needs changes', message: `${resource.title} was not approved: ${req.body.reason}`, resourceId: resource._id }), recordAudit({ actorId: req.user._id, action: 'RESOURCE_REJECTED', entityType: 'Resource', entityId: resource._id, reason: req.body.reason })]); return successResponse(res, resource, 'Resource rejected') }
export async function requestChangesResource(req, res) {
  const resource = await Resource.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID, status: 'PENDING_REVIEW' },
    {
      status: 'CHANGES_REQUESTED',
      verified: false,
      requestedChanges: req.body.message || req.body.reason || 'Changes requested by moderator',
      reviewedBy: req.user._id,
      reviewedAt: new Date(),
    },
    { new: true },
  )
  if (!resource) throw new HttpError(404, 'Pending resource not found')
  await Promise.all([
    Notification.create({
      universityId: env.UNIVERSITY_ID,
      userId: resource.contributorId,
      type: 'CHANGES_REQUESTED',
      title: 'Changes requested for your resource',
      message: `${resource.title}: ${req.body.message || req.body.reason || 'Please check feedback and resubmit.'}`,
      resourceId: resource._id,
    }),
    recordAudit({
      actorId: req.user._id,
      action: 'RESOURCE_CHANGES_REQUESTED',
      entityType: 'Resource',
      entityId: resource._id,
      reason: req.body.message || req.body.reason,
    }),
  ])
  return successResponse(res, resource, 'Changes requested')
}

export async function contributorProfile(req, res) {
  if (!mongoose.isValidObjectId(req.params.id)) throw new HttpError(404, 'Contributor not found')
  const user = await User.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
    publicProfile: true,
    isActive: true,
  })
    .select('name role programId branchId semesterId avatarUrl bio privacySettings createdAt')
    .populate('programId branchId semesterId', 'name code number')
    .lean()
  if (!user) throw new HttpError(404, 'Contributor not found')

  const resources = await Resource.find({ ...publicResourceQuery, contributorId: user._id })
    .select(publicResourceFields)
    .populate('programId branchId semesterId subjectId', 'name code number')
    .sort({ createdAt: -1 })
    .lean()

  const safeContributor = {
    _id: user._id,
    id: user._id,
    name: user.name,
    role: user.role,
    avatarUrl: user.privacySettings?.showAvatar !== false ? user.avatarUrl || '' : '',
    bio: user.privacySettings?.showBio !== false ? user.bio || '' : '',
    programId: user.privacySettings?.showAcademicInfo !== false ? user.programId : null,
    branchId: user.privacySettings?.showAcademicInfo !== false ? user.branchId : null,
    semesterId: user.privacySettings?.showAcademicInfo !== false ? user.semesterId : null,
    createdAt: user.createdAt,
  }

  return successResponse(res, {
    contributor: safeContributor,
    statistics: {
      approvedContributions: resources.length,
      totalDownloads: resources.reduce((sum, item) => sum + (item.downloadCount || 0), 0),
      subjectsContributed: new Set(
        resources.map((item) => item.subjectId?._id?.toString() || item.subjectId?.toString())
      ).size,
    },
    resources,
  })
}

export async function listContributors(req, res) {
  const users = await User.find({
    universityId: env.UNIVERSITY_ID,
    publicProfile: true,
    isActive: true,
  })
    .select('name role avatarUrl bio programId branchId semesterId privacySettings createdAt')
    .populate('programId branchId semesterId', 'name code number')
    .lean()

  const counts = await Resource.aggregate([
    { $match: publicResourceQuery },
    { $group: { _id: '$contributorId', count: { $sum: 1 }, downloads: { $sum: '$downloadCount' } } },
  ])
  const map = new Map(counts.map((item) => [item._id.toString(), item]))

  return successResponse(
    res,
    users
      .map((user) => ({
        _id: user._id,
        id: user._id,
        name: user.name,
        role: user.role,
        avatarUrl: user.privacySettings?.showAvatar !== false ? user.avatarUrl || '' : '',
        bio: user.privacySettings?.showBio !== false ? user.bio || '' : '',
        programId: user.privacySettings?.showAcademicInfo !== false ? user.programId : null,
        branchId: user.privacySettings?.showAcademicInfo !== false ? user.branchId : null,
        semesterId: user.privacySettings?.showAcademicInfo !== false ? user.semesterId : null,
        createdAt: user.createdAt,
        approvedContributions: map.get(user._id.toString())?.count || 0,
        totalDownloads: map.get(user._id.toString())?.downloads || 0,
      }))
      .sort((a, b) => b.approvedContributions - a.approvedContributions)
  )
}
