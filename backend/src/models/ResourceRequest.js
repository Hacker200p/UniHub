import mongoose from 'mongoose'

const requestSchema = new mongoose.Schema({
  universityId: { type: String, required: true, index: true },
  creatorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, trim: true, maxlength: 2000, default: '' },
  programId: { type: mongoose.Schema.Types.ObjectId, ref: 'Program' },
  branchId: { type: mongoose.Schema.Types.ObjectId, ref: 'Branch' },
  semesterId: { type: mongoose.Schema.Types.ObjectId, ref: 'Semester' },
  subjectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Subject' },
  upvoterIds: { type: [mongoose.Schema.Types.ObjectId], default: [] },
  status: { type: String, enum: ['OPEN', 'FULFILLED', 'CLOSED'], default: 'OPEN', index: true },
  fulfilledResourceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Resource' },
  adminReply: { type: String, trim: true, maxlength: 2000, default: '' },
  repliedAt: { type: Date, default: null },
  repliedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false })
requestSchema.index({ universityId: 1, status: 1, createdAt: -1 })
export const ResourceRequest = mongoose.model('ResourceRequest', requestSchema)
