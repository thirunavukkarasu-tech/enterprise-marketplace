import { z } from 'zod';
import { AUDIT_ACTION } from '../constants/audit.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const listAuditLogsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    actor: mongoId.optional(),
    action: z.enum(Object.values(AUDIT_ACTION)).optional(),
    entityType: z.string().trim().max(50).optional(),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});
