import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const uploadMetadataSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().max(3000).default(''), resourceType: z.enum(['NOTES', 'PYQ', 'ASSIGNMENT', 'LAB_MATERIAL', 'REFERENCE', 'SYLLABUS', 'OTHER']), examType: z.enum(['MID_TERM', 'END_TERM', 'NONE']).default('NONE'), academicYear: z.coerce.number().int().min(1).max(2200).optional(), programId: objectId, branchId: objectId.optional(), semesterId: objectId, subjectId: objectId })
