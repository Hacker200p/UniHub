import mongoose from 'mongoose'

const { Schema } = mongoose

const oauthHandoffCodeSchema = new Schema(
  {
    codeHash: { type: String, required: true, unique: true, index: true },
    universityId: { type: String, required: true, index: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    expiresAt: { type: Date, required: true },
    consumedAt: { type: Date, default: null },
  },
  {
    timestamps: true,
    versionKey: false,
  },
)

oauthHandoffCodeSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })

export const OAuthHandoffCode = mongoose.model('OAuthHandoffCode', oauthHandoffCodeSchema)
