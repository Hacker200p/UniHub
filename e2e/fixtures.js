import { test as base, expect } from '@playwright/test'

const API_BASE = 'http://localhost:4000/api'

export const SAMPLE_PDF_BUFFER = Buffer.from(
  '%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] >>\nendobj\nxref\n0 4\n0000000000 65535 f\n0000000010 00000 n\n0000000060 00000 n\n0000000117 00000 n\ntrailer\n<< /Size 4 /Root 1 0 R >>\nstartxref\n190\n%%EOF\n',
)

/**
 * Creates a unique test student account via the API
 */
export async function createTestStudent(request, overrides = {}) {
  const email = `student_${Date.now()}_${Math.random().toString(36).slice(2, 7)}@university.edu`
  const password = 'StrongPassword123!'
  const name = `Test Student ${Math.random().toString(36).slice(2, 5)}`

  // Fetch academic programs to get a valid programId
  const progRes = await request.get(`${API_BASE}/programs`)
  const progJson = await progRes.json()
  const programId = progJson.data?.[0]?._id

  if (!programId) {
    throw new Error('No academic programs found — make sure backend is seeded')
  }

  const registerRes = await request.post(`${API_BASE}/auth/register`, {
    data: {
      name,
      email,
      password,
      programId,
      ...overrides,
    },
  })

  const regJson = await registerRes.json()
  return {
    name,
    email,
    password,
    programId,
    user: regJson.data?.user,
    accessToken: regJson.data?.accessToken,
  }
}

/**
 * Returns seeded academic structure IDs
 */
export async function getAcademicSetup(request) {
  const progRes = await request.get(`${API_BASE}/programs`)
  const progJson = await progRes.json()
  const program = progJson.data[0]

  const subRes = await request.get(`${API_BASE}/subjects?programId=${program._id}`)
  const subJson = await subRes.json()
  const subject = subJson.data[0]

  return {
    programId: program._id,
    branchId: subject.branchId,
    semesterId: subject.semesterId,
    subjectId: subject._id,
  }
}

/**
 * Logs in directly via API to get auth tokens
 */
export async function apiLogin(request, email, password) {
  const res = await request.post(`${API_BASE}/auth/login`, {
    data: { email, password },
  })
  const json = await res.json()
  return json.data
}

export const test = base.extend({})

export { expect }
