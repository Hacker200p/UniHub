import mongoose from 'mongoose'
import { env } from './env.js'

export async function connectDatabase() {
  mongoose.set('strictQuery', true)
  await mongoose.connect(env.MONGO_URI, {
    serverSelectionTimeoutMS: 5000,
  })
  console.log(`MongoDB connected: ${mongoose.connection.name}`)
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
