import { z } from 'zod';

/**
 * Fields any authenticated account may update about themselves. Mirrors
 * the pattern established for vendors in Phase 4 (createVendorSchema /
 * updateVendorSchema): role, email, isActive, isEmailVerified, and every
 * password/token field are simply absent here, not present-but-rejected
 * — there is no schema path that could let one through via a later,
 * more permissive merge. Email is intentionally excluded too: changing
 * it would need its own re-verification flow, which is out of scope for
 * this phase (see docs/ARCHITECTURE.md).
 */
export const updateOwnUserSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100).optional(),
    phone: z
      .string()
      .trim()
      .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Invalid phone number')
      .optional()
      .or(z.literal('').transform(() => undefined)),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
