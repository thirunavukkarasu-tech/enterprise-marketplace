import express from 'express';
import cookieParser from 'cookie-parser';
import compression from 'compression';
import morgan from 'morgan';

import { env, isDev } from './config/env.js';
import { logger } from './config/logger.js';
import { helmetMiddleware, corsMiddleware, sanitizeMiddleware, hppMiddleware } from './middleware/security.js';
import { globalLimiter } from './middleware/rateLimiter.js';
import { notFound } from './middleware/notFound.js';
import { errorHandler } from './middleware/errorHandler.js';
import v1Router from './routes/v1/index.js';

const app = express();

// Render/Railway/most PaaS put the app behind a reverse proxy — needed so
// `req.ip` and `secure` cookies work correctly, and so express-rate-limit
// reads the real client IP instead of the proxy's.
app.set('trust proxy', 1);

// ── Body & cookie parsing ───────────────────────────────────────────────
app.use(express.json({ limit: '10kb' })); // small limit: this API is JSON, not a file upload endpoint
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cookieParser(env.COOKIE_SECRET));
app.use(compression());

// ── Security ─────────────────────────────────────────────────────────────
app.use(helmetMiddleware);
app.use(corsMiddleware);
app.use(sanitizeMiddleware);
app.use(hppMiddleware);
app.use(globalLimiter);

// ── Logging ──────────────────────────────────────────────────────────────
app.use(
  morgan(isDev ? 'dev' : 'combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  })
);

// ── Routes ───────────────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({ success: true, message: 'MarketSphere API', version: env.API_VERSION });
});

app.use(`/api/${env.API_VERSION}`, v1Router);

// ── 404 + centralized error handling (must be last) ─────────────────────
app.use(notFound);
app.use(errorHandler);

export default app;
