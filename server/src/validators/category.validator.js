import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const imageSchema = z.object({
  url: z.string().url('Image url must be a valid URL'),
  alt: z.string().max(150).optional(),
});

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    description: z.string().trim().max(500).optional(),
    parent: mongoId.nullable().optional(),
    image: imageSchema.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(2).max(100).optional(),
    description: z.string().trim().max(500).optional(),
    parent: mongoId.nullable().optional(),
    image: imageSchema.optional(),
    isActive: z.boolean().optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const categoryIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const listCategoriesQuerySchema = z.object({
  body: z.object({}).optional(),
  query: z.object({
    includeInactive: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => v === 'true'),
  }),
  params: z.object({}).optional(),
});
