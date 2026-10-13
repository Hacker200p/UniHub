import { ResourceRequest } from '../models/ResourceRequest.js'
import { Resource } from '../models/Resource.js'
import { Notification } from '../models/Notification.js'
import { User } from '../models/User.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { sendAdminReplyEmail } from '../services/mailer.js'
import { recordAudit } from '../utils/audit.js'
import { logger } from '../utils/logger.js'

export async function listRequests(req, res) {
  const requests = await ResourceRequest.find({ universityId: env.UNIVERSITY_ID })
    .populate('programId branchId semesterId subjectId', 'name code number')
    .populate('creatorId', 'name role')
    .sort({ status: 1, upvoterIds: -1, createdAt: -1 })
    .limit(100)
    .lean()

  return successResponse(
    res,
    requests.map((item) => ({
      ...item,
      upvotes: item.upvoterIds.length,
      hasUpvoted: Boolean(
        req.user?._id && item.upvoterIds.some((id) => id.toString() === req.user._id.toString()),
      ),
      upvoterIds: undefined,
    })),
  )
}

export async function createRequest(req, res) {
  return successResponse(
    res,
    await ResourceRequest.create({
      ...req.body,
      universityId: env.UNIVERSITY_ID,
      creatorId: req.user._id,
    }),
    'Resource request created',
    201,
  )
}

export async function upvoteRequest(req, res) {
  const request = await ResourceRequest.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!request) throw new HttpError(404, 'Resource request not found')

  const already = request.upvoterIds.some((id) => id.toString() === req.user._id.toString())
  if (already) request.upvoterIds.pull(req.user._id)
  else request.upvoterIds.addToSet(req.user._id)

  await request.save()
  return successResponse(
    res,
    { upvotes: request.upvoterIds.length, hasUpvoted: !already },
    already ? 'Upvote removed' : 'Request upvoted',
  )
}

export async function fulfillRequest(req, res) {
  const request = await ResourceRequest.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  const resource = await Resource.findOne({
    _id: req.body.resourceId,
    universityId: env.UNIVERSITY_ID,
    status: 'APPROVED',
  })
  if (!request || !resource) throw new HttpError(404, 'Request or approved resource not found')

  const replyText = typeof req.body.reply === 'string' ? req.body.reply.trim() : ''

  request.status = 'FULFILLED'
  request.fulfilledResourceId = resource._id
  if (replyText) {
    request.adminReply = replyText
  }
  request.repliedAt = new Date()
  request.repliedBy = req.user._id
  await request.save()

  // 1. In-app notifications to all requesting peers (creator + upvoters)
  const recipientIds = [
    ...new Set([request.creatorId.toString(), ...request.upvoterIds.map((id) => id.toString())]),
  ]
  await Notification.insertMany(
    recipientIds.map((userId) => ({
      universityId: env.UNIVERSITY_ID,
      userId,
      type: 'REQUEST_REPLIED',
      title: 'Resource request fulfilled',
      message: `${request.title} is now available in the library.${replyText ? ` Note: ${replyText}` : ''}`,
      resourceId: resource._id,
      requestId: request._id,
    })),
  )

  // 2. Email notification to original request creator
  const creator = await User.findById(request.creatorId).select('name email')
  if (creator?.email) {
    // Fire-and-forget — email failure does not revert the fulfilled request
    sendAdminReplyEmail({
      to: creator.email,
      recipientName: creator.name,
      itemType: 'Resource Request',
      itemTitle: request.title,
      adminReply: replyText || `Your request has been fulfilled with "${resource.title}". It is now available in the library.`,
      status: 'FULFILLED',
      viewUrl: `${env.CLIENT_URL}/resources/${resource._id}`,
    }).catch((err) => logger.error('fulfill_request_email_failed', { error: err.message }))
  }

  await recordAudit({
    actorId: req.user._id,
    action: 'REQUEST_FULFILLED',
    entityType: 'ResourceRequest',
    entityId: request._id,
    metadata: {
      fulfilledResourceId: resource._id,
      hasReply: Boolean(replyText),
    },
  })

  return successResponse(res, request, 'Resource request fulfilled')
}

/**
 * Administrative reply and status update for resource requests.
 */
export async function adminReplyRequest(req, res) {
  const request = await ResourceRequest.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!request) throw new HttpError(404, 'Resource request not found')

  const previousStatus = request.status
  const newStatus = req.body.status || request.status
  const replyText = typeof req.body.reply === 'string' ? req.body.reply.trim() : ''

  request.status = newStatus
  if (replyText) {
    request.adminReply = replyText
  }
  request.repliedAt = new Date()
  request.repliedBy = req.user._id
  await request.save()

  // 1. In-app notification for the original requester
  const creator = await User.findById(request.creatorId).select('name email')
  if (creator) {
    const messageText = replyText
      ? `Staff responded to "${request.title}": ${replyText}`
      : `Your request "${request.title}" status changed to ${newStatus}.`

    await Notification.create({
      universityId: env.UNIVERSITY_ID,
      userId: creator._id,
      type: 'REQUEST_REPLIED',
      title: 'Update on Your Resource Request',
      message: messageText,
      requestId: request._id,
    })

    // 2. Email notification to original requester — non-blocking
    if (creator.email && (replyText || previousStatus !== newStatus)) {
      sendAdminReplyEmail({
        to: creator.email,
        recipientName: creator.name,
        itemType: 'Resource Request',
        itemTitle: request.title,
        adminReply: replyText || `Status updated to ${newStatus}`,
        status: newStatus,
        viewUrl: `${env.CLIENT_URL}/requests`,
      }).catch((err) => logger.error('request_reply_email_failed', { error: err.message }))
    }
  }

  await recordAudit({
    actorId: req.user._id,
    action: 'REQUEST_REPLIED',
    entityType: 'ResourceRequest',
    entityId: request._id,
    metadata: {
      status: newStatus,
      hasReply: Boolean(replyText),
    },
  })

  return successResponse(res, request, 'Resource request updated')
}
