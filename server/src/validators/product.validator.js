import { z } from 'zod';
import { objectIdSchema } from './common.js';
import { PRODUCT_SORT_OPTIONS, ALL_PRODUCT_STATUSES } from '../constants/product.js';

const variantInputSchema = z.object({
  sku: z.string().trim().min(2, 'SKU must be at least 2 characters').max(40),
  attributes: z.record(z.string(), z.string()).optional().default({}),
  price: z.coerce.number().min(0, 'Price cannot be negative'),
  compareAtPrice: z.coerce.number().min(0).nullable().optional(),
  stock: z.coerce.number().int().min(0, 'Stock cannot be negative').default(0),
  isActive: z.boolean().optional().default(true),
});

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(3).max(150),
    description: z.string().trim().max(5000).optional().default(''),
    category: objectIdSchema,
    images: z
      .array(z.object({ url: z.string().url(), alt: z.string().max(200).optional().default('') }))
      .optional()
      .default([]),
    variants: z.array(variantInputSchema).min(1, 'At least one variant is required'),
    status: z.enum(ALL_PRODUCT_STATUSES).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProductSchema = z.object({
  body: z
    .object({
      title: z.string().trim().min(3).max(150),
      description: z.string().trim().max(5000),
      category: objectIdSchema,
      images: z.array(z.object({ url: z.string().url(), alt: z.string().max(200).optional().default('') })),
      status: z.enum(ALL_PRODUCT_STATUSES),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: objectIdSchema }),
  query: z.object({}).optional(),
});

export const productIdParamSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const addVariantSchema = z.object({
  body: variantInputSchema,
  params: z.object({ id: objectIdSchema }),
  query: z.object({}).optional(),
});

export const updateVariantSchema = z.object({
  body: variantInputSchema.partial().refine((body) => Object.keys(body).length > 0, {
    message: 'At least one field must be provided',
  }),
  params: z.object({ id: objectIdSchema, variantId: objectIdSchema }),
  query: z.object({}).optional(),
});

export const variantParamsSchema = z.object({
  params: z.object({ id: objectIdSchema, variantId: objectIdSchema }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

// ── Listing / search query params ──────────────────────────────────────
const sortValues = Object.values(PRODUCT_SORT_OPTIONS);

export const listPublicProductsQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().max(150).optional(),
    category: objectIdSchema.optional(),
    minPrice: z.coerce.number().min(0).optional(),
    maxPrice: z.coerce.number().min(0).optional(),
    sort: z.enum(sortValues).optional().default(PRODUCT_SORT_OPTIONS.NEWEST),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(20),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const listManagedProductsQuerySchema = z.object({
  query: z.object({
    q: z.string().trim().max(150).optional(),
    category: objectIdSchema.optional(),
    vendor: objectIdSchema.optional(), // admin-only filter; ignored/overridden for vendors
    status: z.enum(ALL_PRODUCT_STATUSES).optional(),
    sort: z.enum(sortValues).optional().default(PRODUCT_SORT_OPTIONS.NEWEST),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(60).default(20),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});
