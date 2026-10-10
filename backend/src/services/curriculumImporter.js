import fs from 'fs'
import path from 'path'
import * as XLSX from 'xlsx'
import { Program, Branch, Semester, Subject } from '../models/Academic.js'
import { env } from '../config/env.js'
import { slugify } from '../utils/slug.js'

const ROMAN_TO_NUM = {
  I: 1,
  II: 2,
  III: 3,
  IV: 4,
  V: 5,
  VI: 6,
  VII: 7,
  VIII: 8,
  IX: 9,
  X: 10,
}

const BRANCH_NAMES = {
  CSE: 'Computer Science and Engineering',
  ECE: 'Electronics and Communication Engineering',
  'EE-VLSI': 'Electronics Engineering (VLSI Design & Technology)',
  EEE: 'Electrical and Electronics Engineering',
  EIE: 'Electronics and Instrumentation Engineering',
  IMCA: 'Integrated BCA + MCA',
}

const PROGRAM_CONFIG = {
  'B.Tech': { code: 'BTECH', slug: 'b-tech' },
  'Integrated BCA + MCA': { code: 'IMCA', slug: 'imca' },
}

export function locateWorkbookFile() {
  const candidates = [
    path.resolve(process.cwd(), 'University_Subject_List.xlsx'),
    path.resolve(process.cwd(), '../University_Subject_List.xlsx'),
    path.resolve('c:/Users/ASUS/Desktop/University/University_Subject_List.xlsx'),
    path.resolve('c:/Users/ASUS/Downloads/University_Subject_List.xlsx'),
  ]

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate
    }
  }

  throw new Error(
    `University_Subject_List.xlsx was not found at any expected location: ${candidates.join(', ')}`,
  )
}

export function parseAndValidateWorkbook(filePath) {
  const buffer = fs.readFileSync(filePath)
  const workbook = XLSX.read(buffer, { type: 'buffer' })

  const sheetName = workbook.SheetNames.includes('Subjects') ? 'Subjects' : workbook.SheetNames[0]
  const sheet = workbook.Sheets[sheetName]
  if (!sheet) {
    throw new Error(`Worksheet 'Subjects' not found in ${filePath}`)
  }

  const rawRows = XLSX.utils.sheet_to_json(sheet, { defval: '' })
  const totalRows = rawRows.length

  const requiredFields = [
    'Program',
    'Branch',
    'Academic Year',
    'Semester',
    'Subject Type',
    'Subject Code',
    'Subject Name',
  ]

  const invalidRows = []
  const validRows = []
  const codeOccurrences = new Map()
  const naturalKeySet = new Set()
  const naturalKeyDuplicates = []

  rawRows.forEach((row, index) => {
    const rowNum = index + 2 // 1-indexed including header
    const missing = requiredFields.filter((f) => !row[f] || String(row[f]).trim() === '')
    if (missing.length > 0) {
      invalidRows.push({ rowNum, row, missing })
      return
    }

    const cleaned = {
      program: String(row['Program']).trim(),
      branch: String(row['Branch']).trim(),
      academicYear: Number(row['Academic Year']),
      semesterRoman: String(row['Semester']).trim().toUpperCase(),
      semesterNumber: ROMAN_TO_NUM[String(row['Semester']).trim().toUpperCase()],
      subjectType: String(row['Subject Type']).trim(),
      electiveGroup: String(row['Elective Group'] || 'Core').trim(),
      subjectCode: String(row['Subject Code']).trim().toUpperCase(),
      subjectName: String(row['Subject Name']).trim(),
      sourcePdf: String(row['Source PDF'] || '').trim(),
      sourcePage: String(row['Source Page'] || '').trim(),
    }

    if (!cleaned.semesterNumber) {
      invalidRows.push({
        rowNum,
        row,
        error: `Unknown semester label: ${row['Semester']}`,
      })
      return
    }

    // Natural key duplicate detection
    const natKey = `${cleaned.program}|${cleaned.branch}|${cleaned.semesterRoman}|${cleaned.subjectCode}|${cleaned.subjectType}|${cleaned.electiveGroup}`
    if (naturalKeySet.has(natKey)) {
      naturalKeyDuplicates.push({ rowNum, natKey, row: cleaned })
    } else {
      naturalKeySet.add(natKey)
    }

    // Shared codes across branches/semesters
    const curCodes = codeOccurrences.get(cleaned.subjectCode) || []
    curCodes.push({
      program: cleaned.program,
      branch: cleaned.branch,
      semester: cleaned.semesterRoman,
      name: cleaned.subjectName,
    })
    codeOccurrences.set(cleaned.subjectCode, curCodes)

    validRows.push(cleaned)
  })

  // Shared codes: codes that appear multiple times legitimately across combinations
  const sharedCodes = new Map()
  for (const [code, entries] of codeOccurrences.entries()) {
    if (entries.length > 1) {
      sharedCodes.set(code, entries)
    }
  }

  return {
    filePath,
    sheetName,
    totalRows,
    validRows,
    invalidRows,
    naturalKeyDuplicates,
    sharedCodes,
  }
}

export async function importCurriculum({ universityId = env.UNIVERSITY_ID, verbose = true } = {}) {
  const filePath = locateWorkbookFile()
  if (verbose) {
    console.log(`[CurriculumImport] Located source spreadsheet: ${filePath}`)
  }

  const analysis = parseAndValidateWorkbook(filePath)
  if (verbose) {
    console.log(`[CurriculumImport] Total spreadsheet rows parsed: ${analysis.totalRows}`)
    console.log(`[CurriculumImport] Valid rows: ${analysis.validRows.length}`)
    console.log(`[CurriculumImport] Missing/invalid rows: ${analysis.invalidRows.length}`)
    console.log(`[CurriculumImport] Natural key duplicates: ${analysis.naturalKeyDuplicates.length}`)
    console.log(`[CurriculumImport] Distinct subject codes: ${analysis.sharedCodes.size} shared across multiple branches/semesters`)
  }

  if (analysis.invalidRows.length > 0) {
    console.warn(`[CurriculumImport] Warning: ${analysis.invalidRows.length} rows failed validation and will be skipped.`)
  }

  // 1. Programs Upsert
  const programMap = new Map() // name -> doc
  const uniquePrograms = [...new Set(analysis.validRows.map((r) => r.program))]

  for (const progName of uniquePrograms) {
    const config = PROGRAM_CONFIG[progName] || {
      code: slugify(progName).toUpperCase().slice(0, 8),
      slug: slugify(progName),
    }

    // Search existing by code or slug to preserve IDs
    let progDoc = await Program.findOne({
      universityId,
      $or: [{ slug: config.slug }, { code: config.code }, { name: progName }],
    })

    if (progDoc) {
      progDoc.name = progName
      progDoc.code = config.code
      progDoc.slug = config.slug
      progDoc.isActive = true
      await progDoc.save()
    } else {
      progDoc = await Program.create({
        universityId,
        name: progName,
        code: config.code,
        slug: config.slug,
        isActive: true,
      })
    }
    programMap.set(progName, progDoc)
  }

  // 2. Branches Upsert
  const branchMap = new Map() // `${program}|${branch}` -> doc
  const uniqueBranches = [
    ...new Set(analysis.validRows.map((r) => `${r.program}|${r.branch}`)),
  ]

  for (const progBranch of uniqueBranches) {
    const [progName, branchCode] = progBranch.split('|')
    const progDoc = programMap.get(progName)
    const branchName = BRANCH_NAMES[branchCode] || branchCode
    const branchSlug = slugify(branchCode)

    // Match existing branch by code or slug within program to preserve IDs
    let branchDoc = await Branch.findOne({
      universityId,
      programId: progDoc._id,
      $or: [
        { code: branchCode },
        { slug: branchSlug },
        ...(branchCode === 'EE-VLSI' ? [{ code: 'VLSI' }, { slug: 'vlsi' }] : []),
        ...(branchCode === 'IMCA' ? [{ code: 'IMCA' }, { slug: 'imca' }] : []),
      ],
    })

    if (branchDoc) {
      branchDoc.name = branchName
      branchDoc.code = branchCode
      branchDoc.slug = branchSlug
      branchDoc.isActive = true
      await branchDoc.save()
    } else {
      branchDoc = await Branch.create({
        universityId,
        programId: progDoc._id,
        name: branchName,
        code: branchCode,
        slug: branchSlug,
        isActive: true,
      })
    }
    branchMap.set(progBranch, branchDoc)
  }

  // 3. Semesters Upsert
  const semesterMap = new Map() // `${program}|${branch}|${semNum}` -> doc
  const uniqueSemesters = [
    ...new Set(
      analysis.validRows.map(
        (r) => `${r.program}|${r.branch}|${r.semesterNumber}|${r.semesterRoman}|${r.academicYear}`,
      ),
    ),
  ]

  for (const semKey of uniqueSemesters) {
    const [progName, branchCode, semNumStr, semRoman, academicYearStr] = semKey.split('|')
    const progDoc = programMap.get(progName)
    const branchDoc = branchMap.get(`${progName}|${branchCode}`)
    const semNum = Number(semNumStr)
    const academicYear = Number(academicYearStr)

    // Find existing semester by program + branch + number
    let semDoc = await Semester.findOne({
      universityId,
      programId: progDoc._id,
      branchId: branchDoc._id,
      number: semNum,
    })

    // If IMCA legacy semester exists with branchId null/undefined, link it
    if (!semDoc && branchCode === 'IMCA') {
      semDoc = await Semester.findOne({
        universityId,
        programId: progDoc._id,
        number: semNum,
        $or: [{ branchId: null }, { branchId: { $exists: false } }],
      })
    }

    const semName = `Semester ${semRoman}`
    const semSlug = `${branchCode.toLowerCase()}-sem-${semNum}`

    if (semDoc) {
      semDoc.name = semName
      semDoc.roman = semRoman
      semDoc.academicYear = academicYear
      semDoc.branchId = branchDoc._id
      semDoc.isActive = true
      await semDoc.save()
    } else {
      semDoc = await Semester.create({
        universityId,
        programId: progDoc._id,
        branchId: branchDoc._id,
        number: semNum,
        roman: semRoman,
        academicYear,
        name: semName,
        slug: semSlug,
        isActive: true,
      })
    }
    semesterMap.set(`${progName}|${branchCode}|${semNum}`, semDoc)
  }

  // 4. Subjects Upsert (High-Performance Bulk Idempotent Natural Key)
  let insertedSubjects = 0
  let updatedSubjects = 0

  const existingSubjects = await Subject.find({ universityId }).lean()
  const subjectByKey = new Map()
  const subjectBySlug = new Map()

  for (const sub of existingSubjects) {
    const natKey = `${sub.programId}|${sub.branchId || ''}|${sub.semesterId}|${sub.code}|${sub.subjectType || ''}|${sub.electiveGroup || ''}`
    subjectByKey.set(natKey, sub)
    const slugKey = `${sub.semesterId}|${sub.slug}`
    subjectBySlug.set(slugKey, sub)
  }

  const bulkOps = []
  for (const row of analysis.validRows) {
    const progDoc = programMap.get(row.program)
    const branchDoc = branchMap.get(`${row.program}|${row.branch}`)
    const semDoc = semesterMap.get(`${row.program}|${row.branch}|${row.semesterNumber}`)

    const naturalSlug = slugify(
      `${row.subjectCode}-${row.subjectName}-${row.electiveGroup}-${row.subjectType}`,
    )

    const natKey = `${progDoc._id}|${branchDoc._id}|${semDoc._id}|${row.subjectCode}|${row.subjectType}|${row.electiveGroup}`
    const slugKey = `${semDoc._id}|${naturalSlug}`

    const existing = subjectByKey.get(natKey) || subjectBySlug.get(slugKey)

    const subjectData = {
      universityId,
      programId: progDoc._id,
      branchId: branchDoc._id,
      semesterId: semDoc._id,
      name: row.subjectName,
      code: row.subjectCode,
      slug: naturalSlug,
      academicYear: row.academicYear,
      subjectType: row.subjectType,
      electiveGroup: row.electiveGroup,
      sourcePdf: row.sourcePdf,
      sourcePage: row.sourcePage,
      description: `${row.subjectType} subject (${row.electiveGroup}) from ${row.sourcePdf || 'University Curriculum'}.`,
      isActive: true,
    }

    if (existing) {
      bulkOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: subjectData },
        },
      })
      updatedSubjects += 1
    } else {
      bulkOps.push({
        insertOne: {
          document: subjectData,
        },
      })
      insertedSubjects += 1
    }
  }

  if (bulkOps.length > 0) {
    await Subject.bulkWrite(bulkOps, { ordered: false })
  }

  const finalSubjectCount = await Subject.countDocuments({ universityId })
  const finalSemesterCount = await Semester.countDocuments({ universityId })
  const finalBranchCount = await Branch.countDocuments({ universityId })
  const finalProgramCount = await Program.countDocuments({ universityId })

  const summary = {
    totalRowsParsed: analysis.totalRows,
    validRows: analysis.validRows.length,
    invalidRows: analysis.invalidRows.length,
    naturalKeyDuplicates: analysis.naturalKeyDuplicates.length,
    sharedSubjectCodesCount: analysis.sharedCodes.size,
    insertedSubjects,
    updatedSubjects,
    databaseTotals: {
      programs: finalProgramCount,
      branches: finalBranchCount,
      semesters: finalSemesterCount,
      subjects: finalSubjectCount,
    },
  }

  if (verbose) {
    console.log('[CurriculumImport] Import finished successfully.')
    console.log(JSON.stringify(summary, null, 2))
  }

  return summary
}
