import { Router } from 'express';
import { cartController } from '../../controllers/cart.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { addCartItemSchema, updateCartItemSchema, cartItemParamSchema, getCartQuerySchema } from '../../validators/cart.validator.js';
import { applyCouponSchema } from '../../validators/coupon.validator.js';

const router = Router();

// Cart is a customer-facing feature — restricted to the customer role
// specifically, the same reasoning as Phase 5's wishlist. Every route is
// scoped to req.user.id server-side; none ever takes a user id from the
// client, so there is no request shape that could return or modify
// another customer's cart.
router.use(requireAuth, requireRole(ROLES.CUSTOMER));

router.get('/', validate(getCartQuerySchema), asyncHandler(cartController.getOwn));
router.post('/items', validate(addCartItemSchema), asyncHandler(cartController.addItem));
router.patch('/items/:itemId', validate(updateCartItemSchema), asyncHandler(cartController.updateItem));
router.delete('/items/:itemId', validate(cartItemParamSchema), asyncHandler(cartController.removeItem));
router.delete('/', asyncHandler(cartController.clear));

// Coupon state lives on the Cart document (Cart.couponCode) — see
// cartService.js — so these live under /cart rather than /checkout,
// even though an earlier planning note considered /checkout/apply-coupon.
// Reuses coupon.validator's applyCouponSchema (it also accepts an
// optional shippingMethod field meant for a different caller; harmless
// and unused here, not worth a second near-identical schema).
router.post('/coupon', validate(applyCouponSchema), asyncHandler(cartController.applyCoupon));
router.delete('/coupon', asyncHandler(cartController.removeCoupon));

export default router;
