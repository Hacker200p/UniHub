import mongoose from 'mongoose'

const auditSchema = new mongoose.Schema({
  universityId: { type: String, required: true, index: true },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  action: { type: String, required: true, index: true },
  entityType: { type: String, required: true },
  entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
  reason: { type: String, default: '' },
  metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })
auditSchema.index({ universityId: 1, createdAt: -1 })
export const AuditLog = mongoose.model('AuditLog', auditSchema)
