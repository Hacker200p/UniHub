import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import request from 'supertest'
import crypto from 'node:crypto'

vi.mock('../src/services/storageProvider.js', () => ({
  remove: vi.fn().mockResolvedValue(undefined),
  resourceProvider: vi.fn((resource) => resource.file.provider),
  transferToGoogleDrive: vi.fn(),
}))
vi.mock('../src/services/mailer.js', () => ({
  sendLink: vi.fn().mockResolvedValue({ success: true }),
}))
vi.mock('../src/utils/audit.js', () => ({
  recordAudit: vi.fn().mockResolvedValue(undefined),
}))

import { app } from '../src/app.js'
import { connectDatabase, disconnectDatabase } from '../src/config/database.js'
import { env, storageConfig } from '../src/config/env.js'
import { User } from '../src/models/User.js'
import { Resource } from '../src/models/Resource.js'
import { Notification } from '../src/models/Notification.js'
import { createAccessToken } from '../src/utils/tokens.js'
import { remove, transferToGoogleDrive } from '../src/services/storageProvider.js'
import { processRetention, approveWithTransfer, retentionDeadline } from '../src/services/retentionService.js'

describe('Staged retention and provider transfer lifecycle', () => {
  let user
  let admin
  let adminToken

  beforeAll(async () => {
    await connectDatabase()
    storageConfig.stagingProvider = 's3'
    env.RETENTION_ENABLED = true
    user = await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Retention Test Student',
      email: `retention.${Date.now()}@university.edu`,
      passwordHash: 'dummyHash123456',
      role: 'STUDENT',
    })
    admin = await User.create({
      universityId: env.UNIVERSITY_ID,
      name: 'Retention Test Admin',
      email: `retention.admin.${Date.now()}@university.edu`,
      passwordHash: 'dummyHash123456',
      role: 'ADMIN',
    })
    adminToken = createAccessToken(admin)
  })

  beforeEach(async () => {
    await Resource.deleteMany({ title: /^Retention Test/ })
    await Notification.deleteMany({ userId: user._id })
    remove.mockClear()
    transferToGoogleDrive.mockReset()
  })

  afterAll(async () => {
    await Resource.deleteMany({ title: /^Retention Test/ })
    await User.deleteMany({ _id: { $in: [user?._id, admin?._id] } })
    await disconnectDatabase()
  })

  function resource(overrides = {}) {
    const uploadedAt = overrides.uploadedAt || new Date(Date.now() - 10 * 24 * 60 * 60 * 1000)
    return Resource.create({
      universityId: env.UNIVERSITY_ID,
      title: `Retention Test ${Date.now()}-${Math.random()}`,
      slug: `retention-test-${Date.now()}-${Math.random()}`,
      resourceType: 'NOTES',
      programId: user._id,
      semesterId: user._id,
      subjectId: user._id,
      contributorId: user._id,
      file: {
        provider: 's3',
        providerFileId: `resources/${Date.now()}.pdf`,
        storageKey: `${'a'.repeat(64)}.pdf`,
        fileName: 'retention.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 10,
        sha256: crypto.randomBytes(32).toString('hex'),
        storedAt: uploadedAt,
      },
      retention: {
        originalUploadedAt: uploadedAt,
        deadline: overrides.deadline || retentionDeadline(uploadedAt),
        cleanupState: 'ELIGIBLE',
        warningDaysSent: [],
      },
      transfer: { state: overrides.transferState || 'NOT_REQUIRED' },
      ...overrides,
    })
  }

  it('uses a stable 120-day deadline and sends each warning only once', async () => {
    const now = new Date('2026-10-14T00:00:00.000Z')
    const item = await resource({ uploadedAt: new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000) })

    const first = await processRetention(now)
    const second = await processRetention(now)

    expect(first.warnings).toBe(1)
    expect(second.warnings).toBe(0)
    expect(await Notification.countDocuments({ resourceId: item._id, type: 'RETENTION_WARNING' })).toBe(1)
    expect(item.retention.deadline.getTime()).toBe(retentionDeadline(item.retention.originalUploadedAt).getTime())
  })

  it('expires pending staged files at day 120 and never expires approved permanent files', async () => {
    const now = new Date('2026-10-14T00:00:00.000Z')
    const pending = await resource({ uploadedAt: new Date(now.getTime() - 120 * 24 * 60 * 60 * 1000), deadline: now })
    await resource({
      status: 'APPROVED',
      'file.provider': 'google-drive',
      'file.providerFileId': 'drive-id',
      retention: { cleanupState: 'DISABLED' },
    })

    const result = await processRetention(now)
    const updated = await Resource.findById(pending._id)

    expect(result.expired).toBe(1)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(updated.file.status).toBe('DELETED')
    expect(await Notification.countDocuments({ resourceId: pending._id, type: 'RETENTION_EXPIRED' })).toBe(1)
  })

  it('records deletion failures and retries them safely', async () => {
    const now = new Date('2026-10-14T00:00:00.000Z')
    const item = await resource({ uploadedAt: new Date(now.getTime() - 121 * 24 * 60 * 60 * 1000), deadline: now })
    remove.mockRejectedValueOnce(new Error('provider unavailable')).mockResolvedValueOnce(undefined)

    await processRetention(now)
    expect((await Resource.findById(item._id)).retention.cleanupState).toBe('FAILED')
    await processRetention(new Date(now.getTime() + 60 * 60 * 1000))
    expect((await Resource.findById(item._id)).retention.cleanupState).toBe('COMPLETED')
    expect(remove).toHaveBeenCalledTimes(2)
  })

  it('extends the deadline through an authorized admin endpoint', async () => {
    const item = await resource({ deadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000) })
    const response = await request(app)
      .patch(`/api/admin/resources/${item._id}/retention`)
      .set('Authorization', `Bearer ${adminToken}`)
      .send({ days: 30, reason: 'Review queue backlog' })

    expect(response.status).toBe(200)
    const updated = await Resource.findById(item._id)
    expect(updated.retention.deadline.getTime()).toBeGreaterThan(item.retention.deadline.getTime())
    expect(updated.retention.extendedBy.toString()).toBe(admin._id.toString())
  })

  it('preserves the staging copy when Google Drive transfer fails', async () => {
    const item = await resource()
    transferToGoogleDrive.mockRejectedValueOnce(new Error('Google Drive unavailable'))

    await expect(approveWithTransfer(item)).rejects.toThrow('Google Drive unavailable')
    const updated = await Resource.findById(item._id)
    expect(updated.status).toBe('PENDING_REVIEW')
    expect(updated.transfer.state).toBe('FAILED')
    expect(remove).not.toHaveBeenCalled()
  })

  it('records staging metadata and retries staging deletion after transfer', async () => {
    const item = await resource()
    transferToGoogleDrive.mockResolvedValueOnce({
      provider: 'google-drive',
      providerFileId: 'drive-file-id',
      storageKey: `${'c'.repeat(64)}.pdf`,
      folderId: 'folder-id',
      sizeBytes: item.file.sizeBytes,
    })
    remove.mockRejectedValueOnce(new Error('staging deletion unavailable')).mockResolvedValueOnce(undefined)

    await expect(approveWithTransfer(item)).rejects.toThrow('staging deletion unavailable')
    let updated = await Resource.findById(item._id)
    expect(updated.file.provider).toBe('google-drive')
    expect(updated.staging.providerFileId).toBe(item.file.providerFileId)

    updated = await approveWithTransfer(updated)
    expect(updated.staging?.providerFileId).toBeUndefined()
    expect(updated.transfer.state).toBe('COMPLETED')
    expect(remove).toHaveBeenCalledTimes(2)
  })
})
