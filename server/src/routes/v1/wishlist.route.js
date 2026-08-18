import { Router } from 'express';
import { wishlistController } from '../../controllers/wishlist.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { wishlistProductParamSchema } from '../../validators/wishlist.validator.js';

const router = Router();

// Wishlisting is a customer-facing feature — restricted to the customer
// role specifically (not "any authenticated user") to match how the rest
// of the app scopes role-flavored features (vendor's /vendors/me is
// vendor-only for the same reason). Every route here is scoped to
// req.user.id server-side; none ever takes a user id from the client —
// the same route-separation IDOR pattern Phase 4 established.
router.get('/', requireAuth, requireRole(ROLES.CUSTOMER), asyncHandler(wishlistController.getOwn));
router.post(
  '/:productId',
  requireAuth,
  requireRole(ROLES.CUSTOMER),
  validate(wishlistProductParamSchema),
  asyncHandler(wishlistController.add)
);
router.delete(
  '/:productId',
  requireAuth,
  requireRole(ROLES.CUSTOMER),
  validate(wishlistProductParamSchema),
  asyncHandler(wishlistController.remove)
);

export default router;
