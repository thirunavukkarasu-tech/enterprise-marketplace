import { Router } from 'express';
import { auditController } from '../../controllers/audit.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireRole } from '../../middleware/rbac.js';
import { ROLES } from '../../constants/roles.js';
import { listAuditLogsQuerySchema } from '../../validators/audit.validator.js';

const router = Router();

// Admin-only — the operational activity trail is not a vendor-facing
// feature (a vendor doesn't get to see platform-wide admin actions,
// even ones affecting other vendors).
router.use(requireAuth, requireRole(ROLES.SUPER_ADMIN));

router.get('/', validate(listAuditLogsQuerySchema), asyncHandler(auditController.list));

export default router;
