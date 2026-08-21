import { z } from 'zod';
import { ALL_SHIPPING_METHODS, SHIPPING_METHOD } from '../constants/shipping.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid address id');

export const checkoutReviewSchema = z.object({
  body: z.object({
    shippingAddressId: mongoId,
    billingAddressId: mongoId.optional(),
    shippingMethod: z.enum(ALL_SHIPPING_METHODS).optional().default(SHIPPING_METHOD.STANDARD),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
