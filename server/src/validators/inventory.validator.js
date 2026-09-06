import { z } from 'zod';
import { STOCK_STATUS } from '../constants/inventory.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const listInventoryQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    vendor: mongoId.optional(), // admin-only filter — forced server-side for vendor callers
    stockStatus: z.enum(Object.values(STOCK_STATUS)).optional(),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});

export const inventoryHistoryQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({ productId: mongoId }),
  query: z.object({
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});

/**
 * `quantityChange` is signed and deliberately unbounded in magnitude —
 * the "can't go negative" rule is a property of the *resulting* stock,
 * checked in `inventoryService.adjust` against the live variant, not
 * something a static schema bound could express (it depends on current
 * stock, which the validator doesn't have access to).
 */
export const adjustInventorySchema = z.object({
  body: z.object({
    sku: z.string().trim().min(1, 'SKU is required').max(50),
    quantityChange: z.coerce.number().int().refine((v) => v !== 0, 'quantityChange cannot be zero'),
    reason: z.string().trim().min(3, 'A reason is required').max(500),
  }),
  query: z.object({}).optional(),
  params: z.object({ productId: mongoId }),
});
