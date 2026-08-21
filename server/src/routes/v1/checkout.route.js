import { Router } from 'express';
import { checkoutController } from '../../controllers/checkout.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { checkoutReviewSchema } from '../../validators/checkout.validator.js';

const router = Router();

// Same reasoning as cart/wishlist/address: customer-only, always scoped
// to req.user.id server-side.
router.use(requireAuth, requireRole(ROLES.CUSTOMER));

/**
 * A single review endpoint, deliberately not a multi-step stateful
 * checkout session on the server — the frontend's multi-step UI
 * (contact → address → delivery → review) is presentation, not separate
 * API state. Every step's data (which address, which shipping method)
 * is passed in one request here; the server has nothing to lose track of
 * between steps because it never held partial checkout state to begin
 * with. This intentionally returns a summary, never creates anything —
 * see docs/ARCHITECTURE.md for the Phase 7 order-creation boundary this
 * stops at.
 */
router.post('/review', validate(checkoutReviewSchema), asyncHandler(checkoutController.review));

export default router;
