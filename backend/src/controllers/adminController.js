import { User } from '../models/User.js'
import { Resource } from '../models/Resource.js'
import { Download } from '../models/Download.js'
import { Suggestion, Report } from '../models/Community.js'
import { ResourceRequest } from '../models/ResourceRequest.js'
import { Developer } from '../models/Developer.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { recordAudit } from '../utils/audit.js'
import { remove } from '../services/storageProvider.js'

export async function overview(req, res) {
  const universityId = env.UNIVERSITY_ID
  const [
    totalUsers,
    students,
    moderators,
    admins,
    resources,
    pendingUploads,
    approvedResources,
    rejectedResources,
    changesRequestedResources,
    downloads,
    contributors,
    suggestions,
    pendingSuggestions,
    reports,
    pendingReports,
    openRequests,
    recentUploads,
    recentSuggestions,
    recentReports,
  ] = await Promise.all([
    User.countDocuments({ universityId }),
    User.countDocuments({ universityId, role: 'STUDENT' }),
    User.countDocuments({ universityId, role: 'MODERATOR' }),
    User.countDocuments({ universityId, role: 'ADMIN' }),
    Resource.countDocuments({ universityId }),
    Resource.countDocuments({ universityId, status: 'PENDING_REVIEW' }),
    Resource.countDocuments({ universityId, status: 'APPROVED' }),
    Resource.countDocuments({ universityId, status: 'REJECTED' }),
    Resource.countDocuments({ universityId, status: 'CHANGES_REQUESTED' }),
    Download.countDocuments({ universityId }),
    Resource.distinct('contributorId', { universityId, status: 'APPROVED' }).then(
      (items) => items.length,
    ),
    Suggestion.countDocuments({ universityId }),
    Suggestion.countDocuments({ universityId, status: 'OPEN' }),
    Report.countDocuments({ universityId }),
    Report.countDocuments({ universityId, status: 'OPEN' }),
    ResourceRequest.countDocuments({ universityId, status: 'OPEN' }),
    Resource.find({ universityId })
      .select('title resourceType status createdAt contributorId subjectId')
      .populate('contributorId', 'name email')
      .populate('subjectId', 'name code')
      .sort({ createdAt: -1 })
      .limit(6)
      .lean(),
    Suggestion.find({ universityId, status: 'OPEN' })
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
    Report.find({ universityId, status: 'OPEN' })
      .populate('resourceId', 'title')
      .populate('userId', 'name email')
      .sort({ createdAt: -1 })
      .limit(5)
      .lean(),
  ])

  return successResponse(res, {
    statistics: {
      totalUsers,
      students,
      moderators,
      admins,
      resources,
      pendingUploads,
      approvedResources,
      rejectedResources,
      changesRequestedResources,
      downloads,
      contributors,
      suggestions,
      pendingSuggestions,
      reports,
      pendingReports,
      openRequests,
    },
    recentActivity: {
      uploads: recentUploads,
      suggestions: recentSuggestions,
      reports: recentReports,
    },
  })
}

export async function queue(req, res) {
  const [uploads, feedback] = await Promise.all([
    Resource.find({ universityId: env.UNIVERSITY_ID, status: 'PENDING_REVIEW' })
      .select(
        'title description resourceType examType academicYear file.fileName file.sizeBytes file.url createdAt contributorId subjectId branchId semesterId programId',
      )
      .populate('contributorId', 'name email')
      .populate('programId branchId semesterId subjectId', 'name code number')
      .sort({ createdAt: 1 })
      .limit(100)
      .lean(),
    Promise.all([
      Suggestion.find({ universityId: env.UNIVERSITY_ID, status: 'OPEN' })
        .populate('userId', 'name email')
        .sort({ createdAt: 1 })
        .limit(50)
        .lean(),
      Report.find({ universityId: env.UNIVERSITY_ID, status: 'OPEN' })
        .populate('resourceId', 'title file.url')
        .populate('userId', 'name email')
        .sort({ createdAt: 1 })
        .limit(50)
        .lean(),
    ]),
  ])
  return successResponse(res, {
    uploads,
    suggestions: feedback[0],
    reports: feedback[1],
  })
}

export async function listAdminResources(req, res) {
  const { q, programId, branchId, semesterId, subjectId, resourceType, examType, academicYear, status } = req.query
  const query = { universityId: env.UNIVERSITY_ID }
  if (q) {
    query.$or = [
      { title: { $regex: q, $options: 'i' } },
      { description: { $regex: q, $options: 'i' } },
    ]
  }
  if (programId) query.programId = programId
  if (branchId) query.branchId = branchId
  if (semesterId) query.semesterId = semesterId
  if (subjectId) query.subjectId = subjectId
  if (resourceType) query.resourceType = resourceType
  if (examType) query.examType = examType
  if (academicYear) query.academicYear = Number(academicYear)
  if (status) query.status = status

  const resources = await Resource.find(query)
    .populate('contributorId', 'name email')
    .populate('programId branchId semesterId subjectId', 'name code number')
    .sort({ createdAt: -1 })
    .limit(150)
    .lean()

  return successResponse(res, resources)
}

export async function updateAdminResource(req, res) {
  const updates = { ...req.body }
  delete updates._id
  delete updates.universityId

  const resource = await Resource.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    updates,
    { new: true, runValidators: true },
  )
  if (!resource) throw new HttpError(404, 'Resource not found')

  await recordAudit({
    actorId: req.user._id,
    action: 'RESOURCE_UPDATED',
    entityType: 'Resource',
    entityId: resource._id,
    metadata: updates,
  })

  return successResponse(res, resource, 'Resource updated successfully')
}

export async function deleteAdminResource(req, res) {
  const resource = await Resource.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!resource) throw new HttpError(404, 'Resource not found')

  await remove(resource)
  await Resource.deleteOne({ _id: resource._id })

  await recordAudit({
    actorId: req.user._id,
    action: 'RESOURCE_DELETED',
    entityType: 'Resource',
    entityId: resource._id,
    reason: req.body?.reason || 'Deleted by admin',
  })

  return successResponse(res, null, 'Resource deleted successfully')
}

export async function listAdminUsers(req, res) {
  const { q, role, isActive } = req.query
  const query = { universityId: env.UNIVERSITY_ID }
  if (q) {
    query.$or = [
      { name: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ]
  }
  if (role) query.role = role
  if (typeof isActive !== 'undefined' && isActive !== '') {
    query.isActive = isActive === 'true' || isActive === true
  }

  const users = await User.find(query)
    .select('name email role isActive programId branchId semesterId publicProfile createdAt')
    .populate('programId branchId semesterId', 'name code number')
    .sort({ createdAt: -1 })
    .limit(150)
    .lean()

  return successResponse(res, users)
}

export async function getAdminUserDetail(req, res) {
  const user = await User.findOne({ _id: req.params.id, universityId: env.UNIVERSITY_ID })
    .select('name email role isActive bio publicProfile programId branchId semesterId createdAt emailVerifiedAt')
    .populate('programId branchId semesterId', 'name code number')
    .lean()

  if (!user) throw new HttpError(404, 'User not found')

  const [uploadsCount, approvedCount, downloads] = await Promise.all([
    Resource.countDocuments({ universityId: env.UNIVERSITY_ID, contributorId: user._id }),
    Resource.countDocuments({ universityId: env.UNIVERSITY_ID, contributorId: user._id, status: 'APPROVED' }),
    Resource.aggregate([
      { $match: { universityId: env.UNIVERSITY_ID, contributorId: user._id } },
      { $group: { _id: null, total: { $sum: '$downloadCount' } } },
    ]),
  ])

  return successResponse(res, {
    user,
    statistics: {
      totalUploads: uploadsCount,
      approvedContributions: approvedCount,
      totalDownloads: downloads[0]?.total || 0,
    },
  })
}

export async function updateUserRole(req, res) {
  const { role } = req.body
  if (!['STUDENT', 'MODERATOR', 'ADMIN'].includes(role)) {
    throw new HttpError(400, 'Invalid role value')
  }

  const user = await User.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    { role },
    { new: true },
  ).select('name email role isActive')

  if (!user) throw new HttpError(404, 'User not found')

  await recordAudit({
    actorId: req.user._id,
    action: 'USER_ROLE_CHANGED',
    entityType: 'User',
    entityId: user._id,
    metadata: { newRole: role },
  })

  return successResponse(res, user, 'User role updated')
}

export async function updateUserStatus(req, res) {
  const { isActive } = req.body
  const user = await User.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    { isActive: Boolean(isActive) },
    { new: true },
  ).select('name email role isActive')

  if (!user) throw new HttpError(404, 'User not found')

  await recordAudit({
    actorId: req.user._id,
    action: 'USER_STATUS_CHANGED',
    entityType: 'User',
    entityId: user._id,
    metadata: { isActive: Boolean(isActive) },
  })

  return successResponse(res, user, `User account ${isActive ? 'restored' : 'suspended'}`)
}

export async function listAdminContributors(req, res) {
  const users = await User.find({ universityId: env.UNIVERSITY_ID })
    .select('name email role publicProfile programId branchId semesterId createdAt')
    .populate('programId branchId semesterId', 'name code number')
    .lean()

  const counts = await Resource.aggregate([
    { $match: { universityId: env.UNIVERSITY_ID } },
    {
      $group: {
        _id: '$contributorId',
        totalUploads: { $sum: 1 },
        approved: { $sum: { $cond: [{ $eq: ['$status', 'APPROVED'] }, 1, 0] } },
        pending: { $sum: { $cond: [{ $eq: ['$status', 'PENDING_REVIEW'] }, 1, 0] } },
        rejected: { $sum: { $cond: [{ $eq: ['$status', 'REJECTED'] }, 1, 0] } },
        downloads: { $sum: '$downloadCount' },
        subjects: { $addToSet: '$subjectId' },
        lastUploadDate: { $max: '$createdAt' },
      },
    },
  ])

  const map = new Map(counts.map((item) => [item._id?.toString(), item]))

  const list = users
    .map((user) => {
      const stats = map.get(user._id.toString()) || {
        totalUploads: 0,
        approved: 0,
        pending: 0,
        rejected: 0,
        downloads: 0,
        subjects: [],
        lastUploadDate: null,
      }
      return {
        ...user,
        totalUploads: stats.totalUploads,
        approvedContributions: stats.approved,
        pendingContributions: stats.pending,
        rejectedContributions: stats.rejected,
        totalDownloads: stats.downloads,
        subjectsCount: stats.subjects.length,
        lastUploadDate: stats.lastUploadDate,
      }
    })
    .filter((user) => user.totalUploads > 0 || user.publicProfile)
    .sort((a, b) => b.approvedContributions - a.approvedContributions)

  return successResponse(res, list)
}

export async function getAnalytics(req, res) {
  const universityId = env.UNIVERSITY_ID
  const [
    byType,
    byBranch,
    bySemester,
    byExamType,
    uploadsOverTime,
    downloadsOverTime,
    popularResources,
    topContributors,
    reviewAging,
  ] = await Promise.all([
    Resource.aggregate([
      { $match: { universityId } },
      { $group: { _id: '$resourceType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Resource.aggregate([
      { $match: { universityId } },
      { $group: { _id: '$branchId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'branches',
          localField: '_id',
          foreignField: '_id',
          as: 'branch',
        },
      },
      {
        $project: {
          _id: 1,
          name: { $ifNull: [{ $arrayElemAt: ['$branch.name', 0] }, 'General / Common'] },
          code: { $ifNull: [{ $arrayElemAt: ['$branch.code', 0] }, 'GEN'] },
          count: 1,
        },
      },
      { $sort: { count: -1 } },
    ]),
    Resource.aggregate([
      { $match: { universityId } },
      { $group: { _id: '$semesterId', count: { $sum: 1 } } },
      {
        $lookup: {
          from: 'semesters',
          localField: '_id',
          foreignField: '_id',
          as: 'semester',
        },
      },
      {
        $project: {
          _id: 1,
          name: { $ifNull: [{ $arrayElemAt: ['$semester.name', 0] }, 'Unassigned'] },
          number: { $ifNull: [{ $arrayElemAt: ['$semester.number', 0] }, 0] },
          count: 1,
        },
      },
      { $sort: { number: 1 } },
    ]),
    Resource.aggregate([
      { $match: { universityId } },
      { $group: { _id: '$examType', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]),
    Resource.aggregate([
      { $match: { universityId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
    Download.aggregate([
      { $match: { universityId } },
      {
        $group: {
          _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt' } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      { $limit: 30 },
    ]),
    Resource.find({ universityId, status: 'APPROVED' })
      .select('title downloadCount resourceType subjectId')
      .populate('subjectId', 'name code')
      .sort({ downloadCount: -1 })
      .limit(8)
      .lean(),
    Resource.aggregate([
      { $match: { universityId, status: 'APPROVED' } },
      {
        $group: {
          _id: '$contributorId',
          count: { $sum: 1 },
          downloads: { $sum: '$downloadCount' },
        },
      },
      {
        $lookup: {
          from: 'users',
          localField: '_id',
          foreignField: '_id',
          as: 'contributor',
        },
      },
      {
        $project: {
          _id: 1,
          name: { $arrayElemAt: ['$contributor.name', 0] },
          count: 1,
          downloads: 1,
        },
      },
      { $sort: { count: -1 } },
      { $limit: 8 },
    ]),
    Resource.aggregate([
      { $match: { universityId, status: 'PENDING_REVIEW' } },
      {
        $project: {
          title: 1,
          createdAt: 1,
          ageHours: {
            $divide: [{ $subtract: [new Date(), '$createdAt'] }, 1000 * 60 * 60],
          },
        },
      },
      { $sort: { createdAt: 1 } },
      { $limit: 10 },
    ]),
  ])

  return successResponse(res, {
    byType,
    byBranch,
    bySemester,
    byExamType,
    uploadsOverTime,
    downloadsOverTime,
    popularResources,
    topContributors,
    reviewAging,
  })
}

export async function listAdminDevelopers(req, res) {
  return successResponse(
    res,
    await Developer.find({ universityId: env.UNIVERSITY_ID }).sort({ displayOrder: 1, createdAt: 1 }).lean(),
  )
}
