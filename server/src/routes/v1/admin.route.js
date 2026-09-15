import { Router } from 'express';
import { adminDashboardController } from '../../controllers/adminDashboard.controller.js';
import { adminCustomerController } from '../../controllers/adminCustomer.controller.js';
import { couponController } from '../../controllers/coupon.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { listCustomersQuerySchema, customerIdParamSchema } from '../../validators/adminCustomer.validator.js';
import {
  createCouponSchema,
  updateCouponSchema,
  setCouponStatusSchema,
  couponIdParamSchema,
  listCouponsQuerySchema,
} from '../../validators/coupon.validator.js';

const router = Router();

// Every route here is platform-wide, cross-vendor, cross-customer data —
// admin-only, no vendor-scoped variant exists or should exist for any of
// these (contrast with /products/manage, /orders/manage, /inventory,
// which are intentionally shared between vendor and admin).
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/dashboard/overview', asyncHandler(adminDashboardController.getOverview));

router.get('/customers', validate(listCustomersQuerySchema), asyncHandler(adminCustomerController.list));
router.get('/customers/:id', validate(customerIdParamSchema), asyncHandler(adminCustomerController.getOne));

router.get('/coupons', validate(listCouponsQuerySchema), asyncHandler(couponController.list));
router.post('/coupons', validate(createCouponSchema), asyncHandler(couponController.create));
router.get('/coupons/:id', validate(couponIdParamSchema), asyncHandler(couponController.getById));
router.patch('/coupons/:id', validate(updateCouponSchema), asyncHandler(couponController.update));
router.patch('/coupons/:id/status', validate(setCouponStatusSchema), asyncHandler(couponController.setStatus));
router.delete('/coupons/:id', validate(couponIdParamSchema), asyncHandler(couponController.remove));

export default router;
