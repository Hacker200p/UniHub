import { Report, Suggestion } from '../models/Community.js'
import { Resource } from '../models/Resource.js'
import { User } from '../models/User.js'
import { Notification } from '../models/Notification.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { HttpError } from '../utils/httpError.js'
import { sendAdminReplyEmail } from '../services/mailer.js'
import { recordAudit } from '../utils/audit.js'
import { logger } from '../utils/logger.js'

export async function createSuggestion(req, res) {
  return successResponse(
    res,
    await Suggestion.create({
      ...req.body,
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
    }),
    'Suggestion submitted',
    201,
  )
}

export async function listMySuggestions(req, res) {
  return successResponse(
    res,
    await Suggestion.find({
      universityId: env.UNIVERSITY_ID,
      userId: req.user._id,
    }).sort({ createdAt: -1 }),
  )
}

export async function createReport(req, res) {
  const resourceExists = await Resource.exists({
    _id: req.params.resourceId,
    universityId: env.UNIVERSITY_ID,
    status: 'APPROVED',
  })
  if (!resourceExists) throw new HttpError(404, 'Resource not found')

  return successResponse(
    res,
    await Report.create({
      ...req.body,
      universityId: env.UNIVERSITY_ID,
      resourceId: req.params.resourceId,
      userId: req.user?._id || null,
    }),
    'Report submitted',
    201,
  )
}

/**
 * Returns OPEN items only — used for the quick-queue dashboard card.
 * Does NOT filter reports by status for the full management view; use listAllReports for that.
 */
export async function listModerationFeedback(req, res) {
  const [suggestions, reports] = await Promise.all([
    Suggestion.find({ universityId: env.UNIVERSITY_ID, status: 'OPEN' })
      .populate('userId', 'name email')
      .sort({ createdAt: 1 }),
    Report.find({ universityId: env.UNIVERSITY_ID })
      .populate('resourceId', 'title')
      .populate('userId', 'name email')
      .populate('resolvedBy', 'name')
      .sort({ createdAt: -1 }),
  ])
  return successResponse(res, { suggestions, reports })
}

/**
 * Admin-only: returns ALL reports with optional status filter. Used by the
 * full Reports Management View so resolved/dismissed reports remain auditable.
 */
export async function listAllReports(req, res) {
  const { status, resourceId } = req.query
  const query = { universityId: env.UNIVERSITY_ID }
  if (status && status !== 'ALL') query.status = status
  if (resourceId) query.resourceId = resourceId

  const reports = await Report.find(query)
    .populate('resourceId', 'title file.url')
    .populate('userId', 'name email')
    .populate('resolvedBy', 'name')
    .populate('statusHistory.changedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  return successResponse(res, reports)
}

/**
 * Admin-only: returns ALL suggestions with optional status filter.
 */
export async function listAllSuggestions(req, res) {
  const { status } = req.query
  const query = { universityId: env.UNIVERSITY_ID }
  if (status && status !== 'ALL') query.status = status

  const suggestions = await Suggestion.find(query)
    .populate('userId', 'name email')
    .populate('resolvedBy', 'name')
    .sort({ createdAt: -1 })
    .limit(200)
    .lean()

  return successResponse(res, suggestions)
}

export async function updateSuggestion(req, res) {
  const suggestion = await Suggestion.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!suggestion) throw new HttpError(404, 'Suggestion not found')

  const previousStatus = suggestion.status
  const newStatus = req.body.status || suggestion.status
  const replyText = typeof req.body.reply === 'string' ? req.body.reply.trim() : ''

  suggestion.status = newStatus
  if (replyText) {
    suggestion.adminReply = replyText
  }
  suggestion.resolvedAt = new Date()
  suggestion.resolvedBy = req.user._id
  await suggestion.save()

  // Notify original sender via in-app notification and email if a reply is provided or status changed
  if (suggestion.userId) {
    const creator = await User.findById(suggestion.userId).select('name email')
    if (creator) {
      const messageText = replyText
        ? `Staff responded to "${suggestion.title}": ${replyText}`
        : `Your suggestion "${suggestion.title}" status changed to ${newStatus}.`

      // In-app notification — persisted regardless of email success
      await Notification.create({
        universityId: env.UNIVERSITY_ID,
        userId: creator._id,
        type: replyText ? 'REQUEST_REPLIED' : 'SUGGESTION_UPDATED',
        title: 'Update on Your Suggestion',
        message: messageText,
        suggestionId: suggestion._id,
      })

      if (creator.email && (replyText || previousStatus !== newStatus)) {
        // Fire-and-forget email — failure does not revert the saved suggestion
        sendAdminReplyEmail({
          to: creator.email,
          recipientName: creator.name,
          itemType: 'Community Suggestion',
          itemTitle: suggestion.title,
          adminReply: replyText || `Status updated to ${newStatus}`,
          status: newStatus,
          viewUrl: `${env.CLIENT_URL}/dashboard`,
        }).catch((err) => logger.error('suggestion_reply_email_failed', { error: err.message }))
      }
    }
  }

  await recordAudit({
    actorId: req.user._id,
    action: 'SUGGESTION_REPLIED',
    entityType: 'Suggestion',
    entityId: suggestion._id,
    metadata: {
      status: newStatus,
      hasReply: Boolean(replyText),
    },
  })

  return successResponse(res, suggestion, 'Suggestion updated')
}

/**
 * General admin update for a report (status change + reply).
 * Reports remain in the admin interface until explicitly resolved or dismissed.
 */
export async function updateReport(req, res) {
  const report = await Report.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  }).populate('resourceId', 'title')
  if (!report) throw new HttpError(404, 'Report not found')

  // Guard: once a report is in a terminal state, only an admin can reopen
  const terminalStatuses = ['RESOLVED', 'DISMISSED']
  if (terminalStatuses.includes(report.status) && req.body.status && req.body.status !== report.status) {
    if (req.user.role !== 'ADMIN') {
      throw new HttpError(403, 'Only administrators can reopen a resolved or dismissed report')
    }
  }

  const previousStatus = report.status
  const newStatus = req.body.status || report.status
  const replyText = typeof req.body.reply === 'string' ? req.body.reply.trim() : ''

  report.status = newStatus
  if (replyText) {
    report.moderatorReply = replyText
    report.adminReply = replyText
  }

  if (newStatus === 'RESOLVED') {
    report.resolvedAt = new Date()
    report.resolvedBy = req.user._id
    report.resolutionNote = replyText || req.body.note || 'Resolved by administrator'
  } else if (newStatus === 'DISMISSED') {
    report.resolvedAt = new Date()
    report.resolvedBy = req.user._id
    report.dismissalReason = replyText || req.body.reason || 'Dismissed as false report'
  }

  // Track status changes in history
  if (previousStatus !== newStatus || replyText) {
    report.statusHistory.push({
      status: newStatus,
      changedBy: req.user._id,
      changedAt: new Date(),
      note: replyText || `Status changed from ${previousStatus} to ${newStatus}`,
    })
  }

  await report.save()

  // Notify original reporter when reply or terminal status is set
  if (report.userId && (replyText || newStatus === 'RESOLVED' || newStatus === 'DISMISSED')) {
    const reporter = await User.findById(report.userId).select('name email')
    if (reporter) {
      const resourceTitle = report.resourceId?.title || 'Academic Resource'
      let messageText = replyText
      let notifType = 'REPORT_REPLIED'
      let notifTitle = 'Update on Your Report'

      if (replyText) {
        messageText = `A moderator reviewed your report on "${resourceTitle}": ${replyText}`
        notifType = 'REPORT_REPLIED'
      } else if (newStatus === 'RESOLVED') {
        messageText = `Your report on "${resourceTitle}" has been resolved by our moderation team.`
        notifType = 'REPORT_RESOLVED'
        notifTitle = 'Your Report Has Been Resolved'
      } else if (newStatus === 'DISMISSED') {
        messageText = `Your report on "${resourceTitle}" was reviewed and found to be a false alarm.`
        notifType = 'REPORT_DISMISSED'
        notifTitle = 'Your Report Was Dismissed'
      }

      // In-app notification — saved regardless of email outcome
      await Notification.create({
        universityId: env.UNIVERSITY_ID,
        userId: reporter._id,
        type: notifType,
        title: notifTitle,
        message: messageText,
        reportId: report._id,
        resourceId: report.resourceId?._id || report.resourceId,
      })

      if (reporter.email) {
        sendAdminReplyEmail({
          to: reporter.email,
          recipientName: reporter.name,
          itemType: 'Resource Report',
          itemTitle: resourceTitle,
          adminReply: replyText || messageText,
          status: newStatus,
          viewUrl: `${env.CLIENT_URL}/resources/${report.resourceId?._id || report.resourceId}`,
        }).catch((err) => logger.error('report_reply_email_failed', { error: err.message }))
      }
    }
  }

  await recordAudit({
    actorId: req.user._id,
    action: newStatus === 'RESOLVED' ? 'REPORT_RESOLVED' : newStatus === 'DISMISSED' ? 'REPORT_DISMISSED' : 'REPORT_UPDATED',
    entityType: 'Report',
    entityId: report._id,
    metadata: {
      previousStatus,
      status: newStatus,
      hasReply: Boolean(replyText),
    },
  })

  return successResponse(res, report, 'Report updated')
}

/**
 * Explicitly resolve a report — moves it to RESOLVED terminal state.
 * Requires a resolution note. Notifies the original reporter.
 */
export async function resolveReport(req, res) {
  const report = await Report.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  }).populate('resourceId', 'title')
  if (!report) throw new HttpError(404, 'Report not found')

  if (report.status === 'RESOLVED') {
    return successResponse(res, report, 'Report is already resolved')
  }

  const resolutionNote = typeof req.body.note === 'string' ? req.body.note.trim() : ''

  const previousStatus = report.status
  report.status = 'RESOLVED'
  report.resolvedAt = new Date()
  report.resolvedBy = req.user._id
  report.resolutionNote = resolutionNote || 'Resolved by moderator'

  if (resolutionNote) {
    report.adminReply = resolutionNote
    report.moderatorReply = resolutionNote
  }

  report.statusHistory.push({
    status: 'RESOLVED',
    changedBy: req.user._id,
    changedAt: new Date(),
    note: resolutionNote || 'Resolved',
  })

  await report.save()

  // Notify reporter
  if (report.userId) {
    const reporter = await User.findById(report.userId).select('name email')
    if (reporter) {
      const resourceTitle = report.resourceId?.title || 'Academic Resource'
      const message = resolutionNote
        ? `Your report on "${resourceTitle}" has been resolved. Note: ${resolutionNote}`
        : `Your report on "${resourceTitle}" has been resolved by our moderation team.`

      await Notification.create({
        universityId: env.UNIVERSITY_ID,
        userId: reporter._id,
        type: 'REPORT_RESOLVED',
        title: 'Your Report Has Been Resolved',
        message,
        reportId: report._id,
        resourceId: report.resourceId?._id || report.resourceId,
      })

      if (reporter.email) {
        sendAdminReplyEmail({
          to: reporter.email,
          recipientName: reporter.name,
          itemType: 'Resource Report',
          itemTitle: resourceTitle,
          adminReply: resolutionNote || 'Your report has been resolved by our moderation team.',
          status: 'RESOLVED',
          viewUrl: `${env.CLIENT_URL}/resources/${report.resourceId?._id || report.resourceId}`,
        }).catch((err) => logger.error('report_resolve_email_failed', { error: err.message }))
      }
    }
  }

  await recordAudit({
    actorId: req.user._id,
    action: 'REPORT_RESOLVED',
    entityType: 'Report',
    entityId: report._id,
    metadata: { previousStatus, resolutionNote },
  })

  return successResponse(res, report, 'Report resolved')
}

/**
 * Explicitly dismiss a report as false/invalid — terminal state.
 * Requires a dismissal reason. Report data is preserved for audit.
 */
export async function dismissReport(req, res) {
  const report = await Report.findOne({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  }).populate('resourceId', 'title')
  if (!report) throw new HttpError(404, 'Report not found')

  if (report.status === 'DISMISSED') {
    return successResponse(res, report, 'Report is already dismissed')
  }

  const dismissalReason = typeof req.body.reason === 'string' ? req.body.reason.trim() : ''
  if (!dismissalReason) {
    throw new HttpError(400, 'A reason is required to dismiss a report as false')
  }

  const previousStatus = report.status
  report.status = 'DISMISSED'
  report.resolvedAt = new Date()
  report.resolvedBy = req.user._id
  report.dismissalReason = dismissalReason
  report.adminReply = dismissalReason
  report.moderatorReply = dismissalReason

  report.statusHistory.push({
    status: 'DISMISSED',
    changedBy: req.user._id,
    changedAt: new Date(),
    note: dismissalReason,
  })

  await report.save()

  // Notify reporter if authenticated
  if (report.userId) {
    const reporter = await User.findById(report.userId).select('name email')
    if (reporter) {
      const resourceTitle = report.resourceId?.title || 'Academic Resource'
      const message = `Your report on "${resourceTitle}" was reviewed and found to be a false alarm. Reason: ${dismissalReason}`

      await Notification.create({
        universityId: env.UNIVERSITY_ID,
        userId: reporter._id,
        type: 'REPORT_DISMISSED',
        title: 'Your Report Was Dismissed',
        message,
        reportId: report._id,
        resourceId: report.resourceId?._id || report.resourceId,
      })

      if (reporter.email) {
        sendAdminReplyEmail({
          to: reporter.email,
          recipientName: reporter.name,
          itemType: 'Resource Report',
          itemTitle: resourceTitle,
          adminReply: `Your report was reviewed. Result: False alarm / Dismissed.\n\nReason: ${dismissalReason}`,
          status: 'DISMISSED',
          viewUrl: `${env.CLIENT_URL}/resources/${report.resourceId?._id || report.resourceId}`,
        }).catch((err) => logger.error('report_dismiss_email_failed', { error: err.message }))
      }
    }
  }

  await recordAudit({
    actorId: req.user._id,
    action: 'REPORT_DISMISSED',
    entityType: 'Report',
    entityId: report._id,
    metadata: { previousStatus, dismissalReason },
  })

  return successResponse(res, report, 'Report marked as false/dismissed')
}
