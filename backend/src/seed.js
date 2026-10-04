import bcrypt from 'bcryptjs'
import { connectDatabase, disconnectDatabase } from './config/database.js'
import { env } from './config/env.js'
import { Branch, Program, Semester, Subject } from './models/Academic.js'
import { User } from './models/User.js'
import { Developer } from './models/Developer.js'
import { Resource } from './models/Resource.js'
import { slugify } from './utils/slug.js'

async function upsert(model, filter, values) {
  return model.findOneAndUpdate(filter, values, {
    upsert: true,
    new: true,
    setDefaultsOnInsert: true,
  })
}

async function seed() {
  await connectDatabase()
  const universityId = env.UNIVERSITY_ID
  const btech = await upsert(
    Program,
    { universityId, slug: 'b-tech' },
    { universityId, name: 'B.Tech', code: 'BTECH', slug: 'b-tech' },
  )
  const imca = await upsert(
    Program,
    { universityId, slug: 'imca' },
    { universityId, name: 'IMCA', code: 'IMCA', slug: 'imca' },
  )
  const branches = {}
  for (const item of [
    ['CSE', 'Computer Science and Engineering'],
    ['ECE', 'Electronics and Communication Engineering'],
    ['EIE', 'Electronics and Instrumentation Engineering'],
    ['EEE', 'Electrical and Electronics Engineering'],
    ['VLSI', 'Very Large Scale Integration'],
  ]) {
    branches[item[0]] = await upsert(
      Branch,
      { universityId, programId: btech._id, slug: slugify(item[0]) },
      {
        universityId,
        programId: btech._id,
        name: item[1],
        code: item[0],
        slug: slugify(item[0]),
      },
    )
  }
  const semesters = {}
  for (let number = 1; number <= 8; number += 1) {
    semesters[`BTECH-CSE-${number}`] = await upsert(
      Semester,
      { universityId, programId: btech._id, branchId: branches.CSE._id, number },
      {
        universityId,
        programId: btech._id,
        branchId: branches.CSE._id,
        name: `Semester ${number}`,
        slug: `semester-${number}`,
        number,
      },
    )
  }
  for (let number = 1; number <= 4; number += 1) {
    await upsert(
      Semester,
      { universityId, programId: imca._id, number },
      {
        universityId,
        programId: imca._id,
        name: `Semester ${number}`,
        slug: `imca-semester-${number}`,
        number,
      },
    )
  }
  const sampleSubjects = [
    ['Data Structures', 'CS301', semesters['BTECH-CSE-3'], branches.CSE],
    [
      'Database Systems',
      'CS401',
      await Semester.findOne({
        universityId,
        programId: btech._id,
        branchId: branches.CSE._id,
        number: 4,
      }),
      branches.CSE,
    ],
  ]
  let dsSubject = null
  for (const [name, code, semester, branch] of sampleSubjects) {
    const sub = await upsert(
      Subject,
      { universityId, semesterId: semester._id, slug: slugify(name) },
      {
        universityId,
        programId: btech._id,
        branchId: branch._id,
        semesterId: semester._id,
        name,
        code,
        slug: slugify(name),
        description: 'Demo academic structure record.',
      },
    )
    if (name === 'Data Structures') dsSubject = sub
  }

  if (env.ADMIN_EMAIL && env.ADMIN_PASSWORD) {
    await upsert(
      User,
      { universityId, email: env.ADMIN_EMAIL.toLowerCase() },
      {
        universityId,
        email: env.ADMIN_EMAIL.toLowerCase(),
        name: 'Platform Admin',
        passwordHash: await bcrypt.hash(env.ADMIN_PASSWORD, 12),
        role: 'ADMIN',
      },
    )
  }

  // Seed sample public contributor
  const contributorUser = await upsert(
    User,
    { universityId, email: 'aman.verma@university.edu' },
    {
      universityId,
      name: 'Aman Verma',
      email: 'aman.verma@university.edu',
      passwordHash: await bcrypt.hash('ContributorPass123!', 12),
      role: 'STUDENT',
      programId: btech._id,
      branchId: branches.CSE._id,
      semesterId: semesters['BTECH-CSE-3']._id,
      publicProfile: true,
      bio: 'Sharing verified notes for 3rd semester CSE subjects.',
    },
  )

  // Seed approved resource for contributor
  if (dsSubject) {
    await upsert(
      Resource,
      { universityId, slug: 'data-structures-complete-notes' },
      {
        universityId,
        title: 'Data Structures Complete Notes',
        slug: 'data-structures-complete-notes',
        description: 'Detailed unit-wise notes covering trees, graphs, sorting, and dynamic programming.',
        resourceType: 'NOTES',
        examType: 'MID_TERM',
        academicYear: 2025,
        programId: btech._id,
        branchId: branches.CSE._id,
        semesterId: semesters['BTECH-CSE-3']._id,
        subjectId: dsSubject._id,
        contributorId: contributorUser._id,
        file: {
          url: 'http://localhost:4000/uploads/demo-notes.pdf',
          storageKey: 'demo-notes.pdf',
          fileName: 'Data_Structures_Notes.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 204800,
          sha256: 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855',
        },
        status: 'APPROVED',
        verified: true,
        downloadCount: 142,
      },
    )
  }

  await upsert(
    Developer,
    { universityId, name: 'UniHub Team' },
    {
      universityId,
      name: 'UniHub Team',
      role: 'Student development team',
      description: 'Building a free academic resource space for our university community.',
      skills: ['React', 'Node.js', 'MongoDB'],
      websiteUrl: 'https://studyhub.university.edu',
      githubUrl: 'https://github.com',
      linkedinUrl: 'https://linkedin.com',
    },
  )
  console.log('Seed complete')
}

seed()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(async () => {
    await disconnectDatabase()
  })
