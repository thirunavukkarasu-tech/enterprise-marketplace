import { Router } from 'express';
import { productController } from '../../controllers/product.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import {
  createProductSchema,
  updateProductSchema,
  updateProductStatusSchema,
  productIdParamSchema,
  addVariantSchema,
  updateVariantSchema,
  variantParamSchema,
  listPublicProductsQuerySchema,
  listManagedProductsQuerySchema,
  productSlugParamSchema,
} from '../../validators/product.validator.js';

const router = Router();

const canManage = requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN);

// ── public storefront ──────────────────────────────────────────────────
// Registered before /manage and /:id-shaped managed routes so a slug like
// "manage" could never be ambiguous — but note the managed routes below
// all live under the distinct /manage prefix specifically to avoid any
// collision with public slug lookups.
router.get('/', validate(listPublicProductsQuerySchema), asyncHandler(productController.listPublic));
router.get('/slug/:slug', validate(productSlugParamSchema), asyncHandler(productController.getPublicBySlug));

// ── vendor / admin management ──────────────────────────────────────────
// Every route below requires auth + (vendor or super_admin) at the route
// level, AND an ownership check inside productService for anything that
// touches a specific product id — see docs/SECURITY.md §2.
router.get(
  '/manage',
  requireAuth,
  canManage,
  validate(listManagedProductsQuerySchema),
  asyncHandler(productController.listManaged)
);
router.get(
  '/manage/:id',
  requireAuth,
  canManage,
  validate(productIdParamSchema),
  asyncHandler(productController.getManagedById)
);
router.post('/manage', requireAuth, canManage, validate(createProductSchema), asyncHandler(productController.create));
router.patch(
  '/manage/:id',
  requireAuth,
  canManage,
  validate(updateProductSchema),
  asyncHandler(productController.update)
);
router.patch(
  '/manage/:id/status',
  requireAuth,
  canManage,
  validate(updateProductStatusSchema),
  asyncHandler(productController.updateStatus)
);
router.delete(
  '/manage/:id',
  requireAuth,
  canManage,
  validate(productIdParamSchema),
  asyncHandler(productController.remove)
);

router.post(
  '/manage/:id/variants',
  requireAuth,
  canManage,
  validate(addVariantSchema),
  asyncHandler(productController.addVariant)
);
router.patch(
  '/manage/:id/variants/:sku',
  requireAuth,
  canManage,
  validate(updateVariantSchema),
  asyncHandler(productController.updateVariant)
);
router.delete(
  '/manage/:id/variants/:sku',
  requireAuth,
  canManage,
  validate(variantParamSchema),
  asyncHandler(productController.removeVariant)
);

export default router;
