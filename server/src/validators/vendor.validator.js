import { z } from 'zod';
import { ALL_VENDOR_STATUSES } from '../constants/roles.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

const addressSchema = z.object({
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  country: z.string().trim().min(1, 'Country is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
});

const mediaRefSchema = z.object({
  url: z.string().url('Must be a valid URL'),
  alt: z.string().max(150).optional(),
});

const businessEmailSchema = z.string().trim().toLowerCase().email('Invalid business email address');
const businessPhoneSchema = z
  .string()
  .trim()
  .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Invalid business phone number');

/**
 * Fields a vendor may set on onboarding/self-update. Deliberately does
 * NOT include status, isVerified, reviewedBy/At, rejectionReason,
 * suspensionReason, or user — those are admin/system-controlled and are
 * simply absent here rather than present-but-rejected, so there's no
 * schema path that could accidentally let one through via a permissive
 * merge later (see docs/SECURITY.md §3 for the corresponding service-side
 * whitelist).
 */
export const createVendorSchema = z.object({
  body: z.object({
    storeName: z.string().trim().min(2, 'Store name must be at least 2 characters').max(150),
    legalBusinessName: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    businessEmail: businessEmailSchema,
    businessPhone: businessPhoneSchema,
    address: addressSchema,
    taxId: z.string().trim().max(50).optional(),
    logo: mediaRefSchema.optional(),
    banner: mediaRefSchema.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateVendorSchema = z.object({
  body: z.object({
    storeName: z.string().trim().min(2).max(150).optional(),
    legalBusinessName: z.string().trim().max(200).optional(),
    description: z.string().trim().max(2000).optional(),
    businessEmail: businessEmailSchema.optional(),
    businessPhone: businessPhoneSchema.optional(),
    address: addressSchema.optional(),
    taxId: z.string().trim().max(50).optional(),
    logo: mediaRefSchema.optional(),
    banner: mediaRefSchema.optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const rejectVendorSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(10, 'A meaningful rejection reason is required (10+ characters)').max(500),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const suspendVendorSchema = z.object({
  body: z.object({
    reason: z.string().trim().min(10, 'Reason must be at least 10 characters').max(500).optional(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const vendorIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

/**
 * Verification is deliberately independent of the approve/reject/suspend
 * status machine (see the model comment on `isVerified`) — an admin can
 * mark a vendor's business documents as checked without that being tied
 * to whether the store is currently allowed to sell.
 */
export const setVendorVerificationSchema = z.object({
  body: z.object({
    isVerified: z.boolean(),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const listVendorsQuerySchema = z.object({
  body: z.object({}).optional(),
  params: z.object({}).optional(),
  query: z.object({
    q: z.string().trim().max(200).optional(),
    status: z.enum(ALL_VENDOR_STATUSES).optional(),
    isVerified: z
      .enum(['true', 'false'])
      .optional()
      .transform((v) => (v === undefined ? undefined : v === 'true')),
    sort: z.enum(['newest', 'oldest', 'name_asc', 'name_desc']).optional(),
    page: z.coerce.number().int().min(1).optional().default(PAGINATION_DEFAULTS.PAGE),
    limit: z.coerce.number().int().min(1).max(PAGINATION_DEFAULTS.MAX_LIMIT).optional().default(PAGINATION_DEFAULTS.LIMIT),
  }),
});
