import { Router } from 'express'
import {
  createBranch,
  createProgram,
  createSemester,
  createSubject,
  deleteBranch,
  deleteProgram,
  deleteSemester,
  deleteSubject,
  listAcademicYears,
  listAllAcademic,
  listBranches,
  listPrograms,
  listSemesters,
  listSubjects,
  updateBranch,
  updateProgram,
  updateSemester,
  updateSubject,
} from '../controllers/academicController.js'
import { requireAuth, requireRoles } from '../middleware/auth.js'

export const academicRouter = Router()

// Public academic endpoints
academicRouter.get('/programs', listPrograms)
academicRouter.get('/branches', listBranches)
academicRouter.get('/academic-years', listAcademicYears)
academicRouter.get('/semesters', listSemesters)
academicRouter.get('/subjects', listSubjects)

// Admin academic management endpoints
academicRouter.get(
  '/admin/academic/all',
  requireAuth,
  requireRoles('ADMIN', 'MODERATOR'),
  listAllAcademic,
)
academicRouter.post('/admin/programs', requireAuth, requireRoles('ADMIN'), createProgram)
academicRouter.patch('/admin/programs/:id', requireAuth, requireRoles('ADMIN'), updateProgram)
academicRouter.delete('/admin/programs/:id', requireAuth, requireRoles('ADMIN'), deleteProgram)

academicRouter.post('/admin/branches', requireAuth, requireRoles('ADMIN'), createBranch)
academicRouter.patch('/admin/branches/:id', requireAuth, requireRoles('ADMIN'), updateBranch)
academicRouter.delete('/admin/branches/:id', requireAuth, requireRoles('ADMIN'), deleteBranch)

academicRouter.post('/admin/semesters', requireAuth, requireRoles('ADMIN'), createSemester)
academicRouter.patch('/admin/semesters/:id', requireAuth, requireRoles('ADMIN'), updateSemester)
academicRouter.delete('/admin/semesters/:id', requireAuth, requireRoles('ADMIN'), deleteSemester)

academicRouter.post('/admin/subjects', requireAuth, requireRoles('ADMIN'), createSubject)
academicRouter.patch('/admin/subjects/:id', requireAuth, requireRoles('ADMIN'), updateSubject)
academicRouter.delete('/admin/subjects/:id', requireAuth, requireRoles('ADMIN'), deleteSubject)
