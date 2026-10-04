import { z } from 'zod'
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const requestCreateSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().max(2000).default(''), programId: objectId.optional(), branchId: objectId.optional(), semesterId: objectId.optional(), subjectId: objectId.optional() })
