import mongoose from 'mongoose'

const { Schema } = mongoose

const refreshSessionSchema = new Schema(
  {
    universityId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    familyId: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByTokenHash: { type: String, default: null },
    lastUsedAt: { type: Date, default: Date.now },
    revokedReason: { type: String, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

// Indexes for lookup, family/user security queries, and automatic TTL expiration
refreshSessionSchema.index({ universityId: 1, tokenHash: 1 }, { unique: true })
refreshSessionSchema.index({ universityId: 1, familyId: 1 })
refreshSessionSchema.index({ universityId: 1, userId: 1 })
refreshSessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const RefreshSession = mongoose.model('RefreshSession', refreshSessionSchema)
