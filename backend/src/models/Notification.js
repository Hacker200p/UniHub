import mongoose from 'mongoose'

const notificationSchema = new mongoose.Schema({
  universityId: { type: String, required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  type: {
    type: String,
    enum: [
      'UPLOAD_APPROVED',
      'UPLOAD_REJECTED',
      'CHANGES_REQUESTED',
      'SUGGESTION_UPDATED',
      'REPORT_RESOLVED',
      'REPORT_DISMISSED',
      'REQUEST_REPLIED',
      'REPORT_REPLIED',
      'SECURITY_ALERT',
      'SYSTEM_ANNOUNCEMENT',
      'RETENTION_WARNING',
      'RETENTION_EXPIRING',
      'RETENTION_EXPIRED',
      'RETENTION_DEADLINE_CHANGED',
    ],
    required: true,
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  requestId: { type: mongoose.Schema.Types.ObjectId, ref: 'ResourceRequest' },
  suggestionId: { type: mongoose.Schema.Types.ObjectId, ref: 'Suggestion' },
  reportId: { type: mongoose.Schema.Types.ObjectId, ref: 'Report' },
  readAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })
notificationSchema.index({ userId: 1, createdAt: -1 })
export const Notification = mongoose.model('Notification', notificationSchema)
