import { z } from 'zod'

export const academicQuerySchema = z.object({
  programId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  branchId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
  semesterId: z.string().regex(/^[a-f\d]{24}$/i).optional(),
})
