import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import request from 'supertest'
import bcrypt from 'bcryptjs'
import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { User } from '../src/models/User.js'
import { RefreshSession } from '../src/models/RefreshSession.js'
import { Program, Branch, Semester } from '../src/models/Academic.js'
import { env } from '../src/config/env.js'
import { createAccessToken } from '../src/utils/tokens.js'
import {
  createOAuthState,
  verifyOAuthState,
  validateUniversityDomain,
  createOAuthHandoff,
  verifyOAuthHandoff,
} from '../src/services/oauthService.js'

describe('Social OAuth, Security & Account Management', () => {
  let testProgram
  let testBranch
  let testSemester

  beforeAll(async () => {
    await connectDatabase()
    const universityId = env.UNIVERSITY_ID

    testProgram = await Program.findOneAndUpdate(
      { universityId, slug: 'test-oauth-btech' },
      { universityId, name: 'Test OAuth B.Tech', code: 'TOBTECH', slug: 'test-oauth-btech' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testBranch = await Branch.findOneAndUpdate(
      { universityId, programId: testProgram._id, slug: 'test-oauth-cse' },
      { universityId, programId: testProgram._id, name: 'Test OAuth CSE', code: 'TOCSE', slug: 'test-oauth-cse' },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )

    testSemester = await Semester.findOneAndUpdate(
      { universityId, programId: testProgram._id, number: 3 },
      { universityId, programId: testProgram._id, branchId: testBranch._id, name: 'Test OAuth Sem 3', slug: 'test-oauth-sem-3', number: 3 },
      { upsert: true, new: true, setDefaultsOnInsert: true },
    )
  })

  afterAll(async () => {
    // cleanup test data
    await User.deleteMany({ email: /@test-auth-oauth\.edu$/ })
    await disconnectDatabase()
  })

  describe('1. OAuth State & Token Security Utils', () => {
    it('generates signed state and validates state parameters correctly', () => {
      const { stateToken, codeVerifier } = createOAuthState({ intent: 'login', provider: 'google' })
      expect(stateToken).toBeDefined()
      expect(typeof stateToken).toBe('string')
      expect(codeVerifier).toBeDefined()

      const decoded = verifyOAuthState(stateToken, 'google')
      expect(decoded).not.toBeNull()
      expect(decoded.intent).toBe('login')
      expect(decoded.provider).toBe('google')
      expect(decoded.nonce).toBeDefined()

      // Tampered state must fail verification
      const tampered = stateToken.slice(0, -4) + 'abcd'
      expect(() => verifyOAuthState(tampered, 'google')).toThrow()
    })

    it('creates and verifies short-lived OAuth handoff tokens', () => {
      const mockUser = { _id: '507f1f77bcf86cd799439011', universityId: env.UNIVERSITY_ID }
      const handoffCode = createOAuthHandoff(mockUser)
      expect(handoffCode).toBeDefined()
      expect(typeof handoffCode).toBe('string')

      const verified = verifyOAuthHandoff(handoffCode)
      expect(verified.sub).toBe('507f1f77bcf86cd799439011')
      expect(verified.universityId).toBe(env.UNIVERSITY_ID)

      // Invalid handoff code throws error
      expect(() => verifyOAuthHandoff('invalid.handoff.code')).toThrow()
    })

    it('validates university domain policy accurately', () => {
      // Allowed domains in env
      const allowed = validateUniversityDomain('student@university.edu')
      expect(allowed).toBe(true)

      const allowedSubdomain = validateUniversityDomain('student@cse.silicon.ac.in')
      expect(allowedSubdomain).toBe(true)

      // Commercial email domains should fail when restriction is active
      const denied = validateUniversityDomain('hacker@unauthorized-external-domain.com')
      expect(denied).toBe(false)
    })
  })

  describe('2. Public Providers Endpoint', () => {
    it('GET /api/auth/providers returns boolean map of configured providers', async () => {
      const res = await request(app).get('/api/auth/providers')
      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data).toHaveProperty('google')
      expect(res.body.data).toHaveProperty('github')
      expect(res.body.data).toHaveProperty('microsoft')
    })
  })

  describe('3. Account Linking, Password Creation & Lockout Prevention', () => {
    let testUser

    beforeAll(async () => {
      // Create user registered via social provider (without passwordHash)
      testUser = await User.create({
        universityId: env.UNIVERSITY_ID,
        name: 'OAuth Student',
        email: `student_${Date.now()}@test-auth-oauth.edu`,
        role: 'STUDENT',
        isEmailVerified: true,
        authProviders: [
          {
            provider: 'google',
            providerUserId: `g_${Date.now()}`,
            email: `student_${Date.now()}@test-auth-oauth.edu`,
            emailVerified: true,
            avatarUrl: 'https://example.com/avatar.jpg',
            linkedAt: new Date(),
          },
        ],
      })
    })

    it('GET /api/user/security returns correct provider list and hasPassword status', async () => {
      const userToken = createAccessToken(testUser)

      const res = await request(app)
        .get('/api/user/security')
        .set('Authorization', `Bearer ${userToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.hasPassword).toBe(false)
      expect(res.body.data.authProviders.length).toBe(1)
      expect(res.body.data.authProviders[0].provider).toBe('google')
    })

    it('Prevents unlinking the sole authentication method to prevent lockout', async () => {
      const userToken = createAccessToken(testUser)

      const res = await request(app)
        .post('/api/user/unlink-provider')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'google' })

      expect(res.status).toBe(400)
      expect(res.body.message).toContain('Cannot disconnect your only sign-in method')
    })

    it('Allows OAuth user to set a password without requiring currentPassword', async () => {
      const userToken = createAccessToken(testUser)

      const res = await request(app)
        .post('/api/user/set-password')
        .set('Authorization', `Bearer ${userToken}`)
        .send({
          newPassword: 'BrandNewSecurePassword123!',
          confirmPassword: 'BrandNewSecurePassword123!',
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      // User now has password
      const updated = await User.findById(testUser._id).select('+passwordHash')
      expect(updated.passwordHash).toBeDefined()
    })

    it('Allows unlinking social provider after password has been set', async () => {
      const userToken = createAccessToken(testUser)

      const res = await request(app)
        .post('/api/user/unlink-provider')
        .set('Authorization', `Bearer ${userToken}`)
        .send({ provider: 'google' })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)

      const updated = await User.findById(testUser._id)
      expect(updated.authProviders.length).toBe(0)
    })
  })

  describe('4. Active Sessions Management & Revocation', () => {
    let sessionUser
    let sessionToken

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('SessionPassword123!', 12)
      sessionUser = await User.create({
        universityId: env.UNIVERSITY_ID,
        name: 'Session Student',
        email: `sess_${Date.now()}@test-auth-oauth.edu`,
        passwordHash,
        programId: testProgram._id,
        branchId: testBranch._id,
        semesterId: testSemester._id,
      })
      sessionToken = createAccessToken(sessionUser)

      await RefreshSession.create({
        universityId: env.UNIVERSITY_ID,
        userId: sessionUser._id,
        familyId: 'test-session-family-1',
        tokenHash: 'hash_primary_' + Date.now(),
        expiresAt: new Date(Date.now() + 1000000),
        device: { browser: 'Chrome', os: 'Windows', deviceType: 'desktop' },
      })
    })

    it('GET /api/user/sessions lists all active sessions with device and IP metadata', async () => {
      const res = await request(app)
        .get('/api/user/sessions')
        .set('Authorization', `Bearer ${sessionToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(Array.isArray(res.body.data)).toBe(true)
      expect(res.body.data.length).toBeGreaterThanOrEqual(1)
      expect(res.body.data[0]).toHaveProperty('device')
      expect(res.body.data[0]).toHaveProperty('createdAt')
    })

    it('POST /api/user/sessions/logout-others revokes all except current session', async () => {
      // Create another session in DB
      await RefreshSession.create({
        universityId: env.UNIVERSITY_ID,
        userId: sessionUser._id,
        familyId: 'other-test-family',
        tokenHash: 'some_other_hash_' + Date.now(),
        expiresAt: new Date(Date.now() + 1000000),
        device: { browser: 'Safari', os: 'iOS', deviceType: 'mobile' },
      })

      const res = await request(app)
        .post('/api/user/sessions/logout-others')
        .set('Authorization', `Bearer ${sessionToken}`)

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
    })
  })

  describe('5. Granular Privacy Settings', () => {
    let privacyUser
    let privacyToken

    beforeAll(async () => {
      const passwordHash = await bcrypt.hash('PrivacyPassword123!', 12)
      privacyUser = await User.create({
        universityId: env.UNIVERSITY_ID,
        name: 'Privacy Student',
        email: `priv_${Date.now()}@test-auth-oauth.edu`,
        passwordHash,
        programId: testProgram._id,
        branchId: testBranch._id,
        semesterId: testSemester._id,
      })
      privacyToken = createAccessToken(privacyUser)
    })

    it('PATCH /api/user/privacy updates privacy toggles and reflects in user model', async () => {
      const res = await request(app)
        .patch('/api/user/privacy')
        .set('Authorization', `Bearer ${privacyToken}`)
        .send({
          publicProfile: false,
          showAvatar: false,
          showBio: false,
          showGithub: false,
          showLinkedin: false,
          showAcademicInfo: false,
        })

      expect(res.status).toBe(200)
      expect(res.body.success).toBe(true)
      expect(res.body.data.publicProfile).toBe(false)
      expect(res.body.data.privacySettings.showAvatar).toBe(false)
      expect(res.body.data.privacySettings.showGithub).toBe(false)
    })
  })
})
