import { Router } from 'express';
import { userController } from '../../controllers/user.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { updateOwnUserSchema } from '../../validators/user.validator.js';

const router = Router();

// Reading the current user already exists at GET /auth/me (Phase 2) —
// not duplicated here. This route only adds the missing write side:
// updating your own name/phone. No route here (or anywhere in the app)
// takes a user id from the client — same IDOR-by-construction pattern
// Phase 4 established for vendor self-service.
router.patch('/me', requireAuth, validate(updateOwnUserSchema), asyncHandler(userController.updateOwnProfile));

export default router;
