import { z } from 'zod';
import { ALL_PAYMENT_METHODS } from '../constants/order.js';

const mongoId = z.string().regex(/^[0-9a-fA-F]{24}$/, 'Invalid id');

export const initiatePaymentSchema = z.object({
  body: z.object({
    orderId: mongoId,
    method: z.enum(ALL_PAYMENT_METHODS),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});

export const paymentIdParamSchema = z.object({
  body: z.object({}).optional(),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

/**
 * `simulate` is a mock-provider-only testing affordance (see
 * mockPaymentProvider.js) — a real integration's `verify` call takes no
 * body at all, since the outcome comes from asking the provider, never
 * from the client. Kept optional and defaulted so the schema still shapes
 * correctly the day this app points at a real provider and this field
 * stops being read.
 */
export const verifyPaymentSchema = z.object({
  body: z.object({
    simulate: z.enum(['success', 'failure']).optional().default('success'),
  }),
  query: z.object({}).optional(),
  params: z.object({ id: mongoId }),
});

/**
 * Deliberately permissive on `payload` (Mixed/passthrough) — a webhook
 * body's shape is entirely up to the provider sending it, and this
 * endpoint's job is to record + dedupe the envelope
 * (eventId/provider/type), not to police every field a real gateway
 * might include. The fields this app actually *acts on*
 * (`payload.transactionId`) are read defensively in the service, not
 * required here.
 */
export const paymentWebhookSchema = z.object({
  body: z.object({
    eventId: z.string().min(1),
    provider: z.string().min(1),
    type: z.string().min(1),
    payload: z.record(z.string(), z.unknown()).optional().default({}),
  }),
  query: z.object({}).optional(),
  params: z.object({}).optional(),
});
