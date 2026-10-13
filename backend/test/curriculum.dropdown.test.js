import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { env } from '../src/config/env.js'
import { Program, Branch, Semester, Subject } from '../src/models/Academic.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import {
  parseAndValidateWorkbook,
  locateWorkbookFile,
  importCurriculum,
} from '../src/services/curriculumImporter.js'
import { validateAcademicHierarchy } from '../src/utils/academicValidation.js'

let app

describe('Curriculum Import & Cascading Academic Dropdowns', () => {
  let student
  let studentToken
  let btechProgram
  let imcaProgram
  let cseBranch
  let eceBranch
  let imcaBranch
  let cseSem1
  let cseSem3
  let sampleCseSubject

  beforeAll(async () => {
    await connectDatabase()
    const appModule = await import('../src/app.js')
    app = appModule.app

    // Run idempotent curriculum import
    await importCurriculum({ universityId: env.UNIVERSITY_ID, verbose: false })

    // Retrieve imported curriculum references
    btechProgram = await Program.findOne({ universityId: env.UNIVERSITY_ID, code: 'BTECH' })
    imcaProgram = await Program.findOne({ universityId: env.UNIVERSITY_ID, code: 'IMCA' })

    cseBranch = await Branch.findOne({ universityId: env.UNIVERSITY_ID, code: 'CSE' })
    eceBranch = await Branch.findOne({ universityId: env.UNIVERSITY_ID, code: 'ECE' })
    imcaBranch = await Branch.findOne({ universityId: env.UNIVERSITY_ID, code: 'IMCA' })

    cseSem1 = await Semester.findOne({
      universityId: env.UNIVERSITY_ID,
      programId: btechProgram._id,
      branchId: cseBranch._id,
      number: 1,
    })

    cseSem3 = await Semester.findOne({
      universityId: env.UNIVERSITY_ID,
      programId: btechProgram._id,
      branchId: cseBranch._id,
      number: 3,
    })

    sampleCseSubject = await Subject.findOne({
      universityId: env.UNIVERSITY_ID,
      programId: btechProgram._id,
      branchId: cseBranch._id,
      semesterId: cseSem1._id,
    })

    // Create a student user for upload authorization testing
    student = await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Curriculum Test Student',
      email: `curriculum.student.${Date.now()}@university.edu`,
      universityEmail: `curriculum.student.${Date.now()}@silicon.ac.in`,
      universityEmailVerifiedAt: new Date(),
      passwordHash: 'dummyHashForTestingCurriculum123456',
      role: 'STUDENT',
      programId: btechProgram._id,
      branchId: cseBranch._id,
      semesterId: cseSem1._id,
    })

    const tokenModule = await import('../src/utils/tokens.js')
    studentToken = tokenModule.createAccessToken(student)
  }, 60000)

  afterAll(async () => {
    if (student) {
      await User.deleteOne({ _id: student._id })
    }
    await disconnectDatabase()
  })

  describe('1. Spreadsheet Integrity & Parsing', () => {
    it('locates and parses all 787 subject rows from University_Subject_List.xlsx', () => {
      const filePath = locateWorkbookFile()
      expect(filePath).toBeTruthy()

      const analysis = parseAndValidateWorkbook(filePath)
      expect(analysis.totalRows).toBe(787)
      expect(analysis.validRows.length).toBe(787)
      expect(analysis.invalidRows.length).toBe(0)
      expect(analysis.naturalKeyDuplicates.length).toBe(0)
    })

    it('identifies shared subject codes across branches without duplicating curriculum entries', () => {
      const filePath = locateWorkbookFile()
      const analysis = parseAndValidateWorkbook(filePath)
      expect(analysis.sharedCodes.size).toBeGreaterThan(0)

      // Verify that code HS1001 appears across branches
      const hs1001 = analysis.sharedCodes.get('HS1001')
      expect(hs1001).toBeDefined()
      expect(hs1001.length).toBeGreaterThanOrEqual(5)
    })
  })

  describe('2. Idempotent Database Seeding', () => {
    it('re-running the import does not create duplicate curriculum records', async () => {
      const countBefore = await Subject.countDocuments({ universityId: env.UNIVERSITY_ID })

      const reRunSummary = await importCurriculum({
        universityId: env.UNIVERSITY_ID,
        verbose: false,
      })

      const countAfter = await Subject.countDocuments({ universityId: env.UNIVERSITY_ID })
      expect(reRunSummary.insertedSubjects).toBe(0)
      expect(reRunSummary.updatedSubjects).toBe(787)
      expect(countAfter).toBe(countBefore)
    })

    it('populates roman numerals and academic year on semesters', async () => {
      expect(cseSem1.roman).toBe('I')
      expect(cseSem1.academicYear).toBe(1)
      expect(cseSem3.roman).toBe('III')
      expect(cseSem3.academicYear).toBe(2)
    })
  })

  describe('3. Cascading Dropdown APIs', () => {
    it('GET /api/programs returns real programs including B.Tech and Integrated BCA + MCA', async () => {
      const res = await request(app).get('/api/programs')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const names = res.body.data.map((p) => p.name)
      expect(names).toContain('B.Tech')
      expect(names).toContain('Integrated BCA + MCA')
    })

    it('GET /api/branches filters branches by selected program', async () => {
      const btechRes = await request(app).get(`/api/branches?programId=${btechProgram._id}`)
      expect(btechRes.status).toBe(200)
      const btechCodes = btechRes.body.data.map((b) => b.code)
      expect(btechCodes).toContain('CSE')
      expect(btechCodes).toContain('ECE')
      expect(btechCodes).toContain('EE-VLSI')
      expect(btechCodes).not.toContain('IMCA')

      const imcaRes = await request(app).get(`/api/branches?programId=${imcaProgram._id}`)
      expect(imcaRes.status).toBe(200)
      const imcaCodes = imcaRes.body.data.map((b) => b.code)
      expect(imcaCodes).toContain('IMCA')
      expect(imcaCodes).not.toContain('CSE')
    })

    it('GET /api/academic-years returns valid study years for chosen program and branch', async () => {
      const btechYears = await request(app).get(
        `/api/academic-years?programId=${btechProgram._id}&branchId=${cseBranch._id}`,
      )
      expect(btechYears.status).toBe(200)
      expect(btechYears.body.data).toEqual([1, 2, 3, 4])

      const imcaYears = await request(app).get(
        `/api/academic-years?programId=${imcaProgram._id}&branchId=${imcaBranch._id}`,
      )
      expect(imcaYears.status).toBe(200)
      expect(imcaYears.body.data).toEqual([1, 2, 3, 4, 5])
    })

    it('GET /api/semesters filters semesters by academic year', async () => {
      const semRes = await request(app).get(
        `/api/semesters?programId=${btechProgram._id}&branchId=${cseBranch._id}&academicYear=2`,
      )
      expect(semRes.status).toBe(200)
      const numbers = semRes.body.data.map((s) => s.number)
      expect(numbers).toEqual([3, 4])
    })

    it('GET /api/subjects filters subjects by semester and supports type & elective filters', async () => {
      const subRes = await request(app).get(
        `/api/subjects?programId=${btechProgram._id}&branchId=${cseBranch._id}&semesterId=${cseSem1._id}`,
      )
      expect(subRes.status).toBe(200)
      expect(subRes.body.data.length).toBeGreaterThan(0)

      // Filter by Theory
      const theoryRes = await request(app).get(
        `/api/subjects?programId=${btechProgram._id}&branchId=${cseBranch._id}&semesterId=${cseSem1._id}&subjectType=Theory`,
      )
      expect(theoryRes.status).toBe(200)
      expect(theoryRes.body.data.every((s) => s.subjectType === 'Theory')).toBe(true)

      // Filter by Practical
      const practicalRes = await request(app).get(
        `/api/subjects?programId=${btechProgram._id}&branchId=${cseBranch._id}&semesterId=${cseSem1._id}&subjectType=Practical`,
      )
      expect(practicalRes.status).toBe(200)
      expect(practicalRes.body.data.every((s) => s.subjectType === 'Practical')).toBe(true)
    })
  })

  describe('4. Backend Academic Hierarchy Validation', () => {
    it('accepts a valid curriculum combination', async () => {
      const validated = await validateAcademicHierarchy({
        universityId: env.UNIVERSITY_ID,
        programId: btechProgram._id.toString(),
        branchId: cseBranch._id.toString(),
        academicYear: 1,
        semesterId: cseSem1._id.toString(),
        subjectId: sampleCseSubject._id.toString(),
      })
      expect(validated.program._id.toString()).toBe(btechProgram._id.toString())
      expect(validated.branch._id.toString()).toBe(cseBranch._id.toString())
      expect(validated.semester._id.toString()).toBe(cseSem1._id.toString())
      expect(validated.subject._id.toString()).toBe(sampleCseSubject._id.toString())
    })

    it('rejects a branch that does not belong to the selected program', async () => {
      await expect(
        validateAcademicHierarchy({
          universityId: env.UNIVERSITY_ID,
          programId: btechProgram._id.toString(),
          branchId: imcaBranch._id.toString(), // IMCA branch under B.Tech program -> invalid!
          semesterId: cseSem1._id.toString(),
          subjectId: sampleCseSubject._id.toString(),
        }),
      ).rejects.toThrow('Selected branch does not belong to the chosen academic program')
    })

    it('rejects a semester that does not belong to the chosen program or branch', async () => {
      await expect(
        validateAcademicHierarchy({
          universityId: env.UNIVERSITY_ID,
          programId: btechProgram._id.toString(),
          branchId: eceBranch._id.toString(),
          semesterId: cseSem1._id.toString(), // CSE semester for ECE branch
          subjectId: sampleCseSubject._id.toString(),
        }),
      ).rejects.toThrow('Selected semester does not belong to the chosen program or branch')
    })

    it('rejects a semester that does not match the chosen academic year', async () => {
      await expect(
        validateAcademicHierarchy({
          universityId: env.UNIVERSITY_ID,
          programId: btechProgram._id.toString(),
          branchId: cseBranch._id.toString(),
          academicYear: 1,
          semesterId: cseSem3._id.toString(), // Semester 3 is Year 2, not Year 1!
          subjectId: sampleCseSubject._id.toString(),
        }),
      ).rejects.toThrow('Selected semester does not match the chosen academic year')
    })

    it('rejects a subject that does not belong to the chosen curriculum combination', async () => {
      // Find a subject in semester 3
      const sem3Subject = await Subject.findOne({
        universityId: env.UNIVERSITY_ID,
        semesterId: cseSem3._id,
      })

      await expect(
        validateAcademicHierarchy({
          universityId: env.UNIVERSITY_ID,
          programId: btechProgram._id.toString(),
          branchId: cseBranch._id.toString(),
          semesterId: cseSem1._id.toString(),
          subjectId: sem3Subject._id.toString(), // Semester 3 subject in Semester 1!
        }),
      ).rejects.toThrow('Selected subject does not belong to the chosen curriculum combination')
    })

    it('enforces tenant isolation (rejects IDs from unrelated universityId)', async () => {
      await expect(
        validateAcademicHierarchy({
          universityId: 'other-university-tenant',
          programId: btechProgram._id.toString(),
          branchId: cseBranch._id.toString(),
          semesterId: cseSem1._id.toString(),
          subjectId: sampleCseSubject._id.toString(),
        }),
      ).rejects.toThrow('Invalid or inactive academic program')
    })
  })

  describe('5. Upload Endpoint Protection & Multi-Format Support', () => {
    it('POST /api/resources/upload rejects invalid academic combinations with 400', async () => {
      const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF')
      const res = await request(app)
        .post('/api/resources/upload')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('title', 'Invalid Hierarchy Upload')
        .field('resourceType', 'NOTES')
        .field('examType', 'NONE')
        .field('programId', btechProgram._id.toString())
        .field('branchId', imcaBranch._id.toString()) // Mismatched branch!
        .field('semesterId', cseSem1._id.toString())
        .field('subjectId', sampleCseSubject._id.toString())
        .attach('pdf', dummyPdf, 'test.pdf')

      expect(res.status).toBe(400)
      expect(res.body.success).toBe(false)
      expect(res.body.message).toContain('Selected branch does not belong to the chosen academic program')
    })

    it('POST /api/resources/upload successfully accepts valid academic combinations and stores real database IDs', async () => {
      const dummyPdf = Buffer.from(
        `%PDF-1.4\n%UniquePdfContent-${Date.now()}\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF`,
      )
      const res = await request(app)
        .post('/api/resources/upload')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('title', `Valid Hierarchy Notes ${Date.now()}`)
        .field('description', 'Verified curriculum notes for Semester I.')
        .field('resourceType', 'NOTES')
        .field('examType', 'NONE')
        .field('academicYear', '1')
        .field('programId', btechProgram._id.toString())
        .field('branchId', cseBranch._id.toString())
        .field('semesterId', cseSem1._id.toString())
        .field('subjectId', sampleCseSubject._id.toString())
        .attach('pdf', dummyPdf, 'valid_notes.pdf')

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.resource.id).toBeDefined()

      // Confirm resource in database has stored real database IDs
      const saved = await Resource.findById(res.body.data.resource.id).lean()
      expect(saved.programId.toString()).toBe(btechProgram._id.toString())
      expect(saved.branchId.toString()).toBe(cseBranch._id.toString())
      expect(saved.semesterId.toString()).toBe(cseSem1._id.toString())
      expect(saved.subjectId.toString()).toBe(sampleCseSubject._id.toString())
      expect(saved.status).toBe('PENDING_REVIEW')
    })

    it('supports PYQ upload distinguishing exam type and examination year', async () => {
      const dummyPdf = Buffer.from(
        `%PDF-1.4\n%UniquePyqContent-${Date.now()}\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF`,
      )
      const res = await request(app)
        .post('/api/resources/upload')
        .set('Authorization', `Bearer ${studentToken}`)
        .field('title', `End Term PYQ 2024 ${Date.now()}`)
        .field('resourceType', 'PYQ')
        .field('examType', 'END_TERM')
        .field('academicYear', '2024') // Calendar exam year
        .field('programId', btechProgram._id.toString())
        .field('branchId', cseBranch._id.toString())
        .field('semesterId', cseSem1._id.toString())
        .field('subjectId', sampleCseSubject._id.toString())
        .attach('pdf', dummyPdf, 'pyq_2024.pdf')

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)

      const savedPyq = await Resource.findById(res.body.data.resource.id).lean()
      expect(savedPyq.resourceType).toBe('PYQ')
      expect(savedPyq.examType).toBe('END_TERM')
      expect(savedPyq.academicYear).toBe(2024)
    })
  })
})
