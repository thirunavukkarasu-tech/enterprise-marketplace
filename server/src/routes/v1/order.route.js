import { Router } from 'express';
import { orderController } from '../../controllers/order.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import {
  createOrderSchema,
  orderIdParamSchema,
  updateOrderStatusSchema,
  listOwnOrdersQuerySchema,
  listAdminOrdersQuerySchema,
} from '../../validators/order.validator.js';

const router = Router();

router.use(requireAuth);

// ── customer: place an order, view own history ──────────────────────────
router.post('/', requireRole(ROLES.CUSTOMER), validate(createOrderSchema), asyncHandler(orderController.createFromCart));
router.get('/', requireRole(ROLES.CUSTOMER), validate(listOwnOrdersQuerySchema), asyncHandler(orderController.listOwn));

// ── managed: vendor scoped to their own orders, admin sees everything ──
// Same `/manage` convention Phase 3 established for products — one
// route, the service branches scope from req.user.role, rather than
// separate /vendor/orders and /admin/orders route trees. The admin
// query schema is a strict superset of the vendor one (customer/vendor
// filters an admin can use that a vendor request simply won't send,
// since only an admin needs to filter across sellers) — status and
// date-range filtering are genuinely shared and both services support
// them. Zod strips unrecognized keys regardless, and
// orderService.listForVendor never reads customer/vendor even if a
// vendor sent them.
router.get(
  '/manage',
  requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(listAdminOrdersQuerySchema),
  asyncHandler(orderController.listManaged)
);
router.get(
  '/manage/:id',
  requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(orderIdParamSchema),
  asyncHandler(orderController.getManagedById)
);

// ── shared status transition, per the phase brief's specified path ─────
router.patch(
  '/:id/status',
  requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN),
  validate(updateOrderStatusSchema),
  asyncHandler(orderController.updateStatus)
);

// Customer's own single-order lookup — registered after /manage and
// /:id/status so those more specific paths aren't shadowed by this
// catch-all-looking /:id (Express matches by exact path shape, but
// keeping the specific routes visually first avoids any doubt reading
// this file top to bottom).
router.get('/:id', requireRole(ROLES.CUSTOMER), validate(orderIdParamSchema), asyncHandler(orderController.getOwn));

export default router;
