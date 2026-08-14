import { z } from 'zod';
import { ALL_PRODUCT_STATUSES, ALL_PRODUCT_SORTS, PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const skuSchema = z
  .string()
  .trim()
  .min(1, 'SKU is required')
  .max(50)
  .regex(/^[A-Za-z0-9-]+$/, 'SKU may only contain letters, numbers, and hyphens');

const priceSchema = z.number().positive('Price must be greater than 0');
const stockSchema = z.number().int().min(0, 'Stock cannot be negative');

const variantSchema = z.object({
  sku: skuSchema,
  attributes: z.record(z.string(), z.string()).optional(),
  price: priceSchema,
  compareAtPrice: z.number().positive().optional(),
  stock: stockSchema.default(0),
});

const imageSchema = z.object({
  url: z.string().url('Image url must be a valid URL'),
  alt: z.string().max(150).optional(),
});

export const createProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2, 'Title must be at least 2 characters').max(200),
    description: z.string().trim().min(1, 'Description is required').max(5000),
    category: mongoId,
    images: z.array(imageSchema).max(10).optional(),
    variants: z.array(variantSchema).min(1, 'At least one variant is required'),
    // Only meaningful when a super_admin creates a product on a vendor's
    // behalf — ignored/overridden for vendor-authored requests (enforced
    // in productService, not here, since that's a role-dependent rule).
    vendor: mongoId.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateProductSchema = z.object({
  body: z.object({
    title: z.string().trim().min(2).max(200).optional(),
    description: z.string().trim().min(1).max(5000).optional(),
    category: mongoId.optional(),
    images: z.array(imageSchema).max(10).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const updateProductStatusSchema = z.object({
  body: z.object({
    status: z.enum(ALL_PRODUCT_STATUSES),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const productIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const addVariantSchema = z.object({
  body: variantSchema,
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const updateVariantSchema = z.object({
  body: z.object({
    attributes: z.record(z.string(), z.string()).optional(),
    price: priceSchema.optional(),
    compareAtPrice: z.number().positive().optional(),
    stock: stockSchema.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId, sku: skuSchema }),
});

export const variantParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId, sku: skuSchema }),
});

const coerceNumber = (message) => z.coerce.number({ invalid_type_error: message }).optional();

export const listPublicProductsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().max(200).optional(),
    category: mongoId.optional(),
    minPrice: coerceNumber('minPrice must be a number'),
    maxPrice: coerceNumber('maxPrice must be a number'),
    sort: z.enum(ALL_PRODUCT_SORTS).optional(),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});

export const listManagedProductsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().max(200).optional(),
    category: mongoId.optional(),
    minPrice: coerceNumber('minPrice must be a number'),
    maxPrice: coerceNumber('maxPrice must be a number'),
    status: z.enum(ALL_PRODUCT_STATUSES).optional(),
    // Only honored for super_admin — a vendor's own id is forced
    // server-side regardless of what's sent here (see productService).
    vendor: mongoId.optional(),
    sort: z.enum(ALL_PRODUCT_SORTS).optional(),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});

export const productSlugParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ slug: z.string().trim().min(1) }),
});
