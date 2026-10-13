import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import fs from 'node:fs/promises'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import { ResourceRequest } from '../src/models/ResourceRequest.js'
import { Report } from '../src/models/Community.js'
import { Notification } from '../src/models/Notification.js'
import { Program, Branch, Semester, Subject } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { createAccessToken } from '../src/utils/tokens.js'
import { isValidUniversityEmail, generateNumericOtp, hashOtp } from '../src/utils/universityEmail.js'

describe('Master Features: Admin Notifications, Contributor Eligibility, and University Email OTP', () => {
  let admin
  let adminToken
  let studentUser
  let studentToken
  let studentUser2
  let studentToken2
  let testProgram
  let testBranch
  let testSemester
  let testSubject

  const createdStorageKeys = []
  const storageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storage')

  beforeAll(async () => {
    await connectDatabase()
    const universityId = env.UNIVERSITY_ID

    testProgram = await Program.findOneAndUpdate(
      { universityId, slug: 'master-prog' },
      { universityId, name: 'Master Program', code: 'MPROG', slug: 'master-prog' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testBranch = await Branch.findOneAndUpdate(
      { universityId, programId: testProgram._id, slug: 'master-cse' },
      { universityId, programId: testProgram._id, name: 'Master CSE', code: 'MCSE', slug: 'master-cse' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, branchId: testBranch._id, number: 1 },
      { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'Master Sem 1', slug: 'master-sem-1', number: 1 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSubject = await Subject.findOneAndUpdate(
      { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, slug: 'master-sub' },
      { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, name: 'Master Subject', code: 'MSUB101', slug: 'master-sub' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    // Admin user
    admin = await User.create({
      universityId,
      name: 'System Administrator',
      email: `admin.${Date.now()}@silicon.ac.in`,
      role: 'ADMIN',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
      universityEmail: `admin.${Date.now()}@silicon.ac.in`,
      universityEmailVerifiedAt: new Date(),
    })
    adminToken = createAccessToken(admin)

    // Student 1 (initially unverified)
    studentUser = await User.create({
      universityId,
      name: 'First Student Contributor',
      email: `student1.${Date.now()}@university.edu`,
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
      publicProfile: true,
    })
    studentToken = createAccessToken(studentUser)

    // Student 2 (unverified, zero contributions)
    studentUser2 = await User.create({
      universityId,
      name: 'Zero Contribution Student',
      email: `student2.${Date.now()}@university.edu`,
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
      publicProfile: true,
    })
    studentToken2 = createAccessToken(studentUser2)
  })

  afterAll(async () => {
    for (const key of createdStorageKeys) {
      const filePath = path.resolve(storageRoot, key)
      await fs.unlink(filePath).catch(() => {})
    }
    await User.deleteMany({ _id: { $in: [admin._id, studentUser._id, studentUser2._id] } })
    await disconnectDatabase()
  })

  // =========================================================================
  // FEATURE 1: ADMIN REPLIES & SENDER IN-APP/EMAIL NOTIFICATIONS
  // =========================================================================
  describe('Feature 1: Admin Replies and Notifications', () => {
    let testRequest
    let testReport
    let pendingResource

    beforeAll(async () => {
      pendingResource = await Resource.create({
        universityId: env.UNIVERSITY_ID,
        contributorId: studentUser._id,
        title: 'Pending Math Notes',
        slug: `pending-math-notes-${Date.now()}`,
        programId: testProgram._id,
        branchId: testBranch._id,
        semesterId: testSemester._id,
        subjectId: testSubject._id,
        academicYear: 2024,
        resourceType: 'NOTES',
        status: 'PENDING_REVIEW',
        file: {
          url: '/storage/test/pending.pdf',
          storageKey: 'test/pending.pdf',
          fileName: 'pending.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 1024,
          sha256: 'a'.repeat(64),
        },
      })

      testRequest = await ResourceRequest.create({
        universityId: env.UNIVERSITY_ID,
        creatorId: studentUser._id,
        title: 'Graph Algorithms Lecture 4 Notes',
        description: 'Need notes covering shortest path algorithms',
        programId: testProgram._id,
        branchId: testBranch._id,
        semesterId: testSemester._id,
        subjectId: testSubject._id,
        status: 'OPEN',
      })

      testReport = await Report.create({
        universityId: env.UNIVERSITY_ID,
        resourceId: pendingResource._id,
        userId: studentUser._id,
        reason: 'INCORRECT_FILE',
        details: 'Page 3 contains an inverted inequality sign.',
        status: 'OPEN',
      })
    })

    afterAll(async () => {
      if (pendingResource) await Resource.deleteOne({ _id: pendingResource._id })
      if (testRequest) await ResourceRequest.deleteOne({ _id: testRequest._id })
      if (testReport) await Report.deleteOne({ _id: testReport._id })
    })

    it('rejects unauthorized users from replying to resource requests', async () => {
      const res = await request(app)
        .patch(`/api/admin/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reply: 'Unauthorized student response', status: 'OPEN' })

      expect(res.status).toBe(403)
    })

    it('saves admin reply to resource request and creates an in-app notification for the sender', async () => {
      const replyText = 'We have added notes covering Graph Algorithms to the catalog.'
      const res = await request(app)
        .patch(`/api/admin/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: replyText, status: 'FULFILLED' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.adminReply).toBe(replyText)
      expect(res.body.data.status).toBe('FULFILLED')

      const updatedReq = await ResourceRequest.findById(testRequest._id)
      expect(updatedReq.adminReply).toBe(replyText)
      expect(updatedReq.status).toBe('FULFILLED')
      expect(updatedReq.repliedAt).toBeDefined()
      expect(String(updatedReq.repliedBy)).toBe(String(admin._id))

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REQUEST_REPLIED',
        requestId: testRequest._id,
      })
      expect(notif).toBeDefined()
      expect(notif.title).toContain('Update on Your Resource Request')
      expect(notif.message).toContain(replyText)
      expect(String(notif.requestId)).toBe(String(testRequest._id))
    })

    it('saves admin reply to community report and dispatches notification to reporter', async () => {
      const reportReply = 'The typographical error has been corrected in the master document.'
      const res = await request(app)
        .patch(`/api/admin/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED', reply: reportReply })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('RESOLVED')
      expect(res.body.data.moderatorReply).toBe(reportReply)

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REPORT_REPLIED',
        reportId: testReport._id,
      })
      expect(notif).toBeDefined()
      expect(notif.title).toContain('Update on Your Report')
      expect(notif.message).toContain(reportReply)
      expect(String(notif.reportId)).toBe(String(testReport._id))
    })

    it('allows admin to request modifications from author and delivers notification', async () => {
      const changeMsg = 'Please add missing Chapter 3 formulas and re-export the PDF.'
      const res = await request(app)
        .patch(`/api/admin/resources/${pendingResource._id}/changes-requested`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: changeMsg })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.status).toBe('CHANGES_REQUESTED')
      expect(res.body.data.requestedChanges).toBe(changeMsg)

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'CHANGES_REQUESTED',
        resourceId: pendingResource._id,
      })
      expect(notif).toBeDefined()
      expect(notif.title).toContain('Changes requested')
      expect(notif.message).toContain(changeMsg)
    })

    it('preserves reports in management queue across replies and explicit dismissal', async () => {
      const report2 = await Report.create({
        universityId: env.UNIVERSITY_ID,
        resourceId: pendingResource._id,
        userId: studentUser._id,
        reason: 'POOR_QUALITY',
        details: 'Scan on page 2 is blurry',
        status: 'OPEN',
      })

      // Admin replies and marks INVESTIGATING
      const replyRes = await request(app)
        .patch(`/api/admin/reports/${report2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVESTIGATING', reply: 'We are investigating the scan quality.' })

      expect(replyRes.status).toBe(200)
      expect(replyRes.body.data.status).toBe('INVESTIGATING')

      // Must remain in reports list
      const listRes = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)

      expect(listRes.status).toBe(200)
      const found = listRes.body.data.find((r) => String(r._id) === String(report2._id))
      expect(found).toBeDefined()
      expect(found.status).toBe('INVESTIGATING')

      // Explicit dismiss as false
      const dismissRes = await request(app)
        .post(`/api/admin/reports/${report2._id}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'The scan was verified as clear and authentic.' })

      expect(dismissRes.status).toBe(200)
      expect(dismissRes.body.data.status).toBe('DISMISSED')

      const dismissNotif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REPORT_DISMISSED',
        reportId: report2._id,
      })
      expect(dismissNotif).toBeDefined()

      await Report.deleteOne({ _id: report2._id })
    })

    it('rejects cross-user access to request replies when not authorized', async () => {
      const res = await request(app)
        .patch(`/api/admin/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ reply: 'Student 2 trying to tamper', status: 'CLOSED' })

      expect(res.status).toBe(403)
    })
  })

  // =========================================================================
  // FEATURE 2: CONTRIBUTOR DIRECTORY ELIGIBILITY (>= 1 APPROVED CONTRIBUTIONS)
  // =========================================================================
  describe('Feature 2: Public Contributor Directory Eligibility', () => {
    let approvedResource

    afterAll(async () => {
      if (approvedResource) await Resource.deleteOne({ _id: approvedResource._id })
    })

    it('excludes users with zero approved contributions from the public contributor directory', async () => {
      const res = await request(app).get('/api/contributors')
      expect(res.status).toBe(200)

      const contributors = res.body.data || []
      const foundStudent1 = contributors.find((c) => String(c.id || c._id) === String(studentUser._id))
      const foundStudent2 = contributors.find((c) => String(c.id || c._id) === String(studentUser2._id))

      expect(foundStudent1).toBeUndefined()
      expect(foundStudent2).toBeUndefined()
    })

    it('restricts public profile of user with zero approved contributions with 404', async () => {
      const res = await request(app).get(`/api/contributors/${studentUser2._id}`)
      expect(res.status).toBe(404)
    })

    it('includes user in directory once they have at least 1 APPROVED contribution', async () => {
      approvedResource = await Resource.create({
        universityId: env.UNIVERSITY_ID,
        contributorId: studentUser._id,
        title: 'Approved Data Structures Notes',
        slug: `approved-ds-notes-${Date.now()}`,
        programId: testProgram._id,
        branchId: testBranch._id,
        semesterId: testSemester._id,
        subjectId: testSubject._id,
        academicYear: 2024,
        resourceType: 'NOTES',
        status: 'APPROVED',
        file: {
          url: '/storage/test/approved.pdf',
          storageKey: 'test/approved.pdf',
          fileName: 'approved.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 2048,
          sha256: 'b'.repeat(64),
        },
      })

      const res = await request(app).get('/api/contributors')
      expect(res.status).toBe(200)

      const contributors = res.body.data || []
      const found = contributors.find((c) => String(c.id || c._id) === String(studentUser._id))
      expect(found).toBeDefined()
      expect(found.approvedContributions).toBeGreaterThanOrEqual(1)

      const found2 = contributors.find((c) => String(c.id || c._id) === String(studentUser2._id))
      expect(found2).toBeUndefined()
    })

    it('allows public profile access for user with approved contributions without exposing private fields', async () => {
      const res = await request(app).get(`/api/contributors/${studentUser._id}`)
      expect(res.status).toBe(200)
      expect(res.body.data.contributor.name).toBe(studentUser.name)
      expect(res.body.data.contributor.email).toBeUndefined()
      expect(res.body.data.contributor.passwordHash).toBeUndefined()
      expect(res.body.data.contributor.universityEmailOtpHash).toBeUndefined()
    })
  })

  // =========================================================================
  // FEATURE 3: UNIVERSITY EMAIL OTP VERIFICATION & FIRST UPLOAD ENFORCEMENT
  // =========================================================================
  describe('Feature 3: University Email OTP Verification and First Upload Enforcement', () => {
    it('validates university domain strictly for silicon.ac.in', () => {
      expect(isValidUniversityEmail('student@silicon.ac.in')).toBe(true)
      expect(isValidUniversityEmail('FACULTY.TEST@SILICON.AC.IN')).toBe(true)
      expect(isValidUniversityEmail('student@gmail.com')).toBe(false)
      expect(isValidUniversityEmail('student@silicon.com')).toBe(false)
      expect(isValidUniversityEmail('student@fake-silicon.ac.in')).toBe(false)
      expect(isValidUniversityEmail('student@silicon.ac.in.attacker.com')).toBe(false)
      expect(isValidUniversityEmail('notanemail')).toBe(false)
    })

    it('generates secure 6-digit numeric OTPs', () => {
      const code1 = generateNumericOtp()
      const code2 = generateNumericOtp()
      expect(code1).toMatch(/^\d{6}$/)
      expect(code2).toMatch(/^\d{6}$/)
      expect(typeof code1).toBe('string')
    })

    it('blocks unverified user from uploading resources with 403', async () => {
      const dummyPdf = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1/Root 1 0 R>>\nstartxref\n50\n%%EOF')

      const res = await request(app)
        .post('/api/resources/upload')
        .set('Authorization', `Bearer ${studentToken2}`)
        .field('title', 'Unverified Upload Attempt')
        .field('programId', String(testProgram._id))
        .field('branchId', String(testBranch._id))
        .field('semesterId', String(testSemester._id))
        .field('subjectId', String(testSubject._id))
        .field('academicYear', '1')
        .field('resourceType', 'NOTES')
        .attach('pdf', dummyPdf, 'test.pdf')

      expect(res.status).toBe(403)
      expect(res.body.code).toBe('UNIVERSITY_EMAIL_VERIFICATION_REQUIRED')
      expect(res.body.message).toContain('silicon.ac.in')
    })

    it('rejects OTP request for non-silicon domain', async () => {
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'attacker@gmail.com' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('silicon.ac.in')
    })

    it('successfully requests OTP for valid @silicon.ac.in email', async () => {
      const validEmail = 'student2.test@silicon.ac.in'
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: validEmail })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.cooldownSeconds).toBe(60)
      expect(res.body.data.otp).toBeUndefined()

      const userInDb = await User.findById(studentUser2._id).select('+universityEmailOtpHash +universityEmailOtpExpiresAt')
      expect(userInDb.universityEmail).toBe(validEmail.toLowerCase())
      expect(userInDb.universityEmailOtpHash).toBeDefined()
      expect(userInDb.universityEmailOtpHash).toMatch(/^[a-f0-9]{64}$/)
      expect(userInDb.universityEmailOtpExpiresAt).toBeDefined()
    })

    it('enforces 60-second cooldown on consecutive OTP requests', async () => {
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in' })

      expect(res.status).toBe(429)
      expect(res.body.message).toContain('Please wait')
    })

    it('rejects incorrect OTP and counts attempts', async () => {
      const res = await request(app)
        .post('/api/user/university-email/verify-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in', otp: '000000' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Invalid verification code')

      const userInDb = await User.findById(studentUser2._id).select('+universityEmailOtpAttempts')
      expect(userInDb.universityEmailOtpAttempts).toBe(1)
    })

    it('successfully verifies with correct OTP and clears challenge data', async () => {
      const testCode = '654321'
      const hashed = hashOtp(testCode)
      await User.findByIdAndUpdate(studentUser2._id, {
        universityEmailOtpHash: hashed,
        universityEmailOtpExpiresAt: new Date(Date.now() + 10 * 60 * 1000),
        universityEmailOtpAttempts: 0,
      })

      const res = await request(app)
        .post('/api/user/university-email/verify-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in', otp: testCode })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.isVerified).toBe(true)

      const verifiedDbUser = await User.findById(studentUser2._id).select('+universityEmailOtpHash')
      expect(verifiedDbUser.universityEmailVerifiedAt).toBeDefined()
      expect(verifiedDbUser.universityEmailOtpHash).toBeUndefined()
    })

    it('prevents OTP replay after successful verification', async () => {
      const res = await request(app)
        .post('/api/user/university-email/verify-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in', otp: '654321' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('No active verification code')
    })

    it('allows verified user to proceed to resource upload', async () => {
      const dummyPdf = Buffer.from(
        `%PDF-1.4\n% Test upload: ${Date.now()}-${Math.random()}\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\nxref\n0 1\n0000000000 65535 f\ntrailer<</Size 1/Root 1 0 R>>\nstartxref\n50\n%%EOF`,
      )

      const res = await request(app)
        .post('/api/resources/upload')
        .set('Authorization', `Bearer ${studentToken2}`)
        .field('title', 'Verified Student First Upload')
        .field('programId', String(testProgram._id))
        .field('branchId', String(testBranch._id))
        .field('semesterId', String(testSemester._id))
        .field('subjectId', String(testSubject._id))
        .field('academicYear', '1')
        .field('resourceType', 'NOTES')
        .attach('pdf', dummyPdf, 'verified_lecture_notes.pdf')

      expect(res.status).toBe(201)
      expect(res.body.success).toBe(true)
      expect(res.body.data.resource.title).toBe('Verified Student First Upload')
      expect(res.body.data.resource.status).toBe('PENDING_REVIEW')

      if (res.body.data.resource.id) {
        await Resource.deleteOne({ _id: res.body.data.resource.id })
      }
      if (res.body.data.resource.storageKey) {
        createdStorageKeys.push(res.body.data.resource.storageKey)
      }
    })
  })
})
