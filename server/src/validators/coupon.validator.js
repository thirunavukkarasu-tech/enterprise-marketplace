import { z } from 'zod';
import { ALL_DISCOUNT_TYPES, MAX_PERCENTAGE_DISCOUNT_VALUE, DISCOUNT_TYPE } from '../constants/coupon.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const couponBodySchema = z.object({
  code: z.string().trim().min(3).max(30),
  description: z.string().trim().max(500).optional(),
  discountType: z.enum(ALL_DISCOUNT_TYPES),
  discountValue: z.coerce.number().positive('Discount value must be greater than 0'),
  maxDiscountAmount: z.coerce.number().positive().optional().nullable(),
  minOrderValue: z.coerce.number().min(0).optional().default(0),
  startsAt: z.coerce.date().optional().nullable(),
  expiresAt: z.coerce.date().optional().nullable(),
  usageLimit: z.coerce.number().int().positive().optional().nullable(),
  perUserLimit: z.coerce.number().int().positive().optional().nullable(),
});

/**
 * Applied after `.partial()` where needed, not chained directly onto
 * `couponBodySchema` — `.refine()` returns a ZodEffects wrapper, which
 * has no `.partial()` method. Calling `.partial()` first (on the plain
 * object) and refining after works for both the full (create) and
 * partial (update) shapes.
 *
 * The percentage-bound check tolerates `discountValue` being absent
 * (`== null`) rather than requiring it: on a partial update that changes
 * `discountType` to `percentage` without resending `discountValue`,
 * there's nothing here to validate against yet — the stored value is
 * left as whatever passed this same check when it was first set. On
 * `create`, `discountValue` is always required by the schema, so this
 * leniency never actually applies there.
 */
function withCouponRefinements(schema) {
  return schema
    .refine(
      (data) =>
        data.discountType !== DISCOUNT_TYPE.PERCENTAGE ||
        data.discountValue == null ||
        data.discountValue <= MAX_PERCENTAGE_DISCOUNT_VALUE,
      { message: `Percentage discount cannot exceed ${MAX_PERCENTAGE_DISCOUNT_VALUE}`, path: ['discountValue'] }
    )
    .refine((data) => !data.startsAt || !data.expiresAt || data.startsAt < data.expiresAt, {
      message: 'startsAt must be before expiresAt',
      path: ['expiresAt'],
    });
}

export const createCouponSchema = z.object({
  body: withCouponRefinements(couponBodySchema),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateCouponSchema = z.object({
  body: withCouponRefinements(couponBodySchema.partial()),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const setCouponStatusSchema = z.object({
  body: z.object({ isActive: z.boolean() }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const couponIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const listCouponsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().max(50).optional(),
    isActive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    page: z.coerce.number().int().min(1).optional().default(1),
    limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  }),
});

export const applyCouponSchema = z.object({
  body: z.object({
    code: z.string().trim().min(3).max(30),
    shippingMethod: z.enum(['standard', 'express']).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
