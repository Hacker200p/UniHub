import { connectDatabase, disconnectDatabase } from './src/config/database.js'
import { User } from './src/models/User.js'
import { Resource } from './src/models/Resource.js'
import { Report } from './src/models/Community.js'
import { Notification } from './src/models/Notification.js'
import { env } from './src/config/env.js'

async function main() {
  await connectDatabase()
  const sohan = await User.findOne({ email: /sohanpanda/i })
  if (!sohan) {
    console.log('Sohan not found')
    process.exit(1)
  }
  console.log('Found user:', sohan._id, sohan.email)

  const rep1 = await Report.findById('6aca130c33abe5e1deaa8ff1').populate('resourceId')
  if (rep1) {
    rep1.userId = sohan._id
    await rep1.save()
    await Notification.create({
      universityId: env.UNIVERSITY_ID,
      userId: sohan._id,
      type: 'REPORT_REPLIED',
      title: 'Update on Your Report',
      message: `A moderator reviewed your report on "${rep1.resourceId?.title || 'Shared Data Structures Notes'}": ${rep1.moderatorReply || rep1.adminReply}`,
      reportId: rep1._id,
      resourceId: rep1.resourceId?._id || rep1.resourceId,
    })
    console.log('Created notif 1')
  }

  const rep2 = await Report.findById('6aca13f033abe5e1deaa915c').populate('resourceId')
  if (rep2) {
    rep2.userId = sohan._id
    await rep2.save()
    await Notification.create({
      universityId: env.UNIVERSITY_ID,
      userId: sohan._id,
      type: 'REPORT_RESOLVED',
      title: 'Your Report Has Been Resolved',
      message: `Your report on "${rep2.resourceId?.title || 'DAA'}" has been resolved by our moderation team. Note: ${rep2.moderatorReply || rep2.adminReply}`,
      reportId: rep2._id,
      resourceId: rep2.resourceId?._id || rep2.resourceId,
    })
    console.log('Created notif 2')
  }

  const total = await Notification.countDocuments({ userId: sohan._id })
  console.log('Total notifications for Sohan:', total)
  await disconnectDatabase()
  process.exit(0)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
