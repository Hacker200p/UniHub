import { z } from 'zod'

const objectId = z.string().regex(/^[a-f\d]{24}$/i)
export const academicQuerySchema = z.object({
  programId: objectId.optional(),
  branchId: objectId.optional(),
  semesterId: objectId.optional(),
  academicYear: z.coerce.number().int().min(1).max(10).optional(),
  subjectType: z.enum(['Theory', 'Practical']).optional(),
  electiveGroup: z.string().trim().optional(),
})
