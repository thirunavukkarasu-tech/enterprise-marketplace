import mongoose from 'mongoose';
import { INVENTORY_CHANGE_TYPE } from '../constants/inventory.js';

/**
 * Separate, referenced, append-only collection — same reasoning as
 * RefreshToken and AuditLog (docs/DATABASE.md): unbounded over time,
 * queried independently of any single product ("this SKU's stock
 * history"), never read/written as part of another document's unit of
 * work. `Product.variants[].stock` stays the authoritative current
 * number; this is the audit trail explaining how it got there.
 */
const inventoryLedgerSchema = new mongoose.Schema(
  {
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    sku: { type: String, required: true },
    vendor: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    changeType: { type: String, enum: Object.values(INVENTORY_CHANGE_TYPE), required: true },
    // Signed: positive = stock added, negative = stock removed.
    quantityChange: { type: Number, required: true },
    resultingStock: { type: Number, required: true, min: 0 },
    reason: { type: String, trim: true, maxlength: 500 },
    performedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } }
);

inventoryLedgerSchema.index({ product: 1, createdAt: -1 });
inventoryLedgerSchema.index({ vendor: 1, createdAt: -1 });

inventoryLedgerSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const InventoryLedger = mongoose.model('InventoryLedger', inventoryLedgerSchema);
