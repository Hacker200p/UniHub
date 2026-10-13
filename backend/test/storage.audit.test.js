import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import fs from 'node:fs/promises'
import path from 'node:path'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import { Program, Semester, Subject } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { createAccessToken } from '../src/utils/tokens.js'

describe('File Storage & Upload Security Audit', () => {
  let student
  let admin
  let studentToken
  let adminToken
  let testProgram
  let testSemester
  let testSubject
  const createdStorageKeys = []

  beforeAll(async () => {
    await connectDatabase()
    const universityId = env.UNIVERSITY_ID

    testProgram = await Program.findOneAndUpdate(
      { universityId, slug: 'audit-prog' },
      { universityId, name: 'Audit Program', code: 'APROG', slug: 'audit-prog' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, number: 1 },
      { universityId, programId: testProgram._id, name: 'Audit Sem 1', slug: 'audit-sem-1', number: 1 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSubject = await Subject.findOneAndUpdate(
      { universityId, semesterId: testSemester._id, slug: 'audit-subj' },
      { universityId, programId: testProgram._id, semesterId: testSemester._id, name: 'Audit Subject', code: 'ASUB101', slug: 'audit-subj' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    student = await User.create({
      universityId,
      name: 'Storage Auditor Student',
      email: `audit.student.${Date.now()}@university.edu`,
      universityEmail: `audit.student.${Date.now()}@silicon.ac.in`,
      universityEmailVerifiedAt: new Date(),
      passwordHash: 'dummyHashForTesting123456',
      role: 'STUDENT',
      programId: testProgram._id,
      semesterId: testSemester._id,
    })

    admin = await User.create({
      universityId,
      name: 'Storage Auditor Admin',
      email: `audit.admin.${Date.now()}@university.edu`,
      passwordHash: 'dummyHashForTesting123456',
      role: 'ADMIN',
      programId: testProgram._id,
      semesterId: testSemester._id,
    })

    studentToken = createAccessToken(student)
    adminToken = createAccessToken(admin)
  })

  afterAll(async () => {
    // Clean up created files on disk
    for (const key of createdStorageKeys) {
      const filePath = path.resolve(process.cwd(), 'storage', key)
      await fs.unlink(filePath).catch(() => {})
    }
    // Clean up DB records
    await Resource.deleteMany({ universityId: env.UNIVERSITY_ID, title: { $regex: /^Audit / } })
    await User.deleteMany({ _id: { $in: [student?._id, admin?._id] } })
    await disconnectDatabase()
  })

  it('1. Rejects unauthenticated upload requests', async () => {
    const res = await request(app).post('/api/resources/upload')
    expect(res.status).toBe(401)
    expect(res.body.success).toBe(false)
  })

  it('2. Rejects upload when no file is attached', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', 'Audit Resource No File')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('PDF file is required')
  })

  it('3. Rejects upload with non-PDF mime type or extension', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', 'Audit Resource Bad Mime')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', Buffer.from('hello text content'), { filename: 'notes.txt', contentType: 'text/plain' })

    expect(res.status).toBe(400)
    expect(res.body.message).toMatch(/Only PDF files are allowed|not a valid PDF/)
  })

  it('4. Rejects upload with fake PDF extension but invalid magic bytes', async () => {
    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', 'Audit Resource Fake Magic')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', Buffer.from('NOT A PDF FILE'), { filename: 'malicious.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(400)
    expect(res.body.message).toContain('The uploaded file is not a valid PDF')
  })

  it('5. Successfully uploads valid PDF, saves content-addressed file directly to storage/ on disk', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const validPdfBuffer = Buffer.from(`%PDF-1.4\n1 0 obj\n<<\n>>\nendobj\n% Unique content: ${unique}\n%%EOF`)

    const res = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Valid Upload ${unique}`)
      .field('description', 'Audit testing description')
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', validPdfBuffer, { filename: '../../../attempt_traversal.pdf', contentType: 'application/pdf' })

    expect(res.status).toBe(201)
    expect(res.body.success).toBe(true)
    expect(res.body.data.resource.status).toBe('PENDING_REVIEW')

    const resourceId = res.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    expect(dbResource).not.toBeNull()
    expect(dbResource.file.storageKey).toMatch(/^[a-f0-9]{64}\.pdf$/)
    expect(dbResource.file.storageKey).not.toContain('attempt_traversal')
    expect(dbResource.file.storageKey).not.toContain('..')

    createdStorageKeys.push(dbResource.file.storageKey)

    // Verify file actually exists on disk in storage/
    const diskPath = path.resolve(process.cwd(), 'storage', dbResource.file.storageKey)
    const existsOnDisk = await fs.access(diskPath).then(() => true).catch(() => false)
    expect(existsOnDisk).toBe(true)

    // Verify disk content matches uploaded buffer
    const onDiskBuffer = await fs.readFile(diskPath)
    expect(onDiskBuffer.equals(validPdfBuffer)).toBe(true)
  })

  it('6. Rejects duplicate upload of identical file content (409 Conflict)', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const duplicatePdf = Buffer.from(`%PDF-1.4\n% Deduplication test content ${unique}\n%%EOF`)

    // First upload
    const res1 = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Dedup First ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', duplicatePdf, { filename: 'first.pdf', contentType: 'application/pdf' })

    expect(res1.status).toBe(201)
    const resource1 = await Resource.findById(res1.body.data.resource.id)
    createdStorageKeys.push(resource1.file.storageKey)

    // Second upload with identical file content
    const res2 = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Dedup Second ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', duplicatePdf, { filename: 'second.pdf', contentType: 'application/pdf' })

    expect(res2.status).toBe(409)
    expect(res2.body.message).toContain('This resource already exists')
  })

  it('7. Access control: Pending resource download returns 404', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const pdfBuffer = Buffer.from(`%PDF-1.4\n% Pending download test ${unique}\n%%EOF`)

    const uploadRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Pending Access ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', pdfBuffer, { filename: 'pending.pdf', contentType: 'application/pdf' })

    const resourceId = uploadRes.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    createdStorageKeys.push(dbResource.file.storageKey)

    // Attempt download while status is PENDING_REVIEW
    const downloadRes = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${studentToken}`)

    expect(downloadRes.status).toBe(404)
  })

  it('8. Access control: Approved resource can be downloaded and increments download count', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const pdfBuffer = Buffer.from(`%PDF-1.4\n% Approved download test ${unique}\n%%EOF`)

    const uploadRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Approved Access ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', pdfBuffer, { filename: 'approved.pdf', contentType: 'application/pdf' })

    const resourceId = uploadRes.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    createdStorageKeys.push(dbResource.file.storageKey)

    // Approve the resource as Admin
    const approveRes = await request(app)
      .patch(`/api/admin/resources/${resourceId}/approve`)
      .set('Authorization', `Bearer ${adminToken}`)
    expect(approveRes.status).toBe(200)

    // Download approved resource
    const downloadRes = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${studentToken}`)

    expect(downloadRes.status).toBe(200)
    expect(downloadRes.body.data.url).toBe(dbResource.file.url)

    // Verify download count incremented
    const updated = await Resource.findById(resourceId)
    expect(updated.downloadCount).toBe(1)

    // Verify static serving works for the stored file
    const fileRes = await request(app).get(dbResource.file.url)
    expect(fileRes.status).toBe(200)
    expect(fileRes.headers['content-type']).toMatch(/pdf/)
  })

  it('9. Unauthorized students cannot delete resources; Admins can delete', async () => {
    const unique = `${Date.now()}-${Math.random()}`
    const pdfBuffer = Buffer.from(`%PDF-1.4\n% Deletion test ${unique}\n%%EOF`)

    const uploadRes = await request(app)
      .post('/api/resources/upload')
      .set('Authorization', `Bearer ${studentToken}`)
      .field('title', `Audit Delete Test ${unique}`)
      .field('resourceType', 'NOTES')
      .field('programId', testProgram._id.toString())
      .field('semesterId', testSemester._id.toString())
      .field('subjectId', testSubject._id.toString())
      .attach('pdf', pdfBuffer, { filename: 'delete_test.pdf', contentType: 'application/pdf' })

    const resourceId = uploadRes.body.data.resource.id
    const dbResource = await Resource.findById(resourceId)
    createdStorageKeys.push(dbResource.file.storageKey)

    // Student attempt to delete via admin route
    const studentDeleteRes = await request(app)
      .delete(`/api/admin/resources/${resourceId}`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(studentDeleteRes.status).toBe(403)

    // Admin deletes resource
    const adminDeleteRes = await request(app)
      .delete(`/api/admin/resources/${resourceId}`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ reason: 'Audit cleanup' })
    expect(adminDeleteRes.status).toBe(200)

    // Verify resource is removed from DB
    const deletedInDb = await Resource.findById(resourceId)
    expect(deletedInDb).toBeNull()

    // Subsequent download returns 404
    const downloadAfterDelete = await request(app)
      .post(`/api/resources/${resourceId}/download`)
      .set('Authorization', `Bearer ${studentToken}`)
    expect(downloadAfterDelete.status).toBe(404)
  })
})
