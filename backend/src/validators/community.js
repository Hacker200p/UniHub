import { z } from 'zod'
const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid identifier')
export const suggestionSchema = z.object({ title: z.string().trim().min(3).max(180), description: z.string().trim().min(3).max(3000), category: z.enum(['MISSING_SUBJECT', 'MISSING_PYQ', 'BETTER_NOTES', 'INCORRECT_INFORMATION', 'FEATURE', 'RESOURCE_REQUEST', 'OTHER']) })
export const reportSchema = z.object({ reason: z.enum(['INCORRECT_FILE', 'WRONG_SUBJECT', 'WRONG_SEMESTER', 'DUPLICATE', 'POOR_QUALITY', 'COPYRIGHT_CONCERN', 'OTHER']), details: z.string().trim().max(1000).default('') })
// General status update (OPEN → INVESTIGATING only via this schema; terminal states require dedicated endpoints)
export const communityStatusSchema = z.object({ status: z.enum(['OPEN', 'INVESTIGATING', 'ACCEPTED', 'REJECTED', 'COMPLETED', 'RESOLVED', 'DISMISSED']).optional(), reply: z.string().trim().max(2000).default('') })
// Explicit resolve — requires a note (optional but strongly recommended)
export const resolveReportSchema = z.object({ note: z.string().trim().max(2000).default('') })
// Explicit dismiss — requires a reason (mandatory)
export const dismissReportSchema = z.object({ reason: z.string().trim().min(3, 'Dismissal reason must be at least 3 characters').max(2000) })
export { objectId }
