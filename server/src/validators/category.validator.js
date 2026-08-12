import { z } from 'zod';
import { objectIdSchema, paginationQuerySchema } from './common.js';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100),
    description: z.string().trim().max(500).optional().default(''),
    parent: objectIdSchema.nullable().optional().default(null),
    image: z
      .object({ url: z.string().url(), alt: z.string().max(200).optional().default('') })
      .optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateCategorySchema = z.object({
  body: z
    .object({
      name: z.string().trim().min(2).max(100),
      description: z.string().trim().max(500),
      parent: objectIdSchema.nullable(),
      image: z.object({ url: z.string().url(), alt: z.string().max(200).optional().default('') }),
      isActive: z.boolean(),
    })
    .partial()
    .refine((body) => Object.keys(body).length > 0, { message: 'At least one field must be provided' }),
  params: z.object({ id: objectIdSchema }),
  query: z.object({}).optional(),
});

export const categoryIdParamSchema = z.object({
  params: z.object({ id: objectIdSchema }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});

export const listCategoriesQuerySchema = z.object({
  query: z.object({
    tree: z.coerce.boolean().optional().default(false),
    includeInactive: z.coerce.boolean().optional().default(false),
  }),
  body: z.object({}).optional(),
  params: z.object({}).optional(),
});

export { paginationQuerySchema };
