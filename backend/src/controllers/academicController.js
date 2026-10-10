import { Program, Branch, Semester, Subject } from '../models/Academic.js'
import { env } from '../config/env.js'
import { successResponse } from '../utils/apiResponse.js'
import { academicQuerySchema } from '../validators/academic.js'
import { HttpError } from '../utils/httpError.js'
import { slugify } from '../utils/slug.js'
import { recordAudit } from '../utils/audit.js'

export async function listPrograms(req, res) {
  return successResponse(
    res,
    await Program.find({ universityId: env.UNIVERSITY_ID, isActive: true }).sort({ name: 1 }),
  )
}

export async function listBranches(req, res) {
  const query = academicQuerySchema.parse(req.query)
  return successResponse(
    res,
    await Branch.find({
      universityId: env.UNIVERSITY_ID,
      ...(query.programId ? { programId: query.programId } : {}),
      isActive: true,
    }).sort({ name: 1 }),
  )
}

export async function listAcademicYears(req, res) {
  const query = academicQuerySchema.parse(req.query)
  const filter = {
    universityId: env.UNIVERSITY_ID,
    isActive: true,
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
  }
  const semesters = await Semester.find(filter).select('academicYear number').sort({ number: 1 })
  const years = [...new Set(semesters.map((s) => s.academicYear || Math.ceil(s.number / 2)).filter(Boolean))].sort((a, b) => a - b)
  return successResponse(res, years)
}

export async function listSemesters(req, res) {
  const query = academicQuerySchema.parse(req.query)
  const filter = {
    universityId: env.UNIVERSITY_ID,
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    isActive: true,
  }
  if (query.academicYear) {
    const yr = Number(query.academicYear)
    filter.$or = [
      { academicYear: yr },
      { number: { $in: [(yr - 1) * 2 + 1, yr * 2] } },
    ]
  }
  return successResponse(
    res,
    await Semester.find(filter).sort({ number: 1 }),
  )
}

export async function listSubjects(req, res) {
  const query = academicQuerySchema.parse(req.query)
  const filter = {
    universityId: env.UNIVERSITY_ID,
    ...(query.programId ? { programId: query.programId } : {}),
    ...(query.branchId ? { branchId: query.branchId } : {}),
    ...(query.semesterId ? { semesterId: query.semesterId } : {}),
    ...(query.academicYear ? { academicYear: Number(query.academicYear) } : {}),
    ...(query.subjectType ? { subjectType: query.subjectType } : {}),
    ...(query.electiveGroup ? { electiveGroup: query.electiveGroup } : {}),
    isActive: true,
  }
  return successResponse(
    res,
    await Subject.find(filter).sort({ code: 1, name: 1 }),
  )
}

// Admin Management APIs

export async function listAllAcademic(req, res) {
  const universityId = env.UNIVERSITY_ID
  const [programs, branches, semesters, subjects] = await Promise.all([
    Program.find({ universityId }).sort({ name: 1 }).lean(),
    Branch.find({ universityId }).populate('programId', 'name code').sort({ name: 1 }).lean(),
    Semester.find({ universityId })
      .populate('programId branchId', 'name code')
      .sort({ number: 1 })
      .lean(),
    Subject.find({ universityId })
      .populate('programId branchId semesterId', 'name code number')
      .sort({ name: 1 })
      .lean(),
  ])
  return successResponse(res, { programs, branches, semesters, subjects })
}

export async function createProgram(req, res) {
  const { name, code } = req.body
  if (!name || !code) throw new HttpError(400, 'Name and code are required')
  const slug = slugify(code || name)
  const program = await Program.create({
    universityId: env.UNIVERSITY_ID,
    name,
    code: code.toUpperCase(),
    slug,
  })
  await recordAudit({
    actorId: req.user._id,
    action: 'PROGRAM_CREATED',
    entityType: 'Program',
    entityId: program._id,
  })
  return successResponse(res, program, 'Program created', 201)
}

export async function updateProgram(req, res) {
  const program = await Program.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    req.body,
    { new: true, runValidators: true },
  )
  if (!program) throw new HttpError(404, 'Program not found')
  return successResponse(res, program, 'Program updated')
}

export async function deleteProgram(req, res) {
  const program = await Program.findOneAndDelete({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!program) throw new HttpError(404, 'Program not found')
  return successResponse(res, null, 'Program deleted')
}

export async function createBranch(req, res) {
  const { name, code, programId } = req.body
  if (!name || !code || !programId) throw new HttpError(400, 'Name, code, and program are required')
  const slug = slugify(code || name)
  const branch = await Branch.create({
    universityId: env.UNIVERSITY_ID,
    programId,
    name,
    code: code.toUpperCase(),
    slug,
  })
  await recordAudit({
    actorId: req.user._id,
    action: 'BRANCH_CREATED',
    entityType: 'Branch',
    entityId: branch._id,
  })
  return successResponse(res, branch, 'Branch created', 201)
}

export async function updateBranch(req, res) {
  const branch = await Branch.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    req.body,
    { new: true, runValidators: true },
  )
  if (!branch) throw new HttpError(404, 'Branch not found')
  return successResponse(res, branch, 'Branch updated')
}

export async function deleteBranch(req, res) {
  const branch = await Branch.findOneAndDelete({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!branch) throw new HttpError(404, 'Branch not found')
  return successResponse(res, null, 'Branch deleted')
}

export async function createSemester(req, res) {
  const { name, number, programId, branchId } = req.body
  if (!number || !programId) throw new HttpError(400, 'Semester number and program are required')
  const slug = `sem-${number}-${Date.now()}`
  const semester = await Semester.create({
    universityId: env.UNIVERSITY_ID,
    programId,
    branchId: branchId || undefined,
    number: Number(number),
    name: name || `Semester ${number}`,
    slug,
  })
  return successResponse(res, semester, 'Semester created', 201)
}

export async function updateSemester(req, res) {
  const semester = await Semester.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    req.body,
    { new: true, runValidators: true },
  )
  if (!semester) throw new HttpError(404, 'Semester not found')
  return successResponse(res, semester, 'Semester updated')
}

export async function deleteSemester(req, res) {
  const semester = await Semester.findOneAndDelete({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!semester) throw new HttpError(404, 'Semester not found')
  return successResponse(res, null, 'Semester deleted')
}

export async function createSubject(req, res) {
  const { name, code, programId, branchId, semesterId, description } = req.body
  if (!name || !programId || !semesterId) {
    throw new HttpError(400, 'Name, program, and semester are required')
  }
  const slug = slugify(name)
  const subject = await Subject.create({
    universityId: env.UNIVERSITY_ID,
    programId,
    branchId: branchId || undefined,
    semesterId,
    name,
    code: code ? code.toUpperCase() : '',
    slug,
    description: description || '',
  })
  await recordAudit({
    actorId: req.user._id,
    action: 'SUBJECT_CREATED',
    entityType: 'Subject',
    entityId: subject._id,
  })
  return successResponse(res, subject, 'Subject created', 201)
}

export async function updateSubject(req, res) {
  const subject = await Subject.findOneAndUpdate(
    { _id: req.params.id, universityId: env.UNIVERSITY_ID },
    req.body,
    { new: true, runValidators: true },
  )
  if (!subject) throw new HttpError(404, 'Subject not found')
  return successResponse(res, subject, 'Subject updated')
}

export async function deleteSubject(req, res) {
  const subject = await Subject.findOneAndDelete({
    _id: req.params.id,
    universityId: env.UNIVERSITY_ID,
  })
  if (!subject) throw new HttpError(404, 'Subject not found')
  return successResponse(res, null, 'Subject deleted')
}
