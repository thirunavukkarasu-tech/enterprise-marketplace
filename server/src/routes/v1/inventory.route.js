import { Router } from 'express';
import { inventoryController } from '../../controllers/inventory.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { listInventoryQuerySchema, inventoryHistoryQuerySchema, adjustInventorySchema } from '../../validators/inventory.validator.js';

const router = Router();

// Vendor sees only their own inventory (forced server-side in the
// service, same pattern as productService.listManaged); admin may
// filter by ?vendor= or see everything. Same reasoning as every other
// vendor/admin-shared resource in this app.
router.use(requireAuth, requireRole(ROLES.VENDOR, ROLES.SUPER_ADMIN));

router.get('/', validate(listInventoryQuerySchema), asyncHandler(inventoryController.list));
router.get('/:productId/history', validate(inventoryHistoryQuerySchema), asyncHandler(inventoryController.history));
router.patch('/:productId/adjust', validate(adjustInventorySchema), asyncHandler(inventoryController.adjust));

export default router;
