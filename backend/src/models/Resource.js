import mongoose from 'mongoose'

const { Schema } = mongoose
const resourceSchema = new Schema({
  universityId: { type: String, required: true, index: true },
  title: { type: String, required: true, trim: true, maxlength: 180 },
  slug: { type: String, required: true, trim: true, lowercase: true },
  description: { type: String, trim: true, maxlength: 3000, default: '' },
  resourceType: { type: String, enum: ['NOTES', 'PYQ', 'ASSIGNMENT', 'LAB_MATERIAL', 'REFERENCE', 'SYLLABUS', 'OTHER'], required: true },
  examType: { type: String, enum: ['MID_TERM', 'END_TERM', 'NONE'], default: 'NONE' },
  academicYear: { type: Number, min: 1, max: 2200 },
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
  contributorId: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  file: {
    url: { type: String },
    provider: { type: String, enum: ['local', 's3', 'r2', 'b2', 'google-drive'], default: 'local', index: true },
    providerFileId: { type: String },
    storageKey: { type: String, required: true },
    bucket: { type: String },
    folderId: { type: String },
    fileName: { type: String, required: true },
    mimeType: { type: String, enum: ['application/pdf'], required: true },
    sizeBytes: { type: Number, required: true, min: 1 },
    sha256: { type: String, required: true, index: true },
    status: { type: String, enum: ['PENDING', 'READY', 'FAILED', 'DELETED'], default: 'READY' },
    storedAt: { type: Date },
    deletedAt: { type: Date },
  },
  retention: {
    originalUploadedAt: { type: Date },
    deadline: { type: Date },
    extendedAt: { type: Date },
    extendedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    extensionReason: { type: String, default: '' },
    warningDaysSent: { type: [Number], default: [] },
    cleanupState: { type: String, enum: ['ELIGIBLE', 'IN_PROGRESS', 'COMPLETED', 'FAILED', 'DISABLED'], default: 'DISABLED' },
    cleanupError: { type: String, default: '' },
    lastCleanupAttemptAt: { type: Date },
    notificationFailures: { type: [String], default: [] },
  },
  transfer: {
    state: { type: String, enum: ['NOT_REQUIRED', 'PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED'], default: 'NOT_REQUIRED' },
    startedAt: { type: Date },
    completedAt: { type: Date },
    error: { type: String, default: '' },
  },
  staging: {
    provider: { type: String, enum: ['local', 's3', 'r2', 'b2', 'google-drive'] },
    providerFileId: { type: String },
    storageKey: { type: String },
    bucket: { type: String },
  },
  status: { type: String, enum: ['PENDING_REVIEW', 'APPROVED', 'REJECTED', 'CHANGES_REQUESTED'], default: 'PENDING_REVIEW', index: true },
  verified: { type: Boolean, default: false },
  rejectionReason: { type: String, default: '' },
  requestedChanges: { type: String, default: '' },
  downloadCount: { type: Number, default: 0, min: 0 },
  reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  reviewedAt: { type: Date },
}, { timestamps: true, versionKey: false })

resourceSchema.index({ universityId: 1, slug: 1 })
resourceSchema.index({ universityId: 1, status: 1, createdAt: -1 })
resourceSchema.index({ universityId: 1, title: 'text', description: 'text' })
resourceSchema.index({ universityId: 1, 'file.sha256': 1 }, { unique: true })
export const Resource = mongoose.model('Resource', resourceSchema)
