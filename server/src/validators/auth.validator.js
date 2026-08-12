import { z } from 'zod';
import { PUBLIC_REGISTERABLE_ROLES } from '../constants/roles.js';

// Reused across register + reset-password: at least one letter and one
// number, minimum 8 characters. Deliberately not requiring a symbol —
// that pushes real users toward "Password1!" patterns without adding much
// entropy; length + mixed character classes is the better trade-off.
const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Za-z]/, 'Password must contain at least one letter')
  .regex(/[0-9]/, 'Password must contain at least one number');

export const registerSchema = z.object({
  body: z.object({
    name: z.string().trim().min(2, 'Name must be at least 2 characters').max(100),
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: passwordSchema,
    role: z.enum(PUBLIC_REGISTERABLE_ROLES, {
      errorMap: () => ({ message: `Role must be one of: ${PUBLIC_REGISTERABLE_ROLES.join(', ')}` }),
    }),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const loginSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
    password: z.string().min(1, 'Password is required'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const forgotPasswordSchema = z.object({
  body: z.object({
    email: z.string().trim().toLowerCase().email('Invalid email address'),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const resetPasswordSchema = z.object({
  body: z.object({
    token: z.string().min(20, 'Invalid reset token'),
    newPassword: passwordSchema,
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const verifyEmailSchema = z.object({
  params: z.object({
    token: z.string().min(20, 'Invalid verification token'),
  }),
  body: z.object({}).optional(),
  query: z.object({}).optional(),
});
