import mongoose from 'mongoose';

/**
 * Separate, referenced, append-only collection — same reasoning as
 * RefreshToken and InventoryLedger (docs/DATABASE.md): unbounded over
 * time, queried independently of any single user/order/product ("recent
 * platform activity," "who approved this vendor"), never read/written as
 * part of another document's unit of work.
 *
 * Deliberately lightweight — this is the "operational activity" log
 * Phase 7 asks for (who did what, when), not the full audit/compliance
 * subsystem docs/ROADMAP.md still lists as a Phase 10 concern (retention
 * policy, tamper-evidence, export). Building that now would be exactly
 * the kind of premature infrastructure the project's stated
 * anti-over-engineering rule warns against.
 */
const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    entityType: { type: String, required: true },
    entityId: { type: mongoose.Schema.Types.ObjectId, required: true },
    // Free-form context (e.g. { from: 'pending', to: 'approved' }) — never
    // passwords, tokens, or payment secrets; see auditService.js.
    metadata: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

auditLogSchema.index({ actor: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });

auditLogSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const AuditLog = mongoose.model('AuditLog', auditLogSchema);
