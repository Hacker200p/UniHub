import mongoose from 'mongoose'

const { Schema } = mongoose
const options = { timestamps: true, versionKey: false }

const academicBase = {
  universityId: { type: String, required: true, index: true },
  name: { type: String, required: true, trim: true },
  slug: { type: String, required: true, trim: true, lowercase: true },
  isActive: { type: Boolean, default: true },
}

const programSchema = new Schema({ ...academicBase, code: { type: String, required: true, trim: true, uppercase: true } }, options)
programSchema.index({ universityId: 1, slug: 1 }, { unique: true })

const branchSchema = new Schema({ ...academicBase, code: { type: String, required: true, trim: true, uppercase: true }, programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true } }, options)
branchSchema.index({ universityId: 1, programId: 1, slug: 1 }, { unique: true })

const semesterSchema = new Schema({
  ...academicBase,
  number: { type: Number, required: true, min: 1 },
  roman: { type: String, trim: true, default: '' },
  academicYear: { type: Number, min: 1, max: 10 },
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
}, options)
semesterSchema.index({ universityId: 1, programId: 1, branchId: 1, number: 1 }, { unique: true })

const subjectSchema = new Schema({
  ...academicBase,
  code: { type: String, trim: true, uppercase: true },
  programId: { type: Schema.Types.ObjectId, ref: 'Program', required: true },
  branchId: { type: Schema.Types.ObjectId, ref: 'Branch' },
  semesterId: { type: Schema.Types.ObjectId, ref: 'Semester', required: true },
  academicYear: { type: Number, min: 1, max: 10 },
  subjectType: { type: String, enum: ['Theory', 'Practical'], trim: true },
  electiveGroup: { type: String, trim: true, default: 'Core' },
  sourcePdf: { type: String, trim: true, default: '' },
  sourcePage: { type: String, trim: true, default: '' },
  description: { type: String, trim: true, default: '' },
}, options)
subjectSchema.index({ universityId: 1, semesterId: 1, slug: 1 }, { unique: true })
subjectSchema.index({ universityId: 1, programId: 1, branchId: 1, semesterId: 1 })
subjectSchema.index({ universityId: 1, name: 'text', code: 'text' })

export const Program = mongoose.model('Program', programSchema)
export const Branch = mongoose.model('Branch', branchSchema)
export const Semester = mongoose.model('Semester', semesterSchema)
export const Subject = mongoose.model('Subject', subjectSchema)
