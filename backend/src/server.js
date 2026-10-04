import { app } from './app.js'
import { connectDatabase } from './config/database.js'
import { env } from './config/env.js'

await connectDatabase()
app.listen(env.PORT, '0.0.0.0', () =>
  console.log(`UniHub API listening on port ${env.PORT}`),
)
