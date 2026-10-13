import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { User } from './models/User.js'

async function seedAdmin() {
  if (env.NODE_ENV !== 'development') {
    throw new Error('Admin seeding is restricted to development mode')
  }
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD) {
    throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD must be configured')
  }

  await connectDatabase()
  if (mongoose.connection.name !== 'test') {
    throw new Error('Admin seeding requires the verified local test database named test')
  }

  const email = env.ADMIN_EMAIL.toLowerCase()
  const passwordHash = await bcrypt.hash(env.ADMIN_PASSWORD, 12)
  const user = await User.findOneAndUpdate(
    { universityId: env.UNIVERSITY_ID, email },
    {
      $set: {
        name: 'Platform Admin',
        passwordHash,
        role: 'ADMIN',
        isActive: true,
        emailVerifiedAt: new Date(),
      },
      $setOnInsert: {
        universityId: env.UNIVERSITY_ID,
        email,
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true },
  ).select('_id email role isActive')

  console.log(JSON.stringify({
    databaseName: mongoose.connection.name,
    insertedOrUpdated: true,
    userId: user._id,
    role: user.role,
    isActive: user.isActive,
  }))
}

seedAdmin()
  .catch((error) => {
    console.error(error.message)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
