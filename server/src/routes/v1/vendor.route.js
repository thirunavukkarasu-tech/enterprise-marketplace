import { Router } from 'express';
import { vendorController } from '../../controllers/vendor.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import {
  createVendorSchema,
  updateVendorSchema,
  rejectVendorSchema,
  suspendVendorSchema,
  vendorIdParamSchema,
  listVendorsQuerySchema,
  setVendorVerificationSchema,
} from '../../validators/vendor.validator.js';

const router = Router();

// ── self-service (vendor role only) ───────────────────────────────────
// Registered before the '/:id' admin routes below — Express matches
// routes in registration order, and '/me' would otherwise be swallowed
// by '/:id' if that were declared first.
router.post(
  '/me',
  requireAuth,
  requireRole(ROLES.VENDOR),
  validate(createVendorSchema),
  asyncHandler(vendorController.createOwnProfile)
);
router.get('/me', requireAuth, requireRole(ROLES.VENDOR), asyncHandler(vendorController.getOwnProfile));
router.patch(
  '/me',
  requireAuth,
  requireRole(ROLES.VENDOR),
  validate(updateVendorSchema),
  asyncHandler(vendorController.updateOwnProfile)
);
router.get('/me/dashboard', requireAuth, requireRole(ROLES.VENDOR), asyncHandler(vendorController.getOwnDashboard));

// A vendor's own products are already served correctly by the existing
// Phase 3 endpoint (GET /products/manage — vendor scope is forced
// server-side there). No second, parallel "vendor products" endpoint is
// added here — that would be a duplicate ownership mechanism, which the
// project explicitly avoids (see docs/ARCHITECTURE.md §2).

// ── admin management ─────────────────────────────────────────────────
router.get(
  '/',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(listVendorsQuerySchema),
  asyncHandler(vendorController.listAll)
);
router.get(
  '/:id',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(vendorIdParamSchema),
  asyncHandler(vendorController.getById)
);
router.patch(
  '/:id/approve',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(vendorIdParamSchema),
  asyncHandler(vendorController.approve)
);
router.patch(
  '/:id/reject',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(rejectVendorSchema),
  asyncHandler(vendorController.reject)
);
router.patch(
  '/:id/suspend',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(suspendVendorSchema),
  asyncHandler(vendorController.suspend)
);
router.patch(
  '/:id/reactivate',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(vendorIdParamSchema),
  asyncHandler(vendorController.reactivate)
);
router.patch(
  '/:id/verify',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(setVendorVerificationSchema),
  asyncHandler(vendorController.setVerification)
);

export default router;
