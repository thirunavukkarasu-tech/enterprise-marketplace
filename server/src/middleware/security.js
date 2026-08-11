import helmet from 'helmet';
import cors from 'cors';
import mongoSanitize from 'express-mongo-sanitize';
import hpp from 'hpp';
import { env, isProd } from '../config/env.js';

/**
 * Helmet with a conservative CSP. Kept permissive on `connect-src` for the
 * client's own origin only — this tightens further once real third-party
 * assets (Cloudinary, a payment SDK) are introduced in later phases.
 */
export const helmetMiddleware = helmet({
  contentSecurityPolicy: isProd
    ? {
        directives: {
          defaultSrc: ["'self'"],
          connectSrc: ["'self'", env.CLIENT_URL],
          imgSrc: ["'self'", 'data:', 'https:'],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      }
    : false, // disabled in dev so Vite HMR / devtools aren't fought
  crossOriginResourcePolicy: { policy: 'cross-origin' },
});

/**
 * Single allowed origin (the client app) with credentials enabled, since
 * refresh tokens travel as an httpOnly cookie.
 */
export const corsMiddleware = cors({
  origin: env.CLIENT_URL,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
});

// Strips out any key starting with `$` or containing `.` from
// req.body/query/params — the standard NoSQL-injection guard for Mongo.
export const sanitizeMiddleware = mongoSanitize();

// Guards against HTTP Parameter Pollution (e.g. ?role=customer&role=admin).
export const hppMiddleware = hpp();
