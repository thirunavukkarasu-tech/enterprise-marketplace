import 'dotenv/config';
import { z } from 'zod';

/**
 * Why validate env vars at boot instead of letting `undefined` leak through
 * the app?  A missing JWT secret or DB URI should crash the process
 * immediately with a clear message — not surface three services deep as a
 * cryptic runtime error. This is the single source of truth for config;
 * nothing else in the codebase should read `process.env` directly.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().default(5000),
  API_VERSION: z.string().default('v1'),
  CLIENT_URL: z.string().url().default('http://localhost:5173'),

  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),

  JWT_ACCESS_SECRET: z.string().min(16, 'JWT_ACCESS_SECRET must be at least 16 characters'),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(16, 'JWT_REFRESH_SECRET must be at least 16 characters'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  COOKIE_SECRET: z.string().min(16, 'COOKIE_SECRET must be at least 16 characters'),

  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(900000),
  RATE_LIMIT_MAX: z.coerce.number().default(300),

  REDIS_URL: z.string().optional().default(''),

  STORAGE_PROVIDER: z.string().default('cloudinary'),
  STORAGE_CLOUD_NAME: z.string().optional().default(''),
  STORAGE_API_KEY: z.string().optional().default(''),
  STORAGE_API_SECRET: z.string().optional().default(''),

  EMAIL_FROM: z.string().default('no-reply@marketsphere.dev'),
});

function loadEnv() {
  const parsed = envSchema.safeParse(process.env);

  if (!parsed.success) {
    // In test mode we don't want to hard-crash on missing secrets so the
    // health-check/unit tests can run without a full .env file.
    if (process.env.NODE_ENV === 'test') {
      return envSchema.parse({
        MONGODB_URI: 'mongodb://localhost:27017/marketsphere-test',
        JWT_ACCESS_SECRET: 'test-access-secret-please-ignore',
        JWT_REFRESH_SECRET: 'test-refresh-secret-please-ignore',
        COOKIE_SECRET: 'test-cookie-secret-please-ignore',
        ...process.env,
      });
    }

    console.error('❌ Invalid or missing environment variables:');
    for (const issue of parsed.error.issues) {
      console.error(`   • ${issue.path.join('.')}: ${issue.message}`);
    }
    process.exit(1);
  }

  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isDev = env.NODE_ENV === 'development';
