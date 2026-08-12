import mongoose from 'mongoose';

/**
 * Refresh tokens are stored as a separate, referenced collection rather
 * than embedded on User — they're written on every login/refresh (far
 * more often than the user document itself changes), queried
 * independently during rotation, and unbounded over a user's lifetime.
 * Embedding this on User would mean rewriting the whole user document on
 * every token refresh and would eventually blow past reasonable document
 * size for a long-lived account.
 *
 * `family` groups every token descended from one login into a rotation
 * chain. Reuse detection works by checking whether an already-rotated
 * (revoked) token from a family is presented again — if so, the entire
 * family is revoked, since that's the signature of a stolen token being
 * replayed after the legitimate client already rotated past it.
 */
const refreshTokenSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    family: { type: String, required: true }, // uuid — shared by every token in one rotation chain
    tokenHash: { type: String, required: true, unique: true }, // sha256 of the raw JWT
    expiresAt: { type: Date, required: true },
    revokedAt: { type: Date, default: null },
    replacedByHash: { type: String, default: null },
    createdByIp: { type: String },
    userAgent: { type: String },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

refreshTokenSchema.index({ user: 1, family: 1 });
// Note: `tokenHash` already gets a unique index from `unique: true` above.
// TTL cleanup: Mongo removes the document automatically once expiresAt has
// passed, so revoked/expired rotation history doesn't accumulate forever.
refreshTokenSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const RefreshToken = mongoose.model('RefreshToken', refreshTokenSchema);
