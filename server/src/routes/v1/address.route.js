import { Router } from 'express';
import { addressController } from '../../controllers/address.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { createAddressSchema, updateAddressSchema, addressIdParamSchema } from '../../validators/address.validator.js';

const router = Router();

router.use(requireAuth, requireRole(ROLES.CUSTOMER));

router.get('/', asyncHandler(addressController.list));
router.post('/', validate(createAddressSchema), asyncHandler(addressController.create));
router.get('/:id', validate(addressIdParamSchema), asyncHandler(addressController.getOne));
router.patch('/:id', validate(updateAddressSchema), asyncHandler(addressController.update));
router.delete('/:id', validate(addressIdParamSchema), asyncHandler(addressController.remove));
router.patch('/:id/default-shipping', validate(addressIdParamSchema), asyncHandler(addressController.setDefaultShipping));
router.patch('/:id/default-billing', validate(addressIdParamSchema), asyncHandler(addressController.setDefaultBilling));

export default router;
