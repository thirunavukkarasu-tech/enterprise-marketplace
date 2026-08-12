import { Router } from 'express';
import { authController } from '../../controllers/auth.controller.js';
import { asyncHandler } from '../../utils/asyncHandler.js';
import { validate } from '../../middleware/validate.js';
import { requireAuth } from '../../middleware/auth.js';
import { authLimiter } from '../../middleware/rateLimiter.js';
import {
  registerSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  verifyEmailSchema,
} from '../../validators/auth.validator.js';

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), asyncHandler(authController.register));
router.post('/login', authLimiter, validate(loginSchema), asyncHandler(authController.login));

// Rate-limited too: refresh is a credential-bearing endpoint (the cookie
// is the credential) and is exactly the kind of route a reuse-detection
// bypass attempt would hammer.
router.post('/refresh', authLimiter, asyncHandler(authController.refresh));

router.post('/logout', asyncHandler(authController.logout));

router.post(
  '/forgot-password',
  authLimiter,
  validate(forgotPasswordSchema),
  asyncHandler(authController.forgotPassword)
);
router.post(
  '/reset-password',
  authLimiter,
  validate(resetPasswordSchema),
  asyncHandler(authController.resetPassword)
);

router.get('/verify-email/:token', validate(verifyEmailSchema), asyncHandler(authController.verifyEmail));

router.get('/me', requireAuth, asyncHandler(authController.me));

export default router;
