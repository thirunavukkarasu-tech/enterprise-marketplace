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
  productIdParamSchema,
  addVariantSchema,
  updateVariantSchema,
  variantParamsSchema,
  listPublicProductsQuerySchema,
  listManagedProductsQuerySchema,
} from '../../validators/product.validator.js';

const router = Router();

const vendorOrAdmin = requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN);

// ── Vendor / admin management — registered before the public "/:slug"
// route so "/manage" is never swallowed as a slug value. ────────────────
router.get(
  '/manage',
  requireAuth,
  vendorOrAdmin,
  validate(listManagedProductsQuerySchema),
  asyncHandler(productController.listManaged)
);

router.get(
  '/manage/:id',
  requireAuth,
  vendorOrAdmin,
  validate(productIdParamSchema),
  asyncHandler(productController.getManagedById)
);

router.post(
  '/manage',
  requireAuth,
  requireRole(ROLES.VENDOR), // admins moderate existing listings; they don't create products on a vendor's behalf
  validate(createProductSchema),
  asyncHandler(productController.create)
);

router.patch(
  '/manage/:id',
  requireAuth,
  vendorOrAdmin,
  validate(updateProductSchema),
  asyncHandler(productController.update)
);

router.delete(
  '/manage/:id',
  requireAuth,
  vendorOrAdmin,
  validate(productIdParamSchema),
  asyncHandler(productController.remove)
);

// Variant/SKU management — vendor-owned pricing and stock, not an admin
// moderation action, so scoped to the vendor role (ownership against the
// specific product is still enforced in productService either way).
router.post(
  '/manage/:id/variants',
  requireAuth,
  requireRole(ROLES.VENDOR),
  validate(addVariantSchema),
  asyncHandler(productController.addVariant)
);

router.patch(
  '/manage/:id/variants/:variantId',
  requireAuth,
  requireRole(ROLES.VENDOR),
  validate(updateVariantSchema),
  asyncHandler(productController.updateVariant)
);

router.delete(
  '/manage/:id/variants/:variantId',
  requireAuth,
  requireRole(ROLES.VENDOR),
  validate(variantParamsSchema),
  asyncHandler(productController.removeVariant)
);

// ── Public storefront ────────────────────────────────────────────────────
router.get('/', validate(listPublicProductsQuerySchema), asyncHandler(productController.listPublic));
router.get('/:slug', asyncHandler(productController.getPublicBySlug));

export default router;
