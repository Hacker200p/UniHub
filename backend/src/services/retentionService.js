import { Resource } from '../models/Resource.js'
import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { env, storageConfig } from '../config/env.js'
import { remove, resourceProvider, transferToGoogleDrive } from './storageProvider.js'
import { sendLink } from './mailer.js'
import { recordAudit } from '../utils/audit.js'
import { logger } from '../utils/logger.js'

const WARNING_DAYS = [90, 113, 119]
const DAY_MS = 24 * 60 * 60 * 1000

function isConfigured() {
  return Boolean(env.RETENTION_ENABLED && (storageConfig.stagingProviders.length || storageConfig.stagingProvider))
}

function isConfiguredStagingProvider(provider) {
  const providers = storageConfig.stagingProviders.length
    ? storageConfig.stagingProviders
    : [storageConfig.stagingProvider]
  return providers.includes(provider)
}

function retentionDeadline(uploadedAt) {
  return new Date(new Date(uploadedAt).getTime() + env.RETENTION_DAYS * DAY_MS)
}

function daysSince(uploadedAt, now) {
  return Math.floor((now.getTime() - new Date(uploadedAt).getTime()) / DAY_MS)
}

async function notify(resource, type, title, message) {
  const notification = await Notification.create({
    universityId: resource.universityId,
    userId: resource.contributorId,
    type,
    title,
    message,
    resourceId: resource._id,
  })
  const user = await User.findById(resource.contributorId).select('name email')
  if (user?.email) {
    const result = await sendLink({
      to: user.email,
      subject: `UniHub: ${title}`,
      text: `Hello ${user.name || 'Student'},\n\n${message}\n\nSign in to UniHub for details.`,
    })
    if (!result.success) {
      await Resource.updateOne({ _id: resource._id }, { $addToSet: { 'retention.notificationFailures': result.error || 'delivery failed' } })
    }
  }
  return notification
}

async function sendWarning(resource, warningDay) {
  const messages = {
    90: ['Resource still awaiting review', `${resource.title} is still awaiting moderation.`],
    113: ['Resource scheduled for deletion', `${resource.title} is scheduled for deletion in seven days unless reviewed or extended.`],
    119: ['Resource expires tomorrow', `${resource.title} is scheduled for deletion in approximately 24 hours unless reviewed or extended.`],
  }
  const [title, message] = messages[warningDay]
  const claimed = await Resource.findOneAndUpdate(
    { _id: resource._id, status: 'PENDING_REVIEW', 'retention.warningDaysSent': { $ne: warningDay } },
    { $addToSet: { 'retention.warningDaysSent': warningDay } },
    { new: true },
  )
  if (claimed) await notify(claimed, 'RETENTION_WARNING', title, message)
}

async function expireResource(resource, now) {
  const claimed = await Resource.findOneAndUpdate(
    {
      _id: resource._id,
      status: 'PENDING_REVIEW',
      'retention.cleanupState': { $in: ['ELIGIBLE', 'FAILED'] },
      'retention.deadline': { $lte: now },
      'transfer.state': { $nin: ['IN_PROGRESS', 'PENDING'] },
    },
    { $set: { 'retention.cleanupState': 'IN_PROGRESS', 'retention.lastCleanupAttemptAt': now } },
    { new: true },
  )
  if (!claimed) return false

  try {
    if (!isConfiguredStagingProvider(resourceProvider(claimed)) || !isConfigured()) {
      await Resource.updateOne({ _id: claimed._id }, { $set: { 'retention.cleanupState': 'DISABLED' } })
      return false
    }
    const duplicate = await Resource.exists({
      _id: { $ne: claimed._id },
      'file.provider': resourceProvider(claimed),
      'file.providerFileId': claimed.file.providerFileId,
      status: { $ne: 'REJECTED' },
    })
    if (duplicate) throw new Error('Staged object is referenced by another resource')
    await remove(claimed)
    await Resource.updateOne(
      { _id: claimed._id, status: 'PENDING_REVIEW' },
      { $set: { 'retention.cleanupState': 'COMPLETED', 'file.status': 'DELETED', 'file.deletedAt': now } },
    )
    await notify(claimed, 'RETENTION_EXPIRED', 'Resource expired', `${claimed.title} was removed after remaining pending for ${env.RETENTION_DAYS} days.`)
    await recordAudit({ actorId: claimed.reviewedBy || claimed.contributorId, action: 'RESOURCE_RETENTION_EXPIRED', entityType: 'Resource', entityId: claimed._id })
    return true
  } catch (error) {
    await Resource.updateOne(
      { _id: claimed._id },
      { $set: { 'retention.cleanupState': 'FAILED', 'retention.cleanupError': error.message } },
    )
    logger.error('retention_cleanup_failed', { resourceId: claimed._id.toString(), error: error.message })
    return false
  }
}

export async function processRetention(now = new Date()) {
  if (!isConfigured()) return { enabled: false, warnings: 0, expired: 0 }
  const resources = await Resource.find({
    universityId: env.UNIVERSITY_ID,
    status: 'PENDING_REVIEW',
    'file.provider': { $in: storageConfig.stagingProviders.length ? storageConfig.stagingProviders : [storageConfig.stagingProvider] },
    'retention.deadline': { $exists: true },
  }).limit(500)
  let warnings = 0
  let expired = 0
  for (const resource of resources) {
    const age = daysSince(resource.retention.originalUploadedAt || resource.file.storedAt || resource.createdAt, now)
    for (const warningDay of WARNING_DAYS) {
      if (age >= warningDay && !(resource.retention.warningDaysSent || []).includes(warningDay)) {
        await sendWarning(resource, warningDay)
        warnings += 1
      }
    }
    if (resource.retention.deadline <= now && await expireResource(resource, now)) expired += 1
  }
  const rejected = await Resource.find({
    universityId: env.UNIVERSITY_ID,
    status: 'REJECTED',
    'file.provider': { $in: storageConfig.stagingProviders.length ? storageConfig.stagingProviders : [storageConfig.stagingProvider] },
    'retention.cleanupState': 'FAILED',
  }).limit(100)
  for (const resource of rejected) {
    const claimed = await Resource.findOneAndUpdate(
      { _id: resource._id, status: 'REJECTED', 'retention.cleanupState': 'FAILED' },
      { $set: { 'retention.cleanupState': 'IN_PROGRESS', 'retention.lastCleanupAttemptAt': now } },
      { new: true },
    )
    if (!claimed) continue
    try {
      await remove(claimed)
      await Resource.updateOne({ _id: claimed._id, status: 'REJECTED' }, { $set: { 'file.status': 'DELETED', 'file.deletedAt': now, 'retention.cleanupState': 'COMPLETED', 'retention.cleanupError': '' } })
    } catch (error) {
      await Resource.updateOne({ _id: claimed._id }, { $set: { 'retention.cleanupState': 'FAILED', 'retention.cleanupError': error.message } })
    }
  }
  return { enabled: true, warnings, expired }
}

export async function approveWithTransfer(resource) {
  if (resource.status !== 'PENDING_REVIEW') throw new Error('Resource is no longer pending')
  if (resource.staging?.providerFileId && resource.transfer?.state === 'FAILED') {
    const stagingResource = { file: resource.staging }
    await remove(stagingResource)
    return Resource.findOneAndUpdate(
      { _id: resource._id, status: 'PENDING_REVIEW' },
      { $unset: { staging: 1 }, $set: { 'transfer.state': 'COMPLETED', 'transfer.error': '' } },
      { new: true },
    )
  }
  if (!isConfiguredStagingProvider(resourceProvider(resource))) return resource
  const claim = await Resource.updateOne(
    { _id: resource._id, status: 'PENDING_REVIEW', 'transfer.state': { $nin: ['IN_PROGRESS', 'COMPLETED'] } },
    { $set: { 'transfer.state': 'IN_PROGRESS', 'transfer.startedAt': new Date(), 'transfer.error': '' } },
  )
  if (!claim.matchedCount) throw new Error('Resource transfer is already in progress or completed')
  try {
    const permanent = await transferToGoogleDrive(resource)
    const updated = await Resource.findOneAndUpdate(
      { _id: resource._id, status: 'PENDING_REVIEW', 'transfer.state': 'IN_PROGRESS' },
      {
        $set: {
          'file.provider': permanent.provider,
          'file.providerFileId': permanent.providerFileId,
          'file.storageKey': permanent.storageKey,
          'file.folderId': permanent.folderId,
          'file.url': `/api/resources/${resource._id}/file`,
          'file.sizeBytes': permanent.sizeBytes,
          'file.status': 'READY',
          staging: {
            provider: resource.file.provider,
            providerFileId: resource.file.providerFileId,
            storageKey: resource.file.storageKey,
            bucket: resource.file.bucket,
          },
          'transfer.state': 'COMPLETED',
          'transfer.completedAt': new Date(),
        },
      },
      { new: true },
    )
    if (!updated) throw new Error('Resource changed during transfer')
    try {
      await remove(resource)
      await Resource.updateOne({ _id: updated._id }, { $unset: { staging: 1 } })
    } catch (cleanupError) {
      await Resource.updateOne({ _id: updated._id }, { $set: { 'transfer.state': 'FAILED', 'transfer.error': cleanupError.message } })
      throw cleanupError
    }
    return updated
  } catch (error) {
    await Resource.updateOne({ _id: resource._id }, { $set: { 'transfer.state': 'FAILED', 'transfer.error': error.message } })
    throw error
  }
}

export function startRetentionScheduler() {
  if (!env.RETENTION_ENABLED) return null
  const timer = setInterval(() => processRetention().catch((error) => logger.error('retention_job_failed', { error: error.message })), env.RETENTION_JOB_INTERVAL_MS)
  timer.unref?.()
  return timer
}

export { retentionDeadline, WARNING_DAYS }
