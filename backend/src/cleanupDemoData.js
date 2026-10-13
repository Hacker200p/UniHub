import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { User } from './models/User.js'
import { Resource } from './models/Resource.js'
import { Developer } from './models/Developer.js'
import { Notification } from './models/Notification.js'
import { Bookmark, RecentlyViewed } from './models/UserActivity.js'
import { RefreshSession } from './models/RefreshSession.js'
import { Download } from './models/Download.js'
import { ResourceRequest } from './models/ResourceRequest.js'
import { Report, Suggestion } from './models/Community.js'
import { AuditLog } from './models/AuditLog.js'

const apply = process.argv.includes('--apply')
const prepareBackup = process.argv.includes('--prepare-backup')
const wipeAll = process.argv.includes('--wipe-all')
const demoEmail = 'aman.verma@university.edu'
const demoResourceSlug = 'data-structures-complete-notes'
const demoDeveloperName = 'UniHub Team'
const testFixtureNames = [
  'CORS User',
  'Expired User',
  'Logout All User',
  'Logout User',
  'Race User',
  'Multi-Family User',
  'Student Alice',
  'Student Bob',
  'E2E Contributor Student',
  'E2E Stranger Student',
  'Curriculum Test Student',
  'First Student Contributor',
]
const testFixtureEmailPatterns = [
  /^cors-user-\d+@university\.edu$/,
  /^expired-user-\d+@university\.edu$/,
  /^logout(?:-all)?-user-\d+@university\.edu$/,
  /^race-user-\d+@university\.edu$/,
  /^multi-family-\d+@university\.edu$/,
  /^student\.[ab]\.\d+@university\.edu$/,
  /^e2e\.(?:student|stranger|admin)\.\d+@university\.edu$/,
  /^curriculum\.student\.\d+@university\.edu$/,
  /^admin\.\d+@silicon\.ac\.in$/,
  /^student2\.test@silicon\.ac\.in$/,
  /^.+_\d+@test-auth-oauth\.edu$/,
  /^audit\.student\.\d+@silicon\.ac\.in$/,
]

function safeUser(user) {
  if (!user) return null
  const value = user.toObject ? user.toObject() : user
  return { _id: value._id, email: value.email, name: value.name, role: value.role }
}

async function run() {
  if (apply && env.NODE_ENV !== 'development') {
    throw new Error('Cleanup is restricted to NODE_ENV=development')
  }

  await connectDatabase()
  const databaseName = mongoose.connection.name
  if (wipeAll) {
    if (databaseName !== 'test') {
      throw new Error('Full wipe requires the dedicated local test database named test')
    }
    const backupRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cleanup-backups')
    const backupDir = path.join(backupRoot, `full-test-database-${Date.now()}`)
    await fs.mkdir(backupDir, { recursive: true })
    const collections = await mongoose.connection.db.listCollections({}, { nameOnly: true }).toArray()
    const collectionCounts = {}
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue
      const collection = mongoose.connection.db.collection(name)
      const documents = await collection.find({}).toArray()
      await fs.writeFile(
        path.join(backupDir, `${name}.json`),
        JSON.stringify(documents, null, 2),
        'utf8',
      )
      collectionCounts[name] = documents.length
    }
    await fs.writeFile(
      path.join(backupDir, 'manifest.json'),
      JSON.stringify({
        createdAt: new Date().toISOString(),
        databaseName,
        operation: 'document deletion while preserving collections and indexes',
        collectionCounts,
      }, null, 2),
      'utf8',
    )
    const deletedCounts = {}
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue
      deletedCounts[name] = (await mongoose.connection.db.collection(name).deleteMany({})).deletedCount
    }
    const remaining = {}
    for (const { name } of collections) {
      if (name.startsWith('system.')) continue
      remaining[name] = await mongoose.connection.db.collection(name).countDocuments({})
    }
    console.log(JSON.stringify({
      databaseName,
      backupDirectory: backupDir,
      deletedCounts,
      remainingCounts: remaining,
      preservedSchema: true,
    }, null, 2))
    return
  }
  if ((apply || prepareBackup) && databaseName !== 'test') {
    throw new Error('Cleanup backup/deletion requires the dedicated local test database named test')
  }
  const [demoUser, demoResource, demoDeveloper] = await Promise.all([
    User.findOne({ universityId: env.UNIVERSITY_ID, email: demoEmail }),
    Resource.findOne({ universityId: env.UNIVERSITY_ID, slug: demoResourceSlug }),
    Developer.findOne({ universityId: env.UNIVERSITY_ID, name: demoDeveloperName }),
  ])
  const fixtureUsers = await User.find({
    universityId: env.UNIVERSITY_ID,
    $or: [
      { name: { $in: testFixtureNames } },
      ...testFixtureEmailPatterns.map((pattern) => ({ email: pattern })),
    ],
  }).select('_id email name role').lean()
  const fixtureUserIds = fixtureUsers.map((user) => user._id)
  const fixtureResources = fixtureUserIds.length
    ? await Resource.find({ universityId: env.UNIVERSITY_ID, contributorId: { $in: fixtureUserIds } })
      .select('_id slug title contributorId status file')
      .lean()
    : []
  const fixtureResourceIds = fixtureResources.map((resource) => resource._id)
  const [
    fixtureSessions,
    fixtureNotifications,
    fixtureBookmarks,
    fixtureRecentlyViewed,
    fixtureDownloads,
    fixtureRequests,
    fixtureReports,
    fixtureSuggestions,
    fixtureAuditLogs,
  ] = await Promise.all([
    fixtureUserIds.length ? RefreshSession.find({ userId: { $in: fixtureUserIds } }).select('_id userId').lean() : [],
    fixtureUserIds.length ? Notification.find({ universityId: env.UNIVERSITY_ID, userId: { $in: fixtureUserIds } }).select('_id userId resourceId requestId reportId suggestionId').lean() : [],
    fixtureUserIds.length || fixtureResourceIds.length ? Bookmark.find({ $or: [{ userId: { $in: fixtureUserIds } }, { resourceId: { $in: fixtureResourceIds } }] }).select('_id userId resourceId').lean() : [],
    fixtureUserIds.length || fixtureResourceIds.length ? RecentlyViewed.find({ $or: [{ userId: { $in: fixtureUserIds } }, { resourceId: { $in: fixtureResourceIds } }] }).select('_id userId resourceId').lean() : [],
    fixtureUserIds.length || fixtureResourceIds.length ? Download.find({ universityId: env.UNIVERSITY_ID, $or: [{ userId: { $in: fixtureUserIds } }, { resourceId: { $in: fixtureResourceIds } }] }).select('_id userId resourceId').lean() : [],
    fixtureUserIds.length ? ResourceRequest.find({ universityId: env.UNIVERSITY_ID, $or: [{ creatorId: { $in: fixtureUserIds } }, { upvoterIds: { $in: fixtureUserIds } }] }).select('_id creatorId upvoterIds fulfilledResourceId').lean() : [],
    fixtureUserIds.length || fixtureResourceIds.length ? Report.find({ universityId: env.UNIVERSITY_ID, $or: [{ userId: { $in: fixtureUserIds } }, { resourceId: { $in: fixtureResourceIds } }] }).select('_id userId resourceId').lean() : [],
    fixtureUserIds.length ? Suggestion.find({ universityId: env.UNIVERSITY_ID, userId: { $in: fixtureUserIds } }).select('_id userId').lean() : [],
    fixtureUserIds.length ? AuditLog.find({ actorId: { $in: fixtureUserIds } }).select('_id actorId').lean() : [],
  ])

  const relatedResourceId = demoResource?._id
  const relatedUserId = demoUser?._id
  const expiredUsers = await User.find({
    universityId: env.UNIVERSITY_ID,
    $or: [
      { universityEmailOtpExpiresAt: { $lt: new Date(), $ne: null } },
      { resetPasswordOtpExpiresAt: { $lt: new Date(), $ne: null } },
      { resetPasswordGrantExpiresAt: { $lt: new Date(), $ne: null } },
    ],
  }).select('_id email name').lean()
  const [notifications, bookmarks, recentlyViewed] = await Promise.all([
    relatedUserId
      ? Notification.find({ universityId: env.UNIVERSITY_ID, userId: relatedUserId }).select('_id type resourceId requestId reportId').lean()
      : [],
    relatedResourceId ? Bookmark.find({ universityId: env.UNIVERSITY_ID, resourceId: relatedResourceId }).select('_id userId resourceId').lean() : [],
    relatedResourceId ? RecentlyViewed.find({ universityId: env.UNIVERSITY_ID, resourceId: relatedResourceId }).select('_id userId resourceId').lean() : [],
  ])

  const report = {
    generatedAt: new Date().toISOString(),
    databaseName,
    universityId: env.UNIVERSITY_ID,
    mode: apply ? 'apply' : 'dry-run',
    confirmedTestDemoData: {
      users: demoUser ? [safeUser(demoUser)] : [],
      resources: demoResource ? [{
        _id: demoResource._id,
        slug: demoResource.slug,
        contributorId: demoResource.contributorId,
        status: demoResource.status,
        file: demoResource.file,
      }] : [],
      dependentNotifications: notifications,
      dependentBookmarks: bookmarks,
      dependentRecentlyViewed: recentlyViewed,
    },
    confirmedTestFixtures: {
      users: fixtureUsers.map(safeUser),
      resources: fixtureResources,
      sessions: fixtureSessions,
      notifications: fixtureNotifications,
      bookmarks: fixtureBookmarks,
      recentlyViewed: fixtureRecentlyViewed,
      downloads: fixtureDownloads,
      requests: fixtureRequests,
      reports: fixtureReports,
      suggestions: fixtureSuggestions,
      auditLogs: fixtureAuditLogs,
    },
    ambiguous: demoDeveloper ? [{ collection: 'developers', _id: demoDeveloper._id, name: demoDeveloper.name, reason: 'Name alone is not sufficient proof that this profile is disposable.' }] : [],
    expiredTemporaryData: {
      description: 'Expired OTP/reset challenge fields are cleared by the existing account lifecycle policy.',
      candidates: expiredUsers.map(safeUser),
    },
  }

  console.log(JSON.stringify(report, null, 2))
  if (prepareBackup) {
    const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cleanup-backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `test-fixtures-${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify({
      ...report,
      backupPurpose: 'Recovery metadata for confirmed automated test fixtures only',
      users: fixtureUsers.map(safeUser),
      resources: fixtureResources,
    }, null, 2), 'utf8')
    console.log(`Sanitized recovery backup prepared locally: ${backupPath}`)
  }
  if (!apply) return

  if (fixtureUsers.length) {
    const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cleanup-backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `test-fixtures-${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(report, null, 2), 'utf8')
    await Promise.all([
      RefreshSession.deleteMany({ _id: { $in: fixtureSessions.map((item) => item._id) } }),
      Notification.deleteMany({ _id: { $in: fixtureNotifications.map((item) => item._id) } }),
      Bookmark.deleteMany({ _id: { $in: fixtureBookmarks.map((item) => item._id) } }),
      RecentlyViewed.deleteMany({ _id: { $in: fixtureRecentlyViewed.map((item) => item._id) } }),
      Download.deleteMany({ _id: { $in: fixtureDownloads.map((item) => item._id) } }),
      ResourceRequest.deleteMany({ _id: { $in: fixtureRequests.map((item) => item._id) } }),
      Report.deleteMany({ _id: { $in: fixtureReports.map((item) => item._id) } }),
      Suggestion.deleteMany({ _id: { $in: fixtureSuggestions.map((item) => item._id) } }),
      AuditLog.deleteMany({ _id: { $in: fixtureAuditLogs.map((item) => item._id) } }),
      Resource.deleteMany({ _id: { $in: fixtureResourceIds }, universityId: env.UNIVERSITY_ID }),
      User.deleteMany({ _id: { $in: fixtureUserIds }, universityId: env.UNIVERSITY_ID }),
    ])
    console.log(`Test fixture cleanup applied. Local backup: ${backupPath}`)
  }

  if (demoResource && (!demoUser || String(demoResource.contributorId) === String(demoUser._id))) {
    const backupDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../.cleanup-backups')
    await fs.mkdir(backupDir, { recursive: true })
    const backupPath = path.join(backupDir, `demo-cleanup-${Date.now()}.json`)
    await fs.writeFile(backupPath, JSON.stringify(report, null, 2), 'utf8')

    await Resource.deleteOne({ _id: demoResource._id, universityId: env.UNIVERSITY_ID, slug: demoResourceSlug, contributorId: demoUser?._id })
    await Notification.deleteMany({ _id: { $in: notifications.map((item) => item._id) }, universityId: env.UNIVERSITY_ID })
    await Bookmark.deleteMany({ _id: { $in: bookmarks.map((item) => item._id) }, universityId: env.UNIVERSITY_ID })
    await RecentlyViewed.deleteMany({ _id: { $in: recentlyViewed.map((item) => item._id) }, universityId: env.UNIVERSITY_ID })
    await User.deleteOne({ _id: demoUser?._id, universityId: env.UNIVERSITY_ID, email: demoEmail })
    await User.updateMany(
      { _id: { $in: expiredUsers.map((user) => user._id) }, universityId: env.UNIVERSITY_ID },
      { $unset: { universityEmailOtpHash: '', universityEmailOtpExpiresAt: '', resetPasswordOtpHash: '', resetPasswordOtpExpiresAt: '', resetPasswordOtpAttempts: '', resetPasswordOtpSentAt: '', resetPasswordGrantHash: '', resetPasswordGrantExpiresAt: '' } },
    )
    console.log(`Cleanup applied. Local backup: ${backupPath}`)
  } else {
    console.log('No confirmed demo resource/user pair was eligible for deletion; ambiguous records were preserved.')
  }
}

run()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
