import 'dotenv/config';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { env } from '../src/config/env.js';
import { logger } from '../src/config/logger.js';
import { User } from '../src/models/User.model.js';
import { ROLES } from '../src/constants/roles.js';

/**
 * Idempotent demo-user seed: upserts one account per role with a fixed,
 * documented password so recruiters/interviewers can log in immediately
 * without a real registration flow. NEVER use this pattern (fixed,
 * published passwords) for anything beyond local demo data — see the
 * warning printed at the end of this script.
 */
const DEMO_USERS = [
  { name: 'Ava Sharma', email: 'admin@marketsphere.dev', password: 'Admin@12345', role: ROLES.SUPER_ADMIN },
  { name: 'Rohan Mehta', email: 'vendor@marketsphere.dev', password: 'Vendor@12345', role: ROLES.VENDOR },
  { name: 'Priya Nair', email: 'customer@marketsphere.dev', password: 'Customer@12345', role: ROLES.CUSTOMER },
  { name: 'Karan Verma', email: 'delivery@marketsphere.dev', password: 'Delivery@12345', role: ROLES.DELIVERY_PARTNER },
];

async function seed() {
  await mongoose.connect(env.MONGODB_URI);
  logger.info(`Seeding demo users into ${mongoose.connection.name}...`);

  for (const demo of DEMO_USERS) {
    const passwordHash = await bcrypt.hash(demo.password, 12);

    await User.findOneAndUpdate(
      { email: demo.email },
      {
        $set: {
          name: demo.name,
          passwordHash,
          role: demo.role,
          isEmailVerified: true,
          isActive: true,
        },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    logger.info(`✓ ${demo.role.padEnd(17)} ${demo.email}`);
  }

  logger.warn(
    'Demo accounts use fixed, published passwords — for local/portfolio use only. Never seed real deployments this way.'
  );

  await mongoose.disconnect();
}

seed().catch((err) => {
  logger.error('Seed failed', { error: err.message });
  process.exit(1);
});
