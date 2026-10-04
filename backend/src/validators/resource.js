import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const resourceCreateSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(3000).default(''),
  resourceType: z.enum(['NOTES', 'PYQ', 'ASSIGNMENT', 'LAB_MATERIAL', 'REFERENCE', 'SYLLABUS', 'OTHER']),
  examType: z.enum(['MID_TERM', 'END_TERM', 'NONE']).default('NONE'),
  academicYear: z.coerce.number().int().min(2000).max(2200).optional(),
  programId: objectId,
  branchId: objectId.optional(),
  semesterId: objectId,
  subjectId: objectId,
  file: z.object({ url: z.string().url(), storageKey: z.string().min(1), fileName: z.string().min(1).max(255), mimeType: z.literal('application/pdf'), sizeBytes: z.coerce.number().int().positive().max(25 * 1024 * 1024), sha256: z.string().regex(/^[a-f\d]{64}$/i) }),
})
export const moderationSchema = z.object({ reason: z.string().trim().max(1000).default('') })
