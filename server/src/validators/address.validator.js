import { z } from 'zod';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid address id');

const addressFields = {
  label: z.enum(['home', 'work', 'other']).optional().default('home'),
  fullName: z.string().trim().min(2, 'At least 2 characters').max(150),
  phone: z
    .string()
    .trim()
    .regex(/^[+]?[0-9\s\-()]{7,20}$/, 'Enter a valid phone number'),
  line1: z.string().trim().min(1, 'Address line 1 is required').max(200),
  line2: z.string().trim().max(200).optional(),
  city: z.string().trim().min(1, 'City is required').max(100),
  state: z.string().trim().min(1, 'State is required').max(100),
  country: z.string().trim().min(1, 'Country is required').max(100),
  postalCode: z.string().trim().min(1, 'Postal code is required').max(20),
};

export const createAddressSchema = z.object({
  body: z.object(addressFields),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const updateAddressSchema = z.object({
  body: z.object(addressFields).partial(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

export const addressIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});
