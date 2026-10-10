import { Program, Branch, Semester, Subject } from '../models/Academic.js'
import { HttpError } from './httpError.js'
import { env } from '../config/env.js'

export async function validateAcademicHierarchy({
  universityId = env.UNIVERSITY_ID,
  programId,
  branchId,
  semesterId,
  subjectId,
  academicYear,
}) {
  if (!programId) {
    throw new HttpError(400, 'Academic program is required')
  }
  if (!semesterId) {
    throw new HttpError(400, 'Academic semester is required')
  }
  if (!subjectId) {
    throw new HttpError(400, 'Academic subject is required')
  }

  // 1. Program validation
  const program = await Program.findOne({
    _id: programId,
    universityId,
    isActive: true,
  })
  if (!program) {
    throw new HttpError(400, 'Invalid or inactive academic program')
  }

  // Check if this program has branches configured
  const programHasBranches = await Branch.exists({
    universityId,
    programId,
    isActive: true,
  })

  // 2. Branch validation
  let branch = null
  if (branchId) {
    branch = await Branch.findOne({
      _id: branchId,
      universityId,
      programId,
      isActive: true,
    })
    if (!branch) {
      throw new HttpError(400, 'Selected branch does not belong to the chosen academic program')
    }
  } else if (programHasBranches) {
    // If program has branches, a branch is expected for proper curriculum mapping
    // But allow legacy calls if branchId was not provided, provided semester/subject match
  }

  // 3. Semester validation
  const semQuery = {
    _id: semesterId,
    universityId,
    programId,
    isActive: true,
  }
  if (branchId) {
    semQuery.$or = [{ branchId }, { branchId: null }, { branchId: { $exists: false } }]
  }
  const semester = await Semester.findOne(semQuery)
  if (!semester) {
    throw new HttpError(400, 'Selected semester does not belong to the chosen program or branch')
  }

  // If academicYear is specified and represents year of study (1-10)
  if (academicYear !== undefined && academicYear !== null && Number(academicYear) < 100) {
    const semYear = semester.academicYear || Math.ceil(semester.number / 2)
    if (semYear !== Number(academicYear)) {
      throw new HttpError(400, 'Selected semester does not match the chosen academic year')
    }
  }

  // 4. Subject validation
  const subQuery = {
    _id: subjectId,
    universityId,
    programId,
    semesterId,
    isActive: true,
  }
  if (branchId) {
    subQuery.$or = [{ branchId }, { branchId: null }, { branchId: { $exists: false } }]
  }
  const subject = await Subject.findOne(subQuery)
  if (!subject) {
    throw new HttpError(400, 'Selected subject does not belong to the chosen curriculum combination')
  }

  return { program, branch, semester, subject }
}
