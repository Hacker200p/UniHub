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
      'SECURITY_ALERT',
      'SYSTEM_ANNOUNCEMENT',
    ],
    required: true,
  },
  title: { type: String, required: true, trim: true },
  message: { type: String, required: true, trim: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  readAt: { type: Date, default: null },
}, { timestamps: true, versionKey: false })
notificationSchema.index({ userId: 1, createdAt: -1 })
export const Notification = mongoose.model('Notification', notificationSchema)
