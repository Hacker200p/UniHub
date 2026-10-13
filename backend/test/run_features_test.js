import assert from 'node:assert/strict'
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

async function run() {
  console.log('--- Starting Integration Test Suite for UniHub Master Features ---')
  await connectDatabase()
  const universityId = env.UNIVERSITY_ID

  let passed = 0
  let failed = 0

  async function test(name, fn) {
    try {
      await fn()
      console.log(`  ✓ PASS: ${name}`)
      passed++
    } catch (err) {
      console.error(`  ✗ FAIL: ${name}`)
      console.error(err)
      failed++
    }
  }

  const testProgram = await Program.findOneAndUpdate(
    { universityId, slug: 'master-prog' },
    { universityId, name: 'Master Program', code: 'MPROG', slug: 'master-prog' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const testBranch = await Branch.findOneAndUpdate(
    { universityId, programId: testProgram._id, slug: 'master-cse' },
    { universityId, programId: testProgram._id, name: 'Master CSE', code: 'MCSE', slug: 'master-cse' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const testSemester = await Semester.findOneAndUpdate(
    { universityId, programId: testProgram._id, branchId: testBranch._id, number: 1 },
    { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'Master Sem 1', slug: 'master-sem-1', number: 1 },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const testSubject = await Subject.findOneAndUpdate(
    { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, slug: 'master-sub' },
    { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, name: 'Master Subject', code: 'MSUB101', slug: 'master-sub' },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  )

  const admin = await User.create({
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
  const adminToken = createAccessToken(admin)

  const studentUser = await User.create({
    universityId,
    name: 'First Student Contributor',
    email: `student1.${Date.now()}@university.edu`,
    role: 'STUDENT',
    programId: testProgram._id,
    branchId: testBranch._id,
    semesterId: testSemester._id,
    publicProfile: true,
  })
  const studentToken = createAccessToken(studentUser)

  const studentUser2 = await User.create({
    universityId,
    name: 'Zero Contribution Student',
    email: `student2.${Date.now()}@university.edu`,
    role: 'STUDENT',
    programId: testProgram._id,
    branchId: testBranch._id,
    semesterId: testSemester._id,
    publicProfile: true,
  })
  const studentToken2 = createAccessToken(studentUser2)

  const createdStorageKeys = []
  const storageRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storage')

  let testRequest
  let testReport
  let pendingResource
  let approvedResource

  try {
    // -------------------------------------------------------------
    // FEATURE 1: ADMIN REPLIES & SENDER IN-APP/EMAIL NOTIFICATIONS
    // -------------------------------------------------------------
    console.log('\n[Feature 1: Admin Replies and Notifications]')

    // Create a base pending resource first
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

    await test('Unauthorized users cannot reply to resource requests', async () => {
      const res = await request(app)
        .patch(`/api/admin/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${studentToken}`)
        .send({ reply: 'Unauthorized student response', status: 'OPEN' })
      assert.equal(res.status, 403)
    })

    await test('Admin reply to resource request is saved and creates in-app notification', async () => {
      const replyText = 'We have added notes covering Graph Algorithms to the catalog.'
      const res = await request(app)
        .patch(`/api/admin/requests/${testRequest._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reply: replyText, status: 'FULFILLED' })

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.adminReply, replyText)
      assert.equal(res.body.data.status, 'FULFILLED')

      const updatedReq = await ResourceRequest.findById(testRequest._id)
      assert.equal(updatedReq.adminReply, replyText)
      assert.equal(updatedReq.status, 'FULFILLED')
      assert.ok(updatedReq.repliedAt)
      assert.equal(String(updatedReq.repliedBy), String(admin._id))

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REQUEST_REPLIED',
        requestId: testRequest._id,
      })
      assert.ok(notif, 'In-app notification must exist for original sender')
      assert.ok(notif.title.includes('Update on Your Resource Request'))
      assert.ok(notif.message.includes(replyText))
      assert.equal(String(notif.requestId), String(testRequest._id))
    })

    await test('Admin reply to community report saves reply and notifies reporter', async () => {
      const reportReply = 'The typographical error has been corrected in the master document.'
      const res = await request(app)
        .patch(`/api/admin/reports/${testReport._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'RESOLVED', reply: reportReply })

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.status, 'RESOLVED')
      assert.equal(res.body.data.moderatorReply, reportReply)

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REPORT_REPLIED',
        reportId: testReport._id,
      })
      assert.ok(notif, 'In-app notification must exist for reporter')
      assert.ok(notif.title.includes('Update on Your Report'))
      assert.ok(notif.message.includes(reportReply))
      assert.equal(String(notif.reportId), String(testReport._id))
    })

    await test('Admin can request modifications from author on uploaded resource and author receives in-app notification', async () => {
      const changeMsg = 'Please add missing Chapter 3 formulas and re-export the PDF.'
      const res = await request(app)
        .patch(`/api/admin/resources/${pendingResource._id}/changes-requested`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ message: changeMsg })

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.status, 'CHANGES_REQUESTED')
      assert.equal(res.body.data.requestedChanges, changeMsg)

      const notif = await Notification.findOne({
        userId: studentUser._id,
        type: 'CHANGES_REQUESTED',
        resourceId: pendingResource._id,
      })
      assert.ok(notif, 'Author must receive CHANGES_REQUESTED in-app notification')
      assert.ok(notif.title.includes('Changes requested'))
      assert.ok(notif.message.includes(changeMsg))
    })

    await test('Report remains in management interface when replied to or under investigation', async () => {
      const report2 = await Report.create({
        universityId: env.UNIVERSITY_ID,
        resourceId: pendingResource._id,
        userId: studentUser._id,
        reason: 'POOR_QUALITY',
        details: 'Scan on page 2 is blurry',
        status: 'OPEN',
      })

      // Admin replies and moves to INVESTIGATING
      const replyRes = await request(app)
        .patch(`/api/admin/reports/${report2._id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ status: 'INVESTIGATING', reply: 'We are investigating the document scan.' })

      assert.equal(replyRes.status, 200)
      assert.equal(replyRes.body.data.status, 'INVESTIGATING')

      // Check that report remains in listModerationFeedback and listAllReports
      const listRes = await request(app)
        .get('/api/admin/reports')
        .set('Authorization', `Bearer ${adminToken}`)

      assert.equal(listRes.status, 200)
      const found = listRes.body.data.find((r) => String(r._id) === String(report2._id))
      assert.ok(found, 'Report under investigation must not disappear from admin reports list')
      assert.equal(found.status, 'INVESTIGATING')

      // Explicitly dismiss as false
      const dismissRes = await request(app)
        .post(`/api/admin/reports/${report2._id}/dismiss`)
        .set('Authorization', `Bearer ${adminToken}`)
        .send({ reason: 'The scan resolution was verified and found legible.' })

      assert.equal(dismissRes.status, 200)
      assert.equal(dismissRes.body.data.status, 'DISMISSED')
      assert.equal(dismissRes.body.data.dismissalReason, 'The scan resolution was verified and found legible.')

      // Dismissed report notification
      const dismissNotif = await Notification.findOne({
        userId: studentUser._id,
        type: 'REPORT_DISMISSED',
        reportId: report2._id,
      })
      assert.ok(dismissNotif, 'Reporter must receive dismissal notification')

      // Dismissed report must remain in all reports list for audit
      const auditListRes = await request(app)
        .get('/api/admin/reports?status=DISMISSED')
        .set('Authorization', `Bearer ${adminToken}`)
      assert.equal(auditListRes.status, 200)
      const foundDismissed = auditListRes.body.data.find((r) => String(r._id) === String(report2._id))
      assert.ok(foundDismissed, 'Dismissed report must remain permanently accessible for audit')

      await Report.deleteOne({ _id: report2._id })
    })

    // -------------------------------------------------------------
    // FEATURE 2: CONTRIBUTOR DIRECTORY ELIGIBILITY
    // -------------------------------------------------------------
    console.log('\n[Feature 2: Public Contributor Directory Eligibility]')

    await test('Zero approved contributions user is excluded from contributor directory', async () => {
      const res = await request(app).get('/api/contributors')
      assert.equal(res.status, 200)
      const contributors = res.body.data || []
      const foundStudent1 = contributors.find((c) => String(c.id || c._id) === String(studentUser._id))
      const foundStudent2 = contributors.find((c) => String(c.id || c._id) === String(studentUser2._id))
      assert.equal(foundStudent1, undefined, 'User with only pending resource must be excluded')
      assert.equal(foundStudent2, undefined, 'User with 0 uploads must be excluded')
    })

    await test('Public profile of zero-contribution user returns 404', async () => {
      const res = await request(app).get(`/api/contributors/${studentUser2._id}`)
      assert.equal(res.status, 404)
    })

    await test('User with >= 1 approved contribution is included in contributor directory', async () => {
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
      assert.equal(res.status, 200)
      const contributors = res.body.data || []
      const found = contributors.find((c) => String(c.id || c._id) === String(studentUser._id))
      assert.ok(found, 'Contributor with 1 approved upload must be present')
      assert.ok(found.approvedContributions >= 1)

      const found2 = contributors.find((c) => String(c.id || c._id) === String(studentUser2._id))
      assert.equal(found2, undefined, 'User with 0 approved uploads must remain excluded')
    })

    await test('Public profile returns public fields only and protects private fields', async () => {
      const res = await request(app).get(`/api/contributors/${studentUser._id}`)
      assert.equal(res.status, 200)
      assert.equal(res.body.data.contributor.name, studentUser.name)
      assert.equal(res.body.data.contributor.email, undefined)
      assert.equal(res.body.data.contributor.passwordHash, undefined)
      assert.equal(res.body.data.contributor.universityEmailOtpHash, undefined)
    })

    // -------------------------------------------------------------
    // FEATURE 3: UNIVERSITY EMAIL OTP VERIFICATION & FIRST UPLOAD
    // -------------------------------------------------------------
    console.log('\n[Feature 3: University Email OTP Verification and Upload Gate]')

    await test('Strict validation of university email domain (silicon.ac.in)', () => {
      assert.equal(isValidUniversityEmail('student@silicon.ac.in'), true)
      assert.equal(isValidUniversityEmail('FACULTY.TEST@SILICON.AC.IN'), true)
      assert.equal(isValidUniversityEmail('student@gmail.com'), false)
      assert.equal(isValidUniversityEmail('student@silicon.com'), false)
      assert.equal(isValidUniversityEmail('student@fake-silicon.ac.in'), false)
      assert.equal(isValidUniversityEmail('student@silicon.ac.in.attacker.com'), false)
      assert.equal(isValidUniversityEmail('notanemail'), false)
    })

    await test('Generates cryptographically secure 6-digit numeric OTP', () => {
      const code1 = generateNumericOtp()
      const code2 = generateNumericOtp()
      assert.match(code1, /^\d{6}$/)
      assert.match(code2, /^\d{6}$/)
    })

    await test('Direct upload API blocks unverified user with 403', async () => {
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

      assert.equal(res.status, 403)
      assert.equal(res.body.code, 'UNIVERSITY_EMAIL_VERIFICATION_REQUIRED')
      assert.ok(res.body.message.includes('silicon.ac.in'))
    })

    await test('Rejects OTP request for non-silicon email address', async () => {
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'attacker@gmail.com' })
      assert.equal(res.status, 400)
      assert.ok(res.body.message.includes('silicon.ac.in'))
    })

    await test('Sends OTP for valid silicon.ac.in address and hashes it in DB', async () => {
      const validEmail = 'student2.test@silicon.ac.in'
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: validEmail })

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.cooldownSeconds, 60)
      assert.equal(res.body.data.otp, undefined, 'Plaintext OTP must NOT be exposed')

      const userInDb = await User.findById(studentUser2._id).select('+universityEmailOtpHash +universityEmailOtpExpiresAt')
      assert.equal(userInDb.universityEmail, validEmail.toLowerCase())
      assert.ok(userInDb.universityEmailOtpHash)
      assert.match(userInDb.universityEmailOtpHash, /^[a-f0-9]{64}$/)
      assert.ok(userInDb.universityEmailOtpExpiresAt)
    })

    await test('Enforces 60-second cooldown on consecutive OTP requests', async () => {
      const res = await request(app)
        .post('/api/user/university-email/request-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in' })
      assert.equal(res.status, 429)
      assert.ok(res.body.message.includes('Please wait'))
    })

    await test('Rejects incorrect OTP and increments attempt counter', async () => {
      const res = await request(app)
        .post('/api/user/university-email/verify-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in', otp: '000000' })
      assert.equal(res.status, 400)
      assert.ok(res.body.message.includes('Invalid verification code'))

      const userInDb = await User.findById(studentUser2._id).select('+universityEmailOtpAttempts')
      assert.equal(userInDb.universityEmailOtpAttempts, 1)
    })

    await test('Valid OTP successfully verifies university email and clears challenge', async () => {
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

      assert.equal(res.status, 200)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.isVerified, true)

      const verifiedDbUser = await User.findById(studentUser2._id).select('+universityEmailOtpHash')
      assert.ok(verifiedDbUser.universityEmailVerifiedAt)
      assert.equal(verifiedDbUser.universityEmailOtpHash, undefined)
    })

    await test('Single-use OTP cannot be replayed after verification', async () => {
      const res = await request(app)
        .post('/api/user/university-email/verify-otp')
        .set('Authorization', `Bearer ${studentToken2}`)
        .send({ email: 'student2.test@silicon.ac.in', otp: '654321' })
      assert.equal(res.status, 400)
      assert.ok(res.body.message.includes('No active verification code'))
    })

    await test('Verified student is now permitted to upload resources', async () => {
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

      assert.equal(res.status, 201)
      assert.equal(res.body.success, true)
      assert.equal(res.body.data.resource.title, 'Verified Student First Upload')
      assert.equal(res.body.data.resource.status, 'PENDING_REVIEW')

      if (res.body.data.resource.id) {
        await Resource.deleteOne({ _id: res.body.data.resource.id })
      }
      if (res.body.data.resource.storageKey) {
        createdStorageKeys.push(res.body.data.resource.storageKey)
      }
    })
  } finally {
    for (const key of createdStorageKeys) {
      const filePath = path.resolve(storageRoot, key)
      await fs.unlink(filePath).catch(() => {})
    }
    if (pendingResource) await Resource.deleteOne({ _id: pendingResource._id })
    if (approvedResource) await Resource.deleteOne({ _id: approvedResource._id })
    if (testRequest) await ResourceRequest.deleteOne({ _id: testRequest._id })
    if (testReport) await Report.deleteOne({ _id: testReport._id })
    await User.deleteMany({ _id: { $in: [admin._id, studentUser._id, studentUser2._id] } })
    await disconnectDatabase()
  }

  console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---`)
  if (failed > 0) process.exit(1)
}

run().catch((err) => {
  console.error('Fatal test error:', err)
  process.exit(1)
})
