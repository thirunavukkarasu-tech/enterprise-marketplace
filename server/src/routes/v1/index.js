import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import categoryRoute from './category.route.js';
import productRoute from './product.route.js';
import vendorRoute from './vendor.route.js';

const router = Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/categories', categoryRoute);
router.use('/products', productRoute);
router.use('/vendors', vendorRoute);

/**
 * Phase-by-phase route registration happens here, e.g.:
 *   router.use('/orders', orderRoute);       // Phase 7
 * Keeping this file as the single mount point means app.js never needs to
 * change as new domains are added.
 */

export default router;
