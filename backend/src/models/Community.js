import mongoose from 'mongoose'

const { Schema } = mongoose
const suggestionSchema = new Schema({
  universityId: { type: String, required: true, index: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  description: { type: String, required: true, trim: true, maxlength: 3000 },
  category: { type: String, enum: ['MISSING_SUBJECT', 'MISSING_PYQ', 'BETTER_NOTES', 'INCORRECT_INFORMATION', 'FEATURE', 'RESOURCE_REQUEST', 'OTHER'], required: true },
  status: { type: String, enum: ['OPEN', 'ACCEPTED', 'REJECTED', 'COMPLETED'], default: 'OPEN', index: true },
  adminReply: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
}, { timestamps: true, versionKey: false })
const reportSchema = new Schema({
  universityId: { type: String, required: true, index: true },
  resourceId: { type: Schema.Types.ObjectId, ref: 'Resource', required: true },
  userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  reason: { type: String, enum: ['INCORRECT_FILE', 'WRONG_SUBJECT', 'WRONG_SEMESTER', 'DUPLICATE', 'POOR_QUALITY', 'COPYRIGHT_CONCERN', 'OTHER'], required: true },
  details: { type: String, maxlength: 1000, default: '' },
  status: { type: String, enum: ['OPEN', 'INVESTIGATING', 'RESOLVED', 'DISMISSED'], default: 'OPEN', index: true },
  moderatorReply: { type: String, default: '' },
  adminReply: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  resolutionNote: { type: String, default: '' },
  dismissalReason: { type: String, default: '' },
  statusHistory: [
    {
      status: String,
      changedBy: { type: Schema.Types.ObjectId, ref: 'User' },
      changedAt: { type: Date, default: Date.now },
      note: { type: String, default: '' },
    },
  ],
}, { timestamps: true, versionKey: false })
export const Suggestion = mongoose.model('Suggestion', suggestionSchema)
export const Report = mongoose.model('Report', reportSchema)
