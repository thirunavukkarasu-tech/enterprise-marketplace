import { Router } from 'express';
import { categoryController } from '../../controllers/category.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import {
  createCategorySchema,
  updateCategorySchema,
  categoryIdParamSchema,
} from '../../validators/category.validator.js';

const router = Router();

// ── public ───────────────────────────────────────────────────────────────
router.get('/', asyncHandler(categoryController.list));
router.get('/:id', validate(categoryIdParamSchema), asyncHandler(categoryController.getById));

// ── admin only ───────────────────────────────────────────────────────────
router.get(
  '/manage/all',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  asyncHandler(categoryController.listManaged)
);
router.post(
  '/',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(createCategorySchema),
  asyncHandler(categoryController.create)
);
router.patch(
  '/:id',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(updateCategorySchema),
  asyncHandler(categoryController.update)
);
router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.SUPER_ADMIN),
  validate(categoryIdParamSchema),
  asyncHandler(categoryController.remove)
);

export default router;
