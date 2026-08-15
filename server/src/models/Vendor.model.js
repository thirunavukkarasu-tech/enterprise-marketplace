import mongoose from 'mongoose';
import { VENDOR_STATUS, ALL_VENDOR_STATUSES } from '../constants/roles.js';

/**
 * A real sub-schema (not a plain object) so address validation is
 * self-contained and reusable if another domain ever needs a postal
 * address shape (e.g. a delivery pickup address in a later phase).
 */
const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, required: [true, 'Address line 1 is required'], trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: [true, 'City is required'], trim: true, maxlength: 100 },
    state: { type: String, required: [true, 'State is required'], trim: true, maxlength: 100 },
    country: { type: String, required: [true, 'Country is required'], trim: true, maxlength: 100 },
    postalCode: { type: String, required: [true, 'Postal code is required'], trim: true, maxlength: 20 },
  },
  { _id: false }
);

const mediaRefSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    alt: { type: String, maxlength: 150 },
  },
  { _id: false }
);

const vendorSchema = new mongoose.Schema(
  {
    // 1:1 with User — a vendor account is always a User with role='vendor'
    // that has additionally onboarded a business profile. Kept as a
    // separate document (see docs/DATABASE.md) rather than fields on
    // User, since vendor-only data would otherwise mean a User schema
    // full of nullable vendor-specific fields for every non-vendor role.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },

    storeName: { type: String, required: [true, 'Store name is required'], trim: true, maxlength: 150 },
    legalBusinessName: { type: String, trim: true, maxlength: 200 },
    description: { type: String, trim: true, maxlength: 2000 },

    businessEmail: {
      type: String,
      required: [true, 'Business email is required'],
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid business email address'],
    },
    businessPhone: {
      type: String,
      required: [true, 'Business phone is required'],
      trim: true,
      match: [/^[+]?[0-9\s\-()]{7,20}$/, 'Invalid business phone number'],
    },
    address: { type: addressSchema, required: true },

    // Business/tax registration is jurisdiction-dependent and genuinely
    // optional at signup time for a lot of small sellers — kept optional
    // rather than blocking onboarding on a field format that varies by
    // country (GSTIN, EIN, VAT number, etc.). A specific format isn't
    // validated here for the same reason.
    taxId: { type: String, trim: true, maxlength: 50 },

    logo: mediaRefSchema,
    banner: mediaRefSchema,

    status: {
      type: String,
      enum: ALL_VENDOR_STATUSES,
      default: VENDOR_STATUS.PENDING,
      required: true,
    },

    // Verification is a distinct concept from approval status: approval
    // governs whether the vendor may sell at all; verification is a
    // "documents checked" badge that can be toggled independently by an
    // admin without walking the approve/reject/suspend state machine.
    isVerified: { type: Boolean, default: false },
    verifiedAt: { type: Date },
    verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },

    // Approval metadata — who made the last status decision, when, and
    // why. `rejectionReason` and `suspensionReason` are mutually
    // exclusive in practice (only the one matching the current/most
    // recent transition is meaningful) but both are kept so the history
    // of *why* isn't lost if status changes again later.
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: { type: Date },
    rejectionReason: { type: String, trim: true, maxlength: 500 },
    suspensionReason: { type: String, trim: true, maxlength: 500 },
  },
  { timestamps: true }
);

// One vendor profile per user (the field-level `unique: true` above
// already creates this index — no separate schema.index() call needed,
// see the Phase 2 postmortem on duplicate-index warnings).
vendorSchema.index({ status: 1 });
vendorSchema.index({ isVerified: 1 });
vendorSchema.index({ businessEmail: 1 });
vendorSchema.index({ createdAt: -1 });
// Supports admin search across store/legal name and business email.
vendorSchema.index({ storeName: 'text', legalBusinessName: 'text', businessEmail: 'text' });

vendorSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Vendor = mongoose.model('Vendor', vendorSchema);
