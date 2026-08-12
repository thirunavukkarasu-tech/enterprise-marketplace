import crypto from 'crypto';
import bcrypt from 'bcryptjs';

import { User } from '../models/User.model.js';
import { RefreshToken } from '../models/RefreshToken.model.js';
import { ApiError } from '../utils/ApiError.js';
import { logger } from '../config/logger.js';
import { emailService } from './emailService.js';
import { env } from '../config/env.js';
import { parseDurationToMs } from '../utils/parseDuration.js';
import {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  hashToken,
  generateRawToken,
} from '../utils/tokenService.js';

const BCRYPT_COST = 12;
const EMAIL_VERIFICATION_TTL_MS = parseDurationToMs('1d');
const PASSWORD_RESET_TTL_MS = parseDurationToMs('1h');

// ── helpers ──────────────────────────────────────────────────────────────

async function issueSession(user, { ip, userAgent } = {}) {
  const family = crypto.randomUUID();
  const jti = crypto.randomUUID();

  const accessToken = signAccessToken(user);
  const refreshTokenRaw = signRefreshToken({ sub: user._id.toString(), family, jti });

  await RefreshToken.create({
    user: user._id,
    family,
    tokenHash: hashToken(refreshTokenRaw),
    expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRY)),
    createdByIp: ip,
    userAgent,
  });

  return { accessToken, refreshTokenRaw };
}

async function revokeFamily(userId, family) {
  await RefreshToken.updateMany(
    { user: userId, family, revokedAt: null },
    { $set: { revokedAt: new Date() } }
  );
}

// ── service ──────────────────────────────────────────────────────────────

export const authService = {
  async register({ name, email, password, role }) {
    const existing = await User.findOne({ email });
    if (existing) {
      throw ApiError.conflict('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_COST);

    const user = await User.create({ name, email, passwordHash, role });

    const rawToken = generateRawToken();
    user.emailVerificationTokenHash = hashToken(rawToken);
    user.emailVerificationExpiry = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MS);
    await user.save();

    await emailService.sendVerificationEmail(user, rawToken);

    logger.info('User registered', { userId: user._id.toString(), role: user.role });

    return user;
  },

  async login({ email, password, ip, userAgent }) {
    const user = await User.findOne({ email }).select('+passwordHash');

    // Same generic message whether the email doesn't exist or the
    // password is wrong — never reveal which, to prevent user enumeration.
    const genericError = () => ApiError.unauthorized('Invalid email or password');

    if (!user || !user.isActive) {
      throw genericError();
    }

    const passwordMatches = await user.comparePassword(password);
    if (!passwordMatches) {
      throw genericError();
    }

    const { accessToken, refreshTokenRaw } = await issueSession(user, { ip, userAgent });

    logger.info('User logged in', { userId: user._id.toString() });

    return { user, accessToken, refreshTokenRaw };
  },

  async refresh({ refreshTokenRaw, ip, userAgent }) {
    if (!refreshTokenRaw) {
      throw ApiError.unauthorized('No refresh token provided');
    }

    let payload;
    try {
      payload = verifyRefreshToken(refreshTokenRaw);
    } catch (err) {
      // Signature invalid or token expired — nothing to rotate, nothing
      // to revoke defensively (we can't trust an unverified payload for
      // anything more than logging).
      throw ApiError.unauthorized('Session expired. Please log in again.');
    }

    const tokenHash = hashToken(refreshTokenRaw);
    const stored = await RefreshToken.findOne({ tokenHash });

    if (!stored) {
      // A validly-signed token with no matching record — either it's from
      // a wiped/rotated-out-of-existence dataset, or something forged a
      // token for a family it doesn't have a record of. Revoke the family
      // defensively using the verified payload and force re-login.
      await revokeFamily(payload.sub, payload.family);
      throw ApiError.unauthorized('Session expired. Please log in again.');
    }

    if (stored.revokedAt) {
      // REUSE DETECTED: this exact token was already rotated away from
      // (or explicitly revoked) and is being presented again — the
      // signature of a stolen refresh token being replayed after the
      // legitimate client already moved to the next one in the chain.
      // Nuke the whole family so both the attacker and the legitimate
      // client are forced to re-authenticate.
      await revokeFamily(stored.user, stored.family);
      logger.warn('Refresh token reuse detected — family revoked', {
        userId: stored.user.toString(),
        family: stored.family,
      });
      throw ApiError.unauthorized('Session invalidated due to suspicious activity. Please log in again.');
    }

    if (stored.expiresAt < new Date()) {
      throw ApiError.unauthorized('Session expired. Please log in again.');
    }

    const user = await User.findById(stored.user);
    if (!user || !user.isActive) {
      throw ApiError.unauthorized('Account is no longer active');
    }

    // Rotate: issue a new token in the same family, mark this one
    // consumed, and link them for traceability.
    const jti = crypto.randomUUID();
    const newRefreshTokenRaw = signRefreshToken({ sub: user._id.toString(), family: stored.family, jti });
    const newTokenHash = hashToken(newRefreshTokenRaw);

    stored.revokedAt = new Date();
    stored.replacedByHash = newTokenHash;
    await stored.save();

    await RefreshToken.create({
      user: user._id,
      family: stored.family,
      tokenHash: newTokenHash,
      expiresAt: new Date(Date.now() + parseDurationToMs(env.JWT_REFRESH_EXPIRY)),
      createdByIp: ip,
      userAgent,
    });

    const accessToken = signAccessToken(user);

    return { user, accessToken, refreshTokenRaw: newRefreshTokenRaw };
  },

  async logout({ refreshTokenRaw }) {
    if (!refreshTokenRaw) return; // already logged out client-side; nothing to revoke

    const tokenHash = hashToken(refreshTokenRaw);
    await RefreshToken.updateOne({ tokenHash, revokedAt: null }, { $set: { revokedAt: new Date() } });
  },

  async forgotPassword({ email }) {
    const user = await User.findOne({ email });

    // Always behave the same way whether or not the account exists —
    // the controller returns a uniform message regardless.
    if (!user || !user.isActive) return;

    const rawToken = generateRawToken();
    user.passwordResetTokenHash = hashToken(rawToken);
    user.passwordResetExpiry = new Date(Date.now() + PASSWORD_RESET_TTL_MS);
    await user.save();

    await emailService.sendPasswordResetEmail(user, rawToken);
    logger.info('Password reset requested', { userId: user._id.toString() });
  },

  async resetPassword({ token, newPassword }) {
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      passwordResetTokenHash: tokenHash,
      passwordResetExpiry: { $gt: new Date() },
    }).select('+passwordResetTokenHash +passwordResetExpiry');

    if (!user) {
      throw ApiError.badRequest('Invalid or expired reset token');
    }

    user.passwordHash = await bcrypt.hash(newPassword, BCRYPT_COST);
    user.passwordResetTokenHash = undefined;
    user.passwordResetExpiry = undefined;
    user.passwordChangedAt = new Date();
    await user.save();

    // A password reset means any previously-issued session may have been
    // the attacker's, not the legitimate owner's — revoke everything and
    // require a fresh login.
    await RefreshToken.updateMany(
      { user: user._id, revokedAt: null },
      { $set: { revokedAt: new Date() } }
    );

    logger.info('Password reset completed — all sessions revoked', { userId: user._id.toString() });
  },

  async verifyEmail({ token }) {
    const tokenHash = hashToken(token);
    const user = await User.findOne({
      emailVerificationTokenHash: tokenHash,
      emailVerificationExpiry: { $gt: new Date() },
    }).select('+emailVerificationTokenHash +emailVerificationExpiry');

    if (!user) {
      throw ApiError.badRequest('Invalid or expired verification link');
    }

    user.isEmailVerified = true;
    user.emailVerificationTokenHash = undefined;
    user.emailVerificationExpiry = undefined;
    await user.save();

    logger.info('Email verified', { userId: user._id.toString() });
  },

  async getMe(userId) {
    const user = await User.findById(userId);
    if (!user || !user.isActive) {
      throw ApiError.notFound('User not found');
    }
    return user;
  },
};
