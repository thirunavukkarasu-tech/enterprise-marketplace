import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { env } from '../config/env.js';

/**
 * Access token: short-lived, carries `sub` (user id) and `role` so RBAC
 * middleware can authorize without a DB round trip on every request.
 */
export function signAccessToken(user) {
  return jwt.sign({ sub: user._id.toString(), role: user.role }, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRY,
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

/**
 * Refresh token: carries `sub`, `family` (the rotation chain id), and
 * `jti` (this specific token's id). The JWT signature proves it wasn't
 * forged; the DB lookup by hash (in authService) proves it hasn't already
 * been rotated past or revoked — the signature alone can't tell you that.
 */
export function signRefreshToken({ sub, family, jti }) {
  return jwt.sign({ sub, family, jti }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRY,
  });
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}

/** SHA-256 hex digest — used to store refresh/verification/reset tokens
 * at rest without keeping the raw, usable secret in the database. */
export function hashToken(rawToken) {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

/** High-entropy random token for email verification / password reset
 * links. Not a JWT — it's a single-use opaque secret matched against its
 * hash in the User document. */
export function generateRawToken() {
  return crypto.randomBytes(32).toString('hex');
}
