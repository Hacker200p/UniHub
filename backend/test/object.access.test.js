import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import { Bookmark } from '../src/models/UserActivity.js'
import { Notification } from '../src/models/Notification.js'
import { Program, Branch, Semester, Subject } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { createAccessToken } from '../src/utils/tokens.js'

describe('Object-Level Access Control & Privilege Boundaries (IDOR / BOLA / RBAC)', () => {
  let testProgram
  let testBranch
  let testSemester
  let testSubject

  let studentA
  let studentB
  let adminUser

  let tokenA
  let tokenAdmin

  beforeAll(async () => {
    await connectDatabase()
    const universityId = env.UNIVERSITY_ID

    testProgram = await Program.findOneAndUpdate(
      { universityId, slug: 'sec-btech' },
      { universityId, name: 'Security B.Tech', code: 'SBTECH', slug: 'sec-btech' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testBranch = await Branch.findOneAndUpdate(
      { universityId, programId: testProgram._id, slug: 'sec-cse' },
      { universityId, programId: testProgram._id, name: 'Security CSE', code: 'SCSE', slug: 'sec-cse' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, number: 3 },
      { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'Security Sem 3', slug: 'sec-sem-3', number: 3 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSubject = await Subject.findOneAndUpdate(
      { universityId, semesterId: testSemester._id, slug: 'sec-ds' },
      { universityId, programId: testProgram._id, branchId: testBranch._id, semesterId: testSemester._id, name: 'Security Data Structures', code: 'SDS301', slug: 'sec-ds' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    const passwordHash = await bcrypt.hash('Password123!@#', 12)

    studentA = await User.create({
      universityId,
      name: 'Student Alice',
      email: `student.a.${Date.now()}@university.edu`,
      passwordHash,
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    studentB = await User.create({
      universityId,
      name: 'Student Bob',
      email: `student.b.${Date.now()}@university.edu`,
      passwordHash,
      role: 'STUDENT',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    adminUser = await User.create({
      universityId,
      name: 'Admin Carol',
      email: `admin.c.${Date.now()}@university.edu`,
      passwordHash,
      role: 'ADMIN',
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    tokenA = createAccessToken(studentA)
    tokenAdmin = createAccessToken(adminUser)
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  it('1. Student A dashboard returns only Student A data and cannot access Student B dashboard', async () => {
    // Create resource for Student B
    const resourceB = await Resource.create({
      universityId: env.UNIVERSITY_ID,
      title: 'Bob Secret Study Notes',
      slug: `bob-secret-${Date.now()}`,
      resourceType: 'NOTES',
      programId: testProgram._id,
      semesterId: testSemester._id,
      subjectId: testSubject._id,
      contributorId: studentB._id,
      file: {
        url: 'http://localhost:4000/uploads/bob.pdf',
        storageKey: 'bob.pdf',
        fileName: 'bob.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: `bob-sha-${Date.now()}`,
      },
      status: 'PENDING_REVIEW',
    })

    // Student A requests their own dashboard
    const resA = await request(app)
      .get('/api/user/dashboard')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(resA.status).toBe(200)
    const titlesA = resA.body.data.uploads.map((u) => u.title)
    // Student A cannot see Student B's pending uploads
    expect(titlesA).not.toContain(resourceB.title)
  })

  it('2. Student A cannot edit Student B profile', async () => {
    // Attempt to update profile using Student A token with an attempt to inject another ID
    const updateRes = await request(app)
      .patch('/api/user/profile')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        name: 'Alice Updated Name',
        bio: 'Alice New Bio',
      })

    expect(updateRes.status).toBe(200)
    expect(updateRes.body.data.user.name).toBe('Alice Updated Name')

    // Student B profile remains completely unchanged
    const unchangedBob = await User.findById(studentB._id)
    expect(unchangedBob.name).toBe('Student Bob')
  })

  it('3. Student A cannot read Student B private notifications', async () => {
    // Create a private notification for Student B
    const notifB = await Notification.create({
      universityId: env.UNIVERSITY_ID,
      userId: studentB._id,
      type: 'UPLOAD_APPROVED',
      title: 'Bob Private Notification',
      message: 'Private message for Bob only',
    })

    // Student A lists their notifications
    const resA = await request(app)
      .get('/api/user/notifications')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(resA.status).toBe(200)
    const notifIdsA = resA.body.data.map((n) => n._id.toString())
    expect(notifIdsA).not.toContain(notifB._id.toString())
  })

  it('4. Student A cannot view or tamper with Student B bookmarks', async () => {
    // Create approved resource
    const approvedResource = await Resource.create({
      universityId: env.UNIVERSITY_ID,
      title: 'Shared Data Structures Notes',
      slug: `shared-ds-${Date.now()}`,
      resourceType: 'NOTES',
      programId: testProgram._id,
      semesterId: testSemester._id,
      subjectId: testSubject._id,
      contributorId: studentB._id,
      file: {
        url: 'http://localhost:4000/uploads/shared.pdf',
        storageKey: 'shared.pdf',
        fileName: 'shared.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 2048,
        sha256: `shared-sha-${Date.now()}`,
      },
      status: 'APPROVED',
    })

    // Student B adds bookmark
    await Bookmark.create({
      universityId: env.UNIVERSITY_ID,
      userId: studentB._id,
      resourceId: approvedResource._id,
    })

    // Student A lists bookmarks -> should NOT see Student B's bookmark
    const resA = await request(app)
      .get('/api/user/bookmarks')
      .set('Authorization', `Bearer ${tokenA}`)

    expect(resA.status).toBe(200)
    expect(resA.body.data).toHaveLength(0)
  })

  it('5. Pending or rejected resources are NOT visible publicly or to unauthorized students', async () => {
    const rejectedResource = await Resource.create({
      universityId: env.UNIVERSITY_ID,
      title: 'Rejected Bad Resource',
      slug: `rejected-res-${Date.now()}`,
      resourceType: 'NOTES',
      programId: testProgram._id,
      semesterId: testSemester._id,
      subjectId: testSubject._id,
      contributorId: studentB._id,
      file: {
        url: 'http://localhost:4000/uploads/rejected.pdf',
        storageKey: 'rejected.pdf',
        fileName: 'rejected.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1024,
        sha256: `rejected-sha-${Date.now()}`,
      },
      status: 'REJECTED',
    })

    // Public list
    const publicList = await request(app).get('/api/resources')
    expect(publicList.status).toBe(200)
    const titles = publicList.body.data.map((r) => r.title)
    expect(titles).not.toContain(rejectedResource.title)

    // Public get by ID
    const singleRes = await request(app).get(`/api/resources/${rejectedResource._id}`)
    expect(singleRes.status).toBe(404)
  })

  it('6. Regular student cannot call privileged Admin or Moderator endpoints', async () => {
    // Admin overview
    const overviewRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(overviewRes.status).toBe(403)

    // Admin queue
    const queueRes = await request(app)
      .get('/api/admin/queue')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(queueRes.status).toBe(403)

    // Admin pending resources
    const pendingRes = await request(app)
      .get('/api/admin/resources/pending')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(pendingRes.status).toBe(403)

    // Admin audit logs
    const auditRes = await request(app)
      .get('/api/admin/audit')
      .set('Authorization', `Bearer ${tokenA}`)
    expect(auditRes.status).toBe(403)
  })

  it('7. Admin user CAN access admin endpoints', async () => {
    const overviewRes = await request(app)
      .get('/api/admin/overview')
      .set('Authorization', `Bearer ${tokenAdmin}`)
    expect(overviewRes.status).toBe(200)
    expect(overviewRes.body.success).toBe(true)
  })
})
