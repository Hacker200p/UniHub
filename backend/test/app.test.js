import { beforeAll, describe, expect, it } from 'vitest'

process.env.NODE_ENV = 'test'
process.env.MONGO_URI = 'mongodb://127.0.0.1:27017/university-study-hub-test'
process.env.CLIENT_URL = 'http://localhost:5173'
process.env.JWT_SECRET = 'a'.repeat(40)
process.env.UNIVERSITY_ID = 'test-university'

let app
beforeAll(async () => { ({ app } = await import('../src/app.js')) })

describe('API foundation', () => {
  it('trusts the single Render proxy hop before rate limiting runs', async () => {
    expect(app.get('trust proxy')).toBe(1)

    const response = await (await import('supertest')).default(app)
      .get('/api/health')
      .set('X-Forwarded-For', '203.0.113.10')

    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })

  it('reports health without a database connection', async () => {
    const response = await (await import('supertest')).default(app).get('/api/health')
    expect(response.status).toBe(200)
    expect(response.body.success).toBe(true)
  })

  it('rejects unauthenticated protected requests', async () => {
    const response = await (await import('supertest')).default(app).get('/api/auth/me')
    expect(response.status).toBe(401)
    expect(response.body.message).toBe('Authentication required')
  })

  it('returns a consistent not-found response', async () => {
    const response = await (await import('supertest')).default(app).get('/api/not-a-route')
    expect(response.status).toBe(404)
    expect(response.body.success).toBe(false)
  })

  it('protects admin overview, upload, bookmarks, and notifications', async () => {
    const request = (await import('supertest')).default(app)
    for (const path of ['/api/admin/overview', '/api/user/bookmarks', '/api/user/notifications']) {
      const response = await request.get(path)
      expect(response.status).toBe(401)
      expect(response.body.success).toBe(false)
    }
    const uploadResponse = await request.post('/api/resources/upload')
    expect(uploadResponse.status).toBe(401)
    expect(uploadResponse.body.success).toBe(false)
  })

  it('hides malformed public resource identifiers behind 404 responses', async () => {
    const response = await (await import('supertest')).default(app).get('/api/resources/not-an-object-id')
    expect(response.status).toBe(404)
    expect(response.body.message).toBe('Resource not found')
  })

  it('does not accept refresh tokens from JSON and exposes a safe readiness response', async () => {
    const request = (await import('supertest')).default(app)
    const refreshResponse = await request.post('/api/auth/refresh').send({ refreshToken: 'not-a-valid-session-token' })
    expect(refreshResponse.status).toBe(401)
    expect(refreshResponse.body.data).toBeUndefined()
    const readyResponse = await request.get('/api/ready')
    expect([200, 503]).toContain(readyResponse.status)
    expect(readyResponse.body).not.toHaveProperty('JWT_SECRET')
  })
})
