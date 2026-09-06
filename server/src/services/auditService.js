import { AuditLog } from '../models/AuditLog.model.js';
import { logger } from '../config/logger.js';

const SENSITIVE_KEYS = new Set(['password', 'passwordHash', 'token', 'accessToken', 'refreshToken', 'secret', 'cardNumber', 'cvv']);

/**
 * Strips anything that looks like a credential/secret from metadata
 * before it's written — a defensive backstop, not the only safeguard.
 * Callers should never pass sensitive fields in the first place (every
 * call site in this codebase passes small, deliberate objects like
 * `{ from, to }` or `{ quantity, reason }`), but a shallow filter here
 * means a future careless call site can't leak one into the audit trail.
 */
function sanitize(metadata) {
  if (!metadata || typeof metadata !== 'object') return {};
  const clean = {};
  for (const [key, value] of Object.entries(metadata)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) continue;
    clean[key] = value;
  }
  return clean;
}

export const auditService = {
  /**
   * Fire-and-forget in spirit, awaited in practice: a failure to write
   * an audit entry must never fail the operation being audited (approving
   * a vendor should succeed even if the audit write has a transient
   * error) — logged as a server-side warning instead of thrown.
   */
  async record(actor, action, entityType, entityId, metadata = {}) {
    try {
      await AuditLog.create({ actor, action, entityType, entityId, metadata: sanitize(metadata) });
    } catch (err) {
      logger.warn('Audit log write failed', { action, entityType, entityId: entityId?.toString(), error: err.message });
    }
  },

  async list({ actor, action, entityType, page = 1, limit = 20 } = {}) {
    const filter = {};
    if (actor) filter.actor = actor;
    if (action) filter.action = action;
    if (entityType) filter.entityType = entityType;

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('actor', 'name email role'),
      AuditLog.countDocuments(filter),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },
};
