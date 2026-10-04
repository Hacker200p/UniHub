import express from 'express'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import mongoose from 'mongoose'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import { env } from './config/env.js'
import { authRouter } from './routes/authRoutes.js'
import { academicRouter } from './routes/academicRoutes.js'
import { resourceRouter } from './routes/resourceRoutes.js'
import { developerRouter } from './routes/developerRoutes.js'
import { communityRouter } from './routes/communityRoutes.js'
import { userRouter } from './routes/userRoutes.js'
import { adminRouter } from './routes/adminRoutes.js'
import { notificationRouter } from './routes/notificationRoutes.js'
import { requestRouter } from './routes/requestRoutes.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'

export const app = express()
const storagePath = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../storage')
app.disable('x-powered-by')
app.use(helmet())
app.use(cors({ origin: env.CLIENT_URL, credentials: true }))
app.use(express.json({ limit: '100kb' }))
app.use('/uploads', express.static(storagePath, { dotfiles: 'deny', index: false }))
app.use(
  rateLimit({
    windowMs: env.RATE_LIMIT_WINDOW_MS,
    limit: env.NODE_ENV === 'test' || process.env.NODE_ENV === 'test' ? 10000 : env.RATE_LIMIT_MAX,
    standardHeaders: 'draft-8',
    legacyHeaders: false,
  }),
)
app.get('/api/health', (req, res) => res.json({ success: true, message: 'UniHub API is running', data: { environment: env.NODE_ENV } }))
app.get('/api/ready', (req, res) => { const ready = mongoose.connection.readyState === 1; return res.status(ready ? 200 : 503).json({ success: ready, message: ready ? 'UniHub API is ready' : 'Database is not ready' }) })
app.use('/api/auth', authRouter)
app.use('/api', academicRouter)
app.use('/api', resourceRouter)
app.use('/api', developerRouter)
app.use('/api', communityRouter)
app.use('/api/user', userRouter)
app.use('/api/admin', adminRouter)
app.use('/api/user', notificationRouter)
app.use('/api', requestRouter)
app.use(notFoundHandler)
app.use(errorHandler)
