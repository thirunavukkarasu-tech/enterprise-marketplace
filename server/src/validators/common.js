import { z } from 'zod';
import mongoose from 'mongoose';

/** Validates a string is a well-formed Mongo ObjectId — catches malformed
 * IDs at the validation layer instead of letting them reach Mongoose as a
 * CastError (which the centralized error handler turns into a 400 anyway,
 * but with a less specific message). */
export const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid id format',
});

/** Shared pagination query shape — every list endpoint in the app uses
 * the same page/limit contract so the frontend doesn't need per-domain
 * pagination logic. */
export const paginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(12),
});
