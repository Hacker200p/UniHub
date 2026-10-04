import mongoose from 'mongoose'

const downloadSchema = new mongoose.Schema({
  universityId: { type: String, required: true, index: true },
  resourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource', required: true, index: true },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
}, { timestamps: { createdAt: true, updatedAt: false }, versionKey: false })

downloadSchema.index({ resourceId: 1, createdAt: -1 })
export const Download = mongoose.model('Download', downloadSchema)
