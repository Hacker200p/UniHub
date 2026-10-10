import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import { Download } from '../src/models/Download.js'
import { Program, Branch, Semester, Subject } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { createAccessToken } from '../src/utils/tokens.js'

describe('End-to-End Resource Lifecycle & Security Audit', () => {
  let student
  let strangerStudent
  let admin
  let studentToken
  let strangerToken
  let adminToken
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
      { universityId, slug: 'e2e-prog' },
      { universityId, name: 'E2E Program', code: 'E2EPROG', slug: 'e2e-prog' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testBranch = await Branch.findOneAndUpdate(
      { universityId, programId: testProgram._id, slug: 'e2e-cse' },
      { universityId, programId: testProgram._id, name: 'E2E CSE', code: 'ECSE', slug: 'e2e-cse' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, branchId: testBranch._id, number: 1 },
      { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'E2E Sem 1', slug: 'e2e-sem-1', number: 1 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSubject = await Subject.findOneAndUpdate(
      { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, slug: 'e2e-sub' },
      { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, name: 'E2E Subject', code: 'ESUB101', slug: 'e2e-sub' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    student = await User.create({
      universityId,
      name: 'E2E Contributor Student',
      email: `e2e.student.${Date.now()}@university.edu`,
      passwordHash: 'dummyHash123456',
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    strangerStudent = await User.create({
      universityId,
      name: 'E2E Stranger Student',
      email: `e2e.stranger.${Date.now()}@university.edu`,
      passwordHash: 'dummyHash123456',
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    admin = await User.create({
      universityId,
      name: 'E2E Admin Auditor',
      email: `e2e.admin.${Date.now()}@university.edu`,
      passwordHash: 'dummyHash123456',
      role: 'ADMIN',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    studentToken = createAccessToken(student)
    strangerToken = createAccessToken(strangerStudent)
    adminToken = createAccessToken(admin)
  })

  afterAll(async () => {
    for (const key of createdStorageKeys) {
      const filePath = path.resolve(storageRoot, key)
      await fs.unlink(filePath).catch(() => {})
    }
    await Resource.deleteMany({ universityId: env.UNIVERSITY_ID, title: { $regex: /^E2E / } })
    await User.deleteMany({ _id: { $in: [student?._id, strangerStudent?._id, admin?._id] } })
    await Program.deleteMany({ _id: testProgram?._id })
    await Branch.deleteMany({ _id: testBranch?._id })
    await Semester.deleteMany({ _id: testSemester?._id })
    await Subject.deleteMany({ _id: testSubject?._id })
    await disconnectDatabase()
  })

  it('1. Complete lifecycle: upload -> pending -> moderation -> approve -> public download', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const validPdf = Buffer.from(`%PDF-1.4\n1 0 obj\n<<>>\nendobj\n% E2E test PDF ${unique}\n%%EOF`)

    // Step A: Student uploads resource with curriculum hierarchy
    const uploadRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `E2E Resource ${unique}`)
      .field('description', 'Comprehensive end-to-end audit test')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('branchId', testBranch._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', validPdf, { filename: '../../../traversal_test.pdf', contentType: 'application/pdf' })

    expect(uploadRes.status).toBe(201)
    expect(uploadRes.body.success).toBe(true)
    expect(uploadRes.body.data.resource.status).toBe('PENDING_REVIEW')

    const resourceId = uploadRes.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    expect(dbResource).not.toBeNull()
    expect(dbResource.file.storageKey).toMatch(/^[a-f0-9]{64}\.pdf$/)
    expect(dbResource.file.storageKey).not.toContain('..')
    createdStorageKeys.push(dbResource.file.storageKey)

    // Step B: Pending resource does not appear in public resources listing
    const publicList = await request(app).get('/api/resources')
    expect(publicList.status).toBe(200)
    const titles = publicList.body.data.map((r) => r.title)
    expect(titles).not.toContain(dbResource.title)

    // Step C: Ordinary student cannot download pending resource via download API
    const studentDownloadRes = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${strangerToken}`)
    expect(studentDownloadRes.status).toBe(404)

    // Step D: Public direct GET to /uploads/<hash>.pdf returns 404
    const publicDirectRes = await request(app).get(dbResource.file.url)
    expect(publicDirectRes.status).toBe(404)
    expect(publicDirectRes.body.message).toContain('Route not found')

    // Step E: Direct GET with token in query string returns 404 (query tokens rejected)
    const queryTokenRes = await request(app).get(`${dbResource.file.url}?token=${adminToken}`)
    expect(queryTokenRes.status).toBe(404)
    expect(queryTokenRes.body.message).toContain('Route not found')

    // Step F: Stranger student with Bearer token cannot access pending file via direct URL
    const strangerDirectRes = await request(app)
      .get(dbResource.file.url)
      .set('Authorization', `Bearer ${strangerToken}`)
    expect(strangerDirectRes.status).toBe(404)

    // Step G: Admin with Bearer token CAN preview/view pending file
    const adminDirectRes = await request(app)
      .get(dbResource.file.url)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(adminDirectRes.status).toBe(200)
    expect(adminDirectRes.headers['content-type']).toMatch(/pdf/)
    expect(adminDirectRes.headers['cross-origin-resource-policy']).toBe('cross-origin')

    // Step H: Contributor with Bearer token CAN preview their own pending file
    const authorDirectRes = await request(app)
      .get(dbResource.file.url)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(authorDirectRes.status).toBe(200)
    expect(authorDirectRes.headers['content-type']).toMatch(/pdf/)

    // Step I: Admin approves the resource
    const approveRes = await request(app)
      .patch(`/api/admin/resources/${resourceId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approveRes.status).toBe(200)

    // Step J: Approved resource now appears in public resource listing
    const publicListAfter = await request(app).get('/api/resources')
    expect(publicListAfter.status).toBe(200)
    const titlesAfter = publicListAfter.body.data.map((r) => r.title)
    expect(titlesAfter).toContain(dbResource.title)

    // Step K: Approved resource download succeeds, increments count, returns url
    const downloadRes = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${strangerToken}`)
    expect(downloadRes.status).toBe(200)
    expect(downloadRes.body.data.url).toBe(dbResource.file.url)

    const updatedResource = await Resource.findById(resourceId)
    expect(updatedResource.downloadCount).toBe(1)

    // Step L: Approved resource can now be accessed publicly via direct URL without token
    const publicApprovedRes = await request(app).get(dbResource.file.url)
    expect(publicApprovedRes.status).toBe(200)
    expect(publicApprovedRes.headers['content-type']).toMatch(/pdf/)
    expect(publicApprovedRes.body.length).toBe(validPdf.length)
  })

  it('2. Rejected resource lifecycle: rejected resources remain unavailable to ordinary students', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const validPdf = Buffer.from(`%PDF-1.4\n% Rejected test PDF ${unique}\n%%EOF`)

    const uploadRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `E2E Reject Test ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('branchId', testBranch._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', validPdf, { filename: 'reject_me.pdf', contentType: 'application/pdf' })

    const resourceId = uploadRes.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    createdStorageKeys.push(dbResource.file.storageKey)

    // Admin rejects the resource
    const rejectRes = await request(app)
      .patch(`/api/admin/resources/${resourceId}/reject`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Does not meet academic guidelines' })
    expect(rejectRes.status).toBe(200)

    // Ordinary student cannot download
    const downloadRes = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${strangerToken}`)
    expect(downloadRes.status).toBe(404)

    // Ordinary student direct URL returns 404
    const directRes = await request(app).get(dbResource.file.url)
    expect(directRes.status).toBe(404)
  })

  it('3. Duplicate uploads are rejected safely with 409 Conflict', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const duplicatePdf = Buffer.from(`%PDF-1.4\n% Deduplication test ${unique}\n%%EOF`)

    const res1 = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `E2E Dedup 1 ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('branchId', testBranch._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', duplicatePdf, { filename: 'original.pdf', contentType: 'application/pdf' })
    expect(res1.status).toBe(201)

    const dbResource = await Resource.findById(res1.body.data.resource.id)
    createdStorageKeys.push(dbResource.file.storageKey)

    // Re-upload exact same PDF
    const res2 = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `E2E Dedup 2 ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('branchId', testBranch._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', duplicatePdf, { filename: 'copy.pdf', contentType: 'application/pdf' })
    expect(res2.status).toBe(409)
    expect(res2.body.message).toContain('This resource already exists')
  })

  it('4. Missing file handling: download returns 404 without recording false downloads', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const phantomResource = await Resource.create({
      universityId: env.UNIVERSITY_ID,
      title: `E2E Phantom ${unique}`,
      slug: `e2e-phantom-${Date.now()}`,
      resourceType: 'NOTES',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
      subjectId: testSubject._id,
      contributorId: student._id,
      status: 'APPROVED',
      file: {
        url: `/uploads/nonexistent-${unique}.pdf`,
        storageKey: `nonexistent-${unique}.pdf`,
        fileName: 'missing.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: `dummy-sha-${unique}`,
      },
    })

    const initialDownloads = await Download.countDocuments({ resourceId: phantomResource._id })

    const res = await request(app)
      .post(`/api/resources/${phantomResource._id}/download`)
      .set('Authorization', `Bearer ${studentToken}`)

    expect(res.status).toBe(404)
    expect(res.body.message).toMatch(/not available|Resource not found/)

    const downloadsAfter = await Download.countDocuments({ resourceId: phantomResource._id })
    expect(downloadsAfter).toBe(initialDownloads)

    // Direct GET to missing file in /uploads returns safe 404 JSON
    const directRes = await request(app).get(phantomResource.file.url)
    expect(directRes.status).toBe(404)
    expect(directRes.body.success).toBe(false)
  })

  it('5. Invalid inputs, malformed IDs, and unauthenticated requests are safely rejected', async () => {
    // Malformed ID
    const badIdRes = await request(app).get('/api/resources/not-a-valid-id')
    expect(badIdRes.status).toBe(404)

    // Unauthenticated upload
    const unauthUpload = await request(app).post('/api/resources/upload')
    expect(unauthUpload.status).toBe(401)

    // Non-PDF file
    const textFileRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', 'Bad File Type')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('branchId', testBranch._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', Buffer.from('Just text'), { filename: 'notes.txt', contentType: 'text/plain' })
    expect(textFileRes.status).toBe(400)
  })
})
