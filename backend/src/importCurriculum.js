import { connectDatabase, disconnectDatabase } from './config/database.js'
import { importCurriculum } from './services/curriculumImporter.js'

async function run() {
  try {
    await connectDatabase()
    console.log('--- University Curriculum Importer ---')
    const summary = await importCurriculum({ verbose: true })
    console.log('--- Summary Complete ---', JSON.stringify(summary, null, 2))
    process.exitCode = 0
  } catch (error) {
    console.error('Import failed with error:', error)
    process.exitCode = 1
  } finally {
    await disconnectDatabase()
  }
}

run()
