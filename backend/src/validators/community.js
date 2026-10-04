import { z } from 'zod'
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const suggestionSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(3000), category: z.enum(['MISSING_SUBJECT', 'MISSING_PYQ', 'BETTER_NOTES', 'INCORRECT_INFORMATION', 'FEATURE', 'RESOURCE_REQUEST', 'OTHER']) })
export const reportSchema = z.object({ reason: z.enum(['INCORRECT_FILE', 'WRONG_SUBJECT', 'WRONG_SEMESTER', 'DUPLICATE', 'POOR_QUALITY', 'COPYRIGHT_CONCERN', 'OTHER']), details: z.string().trim().max(1000).default('') })
export const communityStatusSchema = z.object({ status: z.enum(['OPEN', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'RESOLVED', 'DISMISSED']), reply: z.string().trim().max(2000).default('') })
export { objectId }
