import { z } from 'zod';
import { ALL_ORDER_STATUSES } from '../constants/order.js';
import { ALL_SHIPPING_METHODS } from '../constants/shipping.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

/**
 * Checkout → order creation reuses the exact same shape Phase 6's
 * `checkoutReviewSchema` defined — the request that turns a reviewed
 * cart into a real order carries the same three fields, because it's
 * fundamentally the same input re-validated one more time at the moment
 * of commitment, not a different operation with different parameters.
 */
export const createOrderSchema = z.object({
  body: z.object({
    shippingAddressId: mongoId,
    billingAddressId: mongoId.optional(),
    shippingMethod: z.enum(ALL_SHIPPING_METHODS).optional().default('standard'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const orderIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

/**
 * `groupId` is required for admin/vendor callers when an order spans
 * more than one vendor group, but a vendor's own single group is found
 * automatically by `orderService.updateStatus` without it — so it's
 * optional here and the service decides whether it was actually needed.
 */
export const updateOrderStatusSchema = z.object({
  body: z.object({
    status: z.enum(ALL_ORDER_STATUSES),
    groupId: mongoId.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

const paginationQuery = {
  page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
  limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
};

export const listOwnOrdersQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({ ...paginationQuery }),
});

export const listAdminOrdersQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    status: z.enum(ALL_ORDER_STATUSES).optional(),
    customer: mongoId.optional(),
    vendor: mongoId.optional(),
    from: z.string().optional(),
    to: z.string().optional(),
    ...paginationQuery,
  }),
});
