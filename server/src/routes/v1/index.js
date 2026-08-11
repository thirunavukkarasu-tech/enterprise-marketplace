import { Router } from 'express';
import healthRoute from './health.route.js';

const router = Router();

router.use('/health', healthRoute);

/**
 * Phase-by-phase route registration happens here, e.g.:
 *   router.use('/auth', authRoute);          // Phase 2
 *   router.use('/products', productRoute);   // Phase 3
 *   router.use('/vendors', vendorRoute);     // Phase 4
 * Keeping this file as the single mount point means app.js never needs to
 * change as new domains are added.
 */

export default router;
