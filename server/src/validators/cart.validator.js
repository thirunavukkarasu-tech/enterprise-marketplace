import { z } from 'zod';
import { MAX_CART_ITEM_QUANTITY } from '../constants/cart.js';
import { ALL_SHIPPING_METHODS } from '../constants/shipping.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');
const quantity = z.coerce
  .number()
  .int()
  .min(1, 'Quantity must be at least 1')
  .max(MAX_CART_ITEM_QUANTITY, `Quantity cannot exceed ${MAX_CART_ITEM_QUANTITY}`);

export const addCartItemSchema = z.object({
  body: z.object({
    productId: mongoId,
    sku: z.string().trim().min(1, 'SKU is required').max(50),
    quantity: quantity.default(1),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateCartItemSchema = z.object({
  body: z.object({
    quantity,
  }),
  query: z.object({}).optional(),
  params: z.object({ itemId: mongoId }),
});

export const cartItemParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ itemId: mongoId }),
});

export const getCartQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    shippingMethod: z.enum(ALL_SHIPPING_METHODS).optional(),
  }),
});
