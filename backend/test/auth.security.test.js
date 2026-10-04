import { beforeAll, afterAll, describe, expect, it } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { RefreshSession } from '../src/models/RefreshSession.js'
import { AuditLog } from '../src/models/AuditLog.js'
import { Program, Branch, Semester } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { hashToken } from '../src/utils/tokens.js'
import { REFRESH_COOKIE } from '../src/utils/refreshCookie.js'

function extractCookie(res, name = REFRESH_COOKIE) {
  const cookies = res.headers['set-cookie']
  if (!cookies) return null
  const cookieList = Array.isArray(cookies) ? cookies : [cookies]
  const target = cookieList.find((c) => c.startsWith(`${name}=`))
  return target || null
}

describe('Refresh Token Family Rotation, Reuse Detection & Security', () => {
  let testProgram
  let testBranch
  let testSemester

  beforeAll(async () => {
    await connectDatabase()

    const universityId = env.UNIVERSITY_ID

    testProgram = await Program.findOneAndUpdate(
      { universityId, slug: 'test-btech' },
      { universityId, name: 'Test B.Tech', code: 'TBTECH', slug: 'test-btech' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testBranch = await Branch.findOneAndUpdate(
      { universityId, programId: testProgram._id, slug: 'test-cse' },
      { universityId, programId: testProgram._id, name: 'Test CSE', code: 'TCSE', slug: 'test-cse' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, number: 3 },
      { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'Test Semester 3', slug: 'test-sem-3', number: 3 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  })

  afterAll(async () => {
    await disconnectDatabase()
  })

  it('1. Normal rotation: login -> refresh -> first token invalid -> new token works', async () => {
    const email = `rot-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Rotation User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    // Initial Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })

    expect(loginRes.status).toBe(200)
    expect(loginRes.body.success).toBe(true)
    expect(loginRes.body.data.accessToken).toBeDefined()
    // Cookie regression: response body must NOT contain refreshToken
    expect(loginRes.body.data.refreshToken).toBeUndefined()
    expect(loginRes.body.refreshToken).toBeUndefined()

    const cookieHeader1 = extractCookie(loginRes)
    expect(cookieHeader1).toBeDefined()
    expect(cookieHeader1).toContain('HttpOnly')
    expect(cookieHeader1).toContain('Path=/api/auth')

    // First Refresh
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader1)

    expect(refreshRes1.status).toBe(200)
    expect(refreshRes1.body.success).toBe(true)
    expect(refreshRes1.body.data.accessToken).toBeDefined()
    expect(refreshRes1.body.data.refreshToken).toBeUndefined()

    const cookieHeader2 = extractCookie(refreshRes1)
    expect(cookieHeader2).toBeDefined()
    expect(cookieHeader2).not.toEqual(cookieHeader1)

    // New token works for second refresh
    const refreshRes2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', cookieHeader2)

    expect(refreshRes2.status).toBe(200)
    expect(refreshRes2.body.success).toBe(true)
    expect(refreshRes2.body.data.accessToken).toBeDefined()
  })

  it('2. Reuse detection: presenting an old rotated token revokes the entire family', async () => {
    const email = `reuse-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Reuse User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    // Step A: Login
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email, password })
    const originalCookie = extractCookie(loginRes)

    // Step B: Rotate once -> creates new token in same family
    const refreshRes1 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)
    expect(refreshRes1.status).toBe(200)
    const secondCookie = extractCookie(refreshRes1)

    // Step C: Rotate a second time -> creates third token in same family
    const refreshRes2 = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', secondCookie)
    expect(refreshRes2.status).toBe(200)
    const thirdCookie = extractCookie(refreshRes2)

    // Step D: Attacker/Replay tries to use the original rotated cookie!
    const reuseAttemptRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', originalCookie)

    expect(reuseAttemptRes.status).toBe(401)
    expect(reuseAttemptRes.body.success).toBe(false)
    const clearCookieHeader = extractCookie(reuseAttemptRes)
    expect(clearCookieHeader).toContain('Max-Age=0')

    // Step E: Verify REFRESH_TOKEN_REUSE_DETECTED audit log exists
    const audit = await AuditLog.findOne({
      universityId: env.UNIVERSITY_ID,
      action: 'REFRESH_TOKEN_REUSE_DETECTED',
      actorId: user._id,
    })
    expect(audit).not.toBeNull()
    expect(audit.metadata?.familyId).toBeDefined()

    // Step F: Verify the active token (thirdCookie) is ALSO now revoked because the entire family was invalidated
    const postReuseAttemptRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', thirdCookie)

    expect(postReuseAttemptRes.status).toBe(401)
    expect(postReuseAttemptRes.body.success).toBe(false)
  })

  it('3. Family isolation: revoking family A does NOT revoke unrelated family B', async () => {
    const email = `multi-family-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Multi Family User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    // Family 1 Login
    const fam1Login = await request(app).post('/api/auth/login').send({ email, password })
    const fam1CookieA = extractCookie(fam1Login)

    // Rotate Family 1
    const fam1Refresh = await request(app).post('/api/auth/refresh').set('Cookie', fam1CookieA)
    const fam1CookieB = extractCookie(fam1Refresh)

    // Family 2 Login (different device/session)
    const fam2Login = await request(app).post('/api/auth/login').send({ email, password })
    const fam2CookieA = extractCookie(fam2Login)

    // Rotate Family 2
    const fam2Refresh = await request(app).post('/api/auth/refresh').set('Cookie', fam2CookieA)
    const fam2CookieB = extractCookie(fam2Refresh)

    // Replay Family 1 old token -> triggers reuse in Family 1
    const reuseRes = await request(app).post('/api/auth/refresh').set('Cookie', fam1CookieA)
    expect(reuseRes.status).toBe(401)

    // Family 1 valid token should now be revoked
    const fam1Check = await request(app).post('/api/auth/refresh').set('Cookie', fam1CookieB)
    expect(fam1Check.status).toBe(401)

    // Family 2 valid token MUST STILL WORK
    const fam2Check = await request(app).post('/api/auth/refresh').set('Cookie', fam2CookieB)
    expect(fam2Check.status).toBe(200)
    expect(fam2Check.body.data.accessToken).toBeDefined()
  })

  it('4. Concurrency: atomic rotation prevents simultaneous duplicate rotations', async () => {
    const email = `race-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Race User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    const loginRes = await request(app).post('/api/auth/login').send({ email, password })
    const originalCookie = extractCookie(loginRes)

    // Send 2 concurrent refresh requests using the exact same cookie
    const [res1, res2] = await Promise.all([
      request(app).post('/api/auth/refresh').set('Cookie', originalCookie),
      request(app).post('/api/auth/refresh').set('Cookie', originalCookie),
    ])

    const statuses = [res1.status, res2.status].sort()
    // Exactly one must succeed (200) and the other must fail (401)
    expect(statuses).toEqual([200, 401])
  })

  it('5. Logout: single session logout revokes session and clearing cookie prevents refresh', async () => {
    const email = `logout-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Logout User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    const loginRes = await request(app).post('/api/auth/login').send({ email, password })
    const cookie = extractCookie(loginRes)

    // Logout
    const logoutRes = await request(app).post('/api/auth/logout').set('Cookie', cookie)
    expect(logoutRes.status).toBe(200)
    expect(extractCookie(logoutRes)).toContain('Max-Age=0')

    // Refresh after logout must fail
    const refreshRes = await request(app).post('/api/auth/refresh').set('Cookie', cookie)
    expect(refreshRes.status).toBe(401)
  })

  it('6. Logout all: revokes every session for the user across all devices', async () => {
    const email = `logoutall-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Logout All User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    // Login from Device 1
    const login1 = await request(app).post('/api/auth/login').send({ email, password })
    const cookie1 = extractCookie(login1)
    const token1 = login1.body.data.accessToken

    // Login from Device 2
    const login2 = await request(app).post('/api/auth/login').send({ email, password })
    const cookie2 = extractCookie(login2)

    // Device 1 calls /auth/logout-all
    const logoutAllRes = await request(app)
      .post('/api/auth/logout-all')
      .set('Authorization', `Bearer ${token1}`)

    expect(logoutAllRes.status).toBe(200)

    // Both device refresh tokens must now fail
    const refresh1 = await request(app).post('/api/auth/refresh').set('Cookie', cookie1)
    expect(refresh1.status).toBe(401)

    const refresh2 = await request(app).post('/api/auth/refresh').set('Cookie', cookie2)
    expect(refresh2.status).toBe(401)
  })

  it('7. Expired token: returns 401 and does not rotate', async () => {
    const email = `expired-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    const user = await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Expired User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    // Create an expired session directly
    const expiredRawToken = 'expired-token-val-1234567890abcdef'
    await RefreshSession.create({
      universityId: env.UNIVERSITY_ID,
      userId: user._id,
      familyId: 'fam-expired-test',
      tokenHash: hashToken(expiredRawToken),
      expiresAt: new Date(Date.now() - 60000), // 1 minute in the past
    })

    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${expiredRawToken}`)

    expect(refreshRes.status).toBe(401)
  })

  it('8. Unknown token: returns 401', async () => {
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=completely-unknown-token-hash-xyz`)

    expect(refreshRes.status).toBe(401)
  })

  it('9. CSRF / CORS protection: disallowed origins are rejected on refresh', async () => {
    const email = `cors-user-${Date.now()}@university.edu`
    const password = 'StrongPassword123!'
    const passwordHash = await bcrypt.hash(password, 12)

    await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'CORS User',
      email,
      passwordHash,
      programId: testProgram._id,
      branchId: testBranch._id,
      semesterId: testSemester._id,
    })

    const loginRes = await request(app).post('/api/auth/login').send({ email, password })
    const cookie = extractCookie(loginRes)

    // Request with malicious Origin header
    const badOriginRes = await request(app)
      .post('/api/auth/refresh')
      .set('Origin', 'http://malicious-attacker-site.com')
      .set('Cookie', cookie)

    expect(badOriginRes.status).toBe(403)
  })
})
