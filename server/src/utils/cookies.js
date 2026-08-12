import { env, isProd } from '../config/env.js';
import { parseDurationToMs } from './parseDuration.js';

export const REFRESH_COOKIE_NAME = 'refreshToken';

// Scoped to /api/v1/auth so the cookie isn't attached to every API request
// — only the handful of endpoints that actually need it (refresh, logout).
const COOKIE_PATH = '/api/v1/auth';

function cookieOptions() {
  return {
    httpOnly: true,
    secure: isProd, // HTTPS-only in production; allowed over http in local dev
    sameSite: 'strict',
    path: COOKIE_PATH,
    maxAge: parseDurationToMs(env.JWT_REFRESH_EXPIRY),
  };
}

export function setRefreshCookie(res, token) {
  res.cookie(REFRESH_COOKIE_NAME, token, cookieOptions());
}

export function clearRefreshCookie(res) {
  res.clearCookie(REFRESH_COOKIE_NAME, { ...cookieOptions(), maxAge: undefined });
}
