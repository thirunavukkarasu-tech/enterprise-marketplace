import { z } from 'zod';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const listCustomersQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().max(200).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});

export const customerIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});
