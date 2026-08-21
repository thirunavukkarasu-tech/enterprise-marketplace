import { Router } from 'express';
import healthRoute from './health.route.js';
import authRoute from './auth.route.js';
import categoryRoute from './category.route.js';
import productRoute from './product.route.js';
import vendorRoute from './vendor.route.js';
import userRoute from './user.route.js';
import wishlistRoute from './wishlist.route.js';
import cartRoute from './cart.route.js';
import addressRoute from './address.route.js';
import checkoutRoute from './checkout.route.js';

const router = Router();

router.use('/health', healthRoute);
router.use('/auth', authRoute);
router.use('/categories', categoryRoute);
router.use('/products', productRoute);
router.use('/vendors', vendorRoute);
router.use('/users', userRoute);
router.use('/wishlist', wishlistRoute);
router.use('/cart', cartRoute);
router.use('/addresses', addressRoute);
router.use('/checkout', checkoutRoute);

/**
 * Phase-by-phase route registration happens here, e.g.:
 *   router.use('/orders', orderRoute);       // Phase 7
 * Keeping this file as the single mount point means app.js never needs to
 * change as new domains are added.
 */

export default router;
