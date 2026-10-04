import mongoose from 'mongoose'

const developerSchema = new mongoose.Schema({
  universityId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  role: { type: String, required: true, trim: true },
  description: { type: String, required: true, trim: true },
  avatarUrl: { type: String, default: '' },
  skills: { type: [String], default: [] },
  websiteUrl: { type: String, default: '' },
  githubUrl: { type: String, default: '' },
  linkedinUrl: { type: String, default: '' },
  displayOrder: { type: Number, default: 0 },
  isPublished: { type: Boolean, default: true },
}, { timestamps: true, versionKey: false })

developerSchema.index({ universityId: 1, name: 1 }, { unique: true })
export const Developer = mongoose.model('Developer', developerSchema)
