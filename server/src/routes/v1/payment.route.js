import { Router } from 'express';
import { paymentController } from '../../controllers/payment.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import {
  initiatePaymentSchema,
  verifyPaymentSchema,
  paymentIdParamSchema,
  paymentWebhookSchema,
} from '../../validators/payment.validator.js';

const router = Router();

/**
 * The webhook route is mounted first and deliberately sits outside
 * `requireAuth` — a payment provider's server calls this, not a
 * logged-in customer, and it can't attach a customer's bearer token.
 * Its authenticity check is provider-specific (e.g. a signature header
 * a real provider signs with a shared secret); with only the mock
 * provider configured (see docs/SECURITY.md), there is no real signature
 * to verify, so none is faked here — this is the extension point a real
 * provider integration would add signature verification to, not a gap
 * papered over with a fake check. Idempotency is handled independently
 * of authenticity, in paymentService.processWebhookEvent, via the unique
 * index on PaymentWebhookEvent.eventId.
 */
router.post('/webhook', validate(paymentWebhookSchema), asyncHandler(paymentController.webhook));

// Every other payment route is customer-facing and ownership-scoped —
// `paymentService` resolves everything from `req.user.id`, never a
// user id supplied by the client, the same IDOR-prevention pattern
// used throughout the app since Phase 4.
router.use(requireAuth, requireRole(ROLES.CUSTOMER));

router.post('/', validate(initiatePaymentSchema), asyncHandler(paymentController.initiate));
router.get('/:id', validate(paymentIdParamSchema), asyncHandler(paymentController.getOwn));
router.post('/:id/verify', validate(verifyPaymentSchema), asyncHandler(paymentController.verify));

export default router;
