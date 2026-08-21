import mongoose from 'mongoose';

/**
 * A separate, referenced collection (not embedded on User) — unlike
 * Wishlist/Cart, a customer can have *several* addresses and needs to
 * address one specifically by id (checkout picks one; the address list
 * page edits/deletes one independently of the others). That's exactly
 * the "queried/managed independently" case docs/DATABASE.md's embedding
 * rule calls out for referencing rather than embedding.
 */
const addressSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    label: { type: String, enum: ['home', 'work', 'other'], default: 'home' },
    fullName: { type: String, required: true, trim: true, maxlength: 150 },
    phone: { type: String, required: true, trim: true },
    line1: { type: String, required: true, trim: true, maxlength: 200 },
    line2: { type: String, trim: true, maxlength: 200 },
    city: { type: String, required: true, trim: true, maxlength: 100 },
    state: { type: String, required: true, trim: true, maxlength: 100 },
    country: { type: String, required: true, trim: true, maxlength: 100 },
    postalCode: { type: String, required: true, trim: true, maxlength: 20 },
    isDefaultShipping: { type: Boolean, default: false },
    isDefaultBilling: { type: Boolean, default: false },
  },
  { timestamps: true }
);

addressSchema.index({ user: 1 });
// Supports "find this user's default shipping/billing address" without a
// collection scan — addressService clears the previous default before
// setting a new one, so at most one document per user ever has each flag
// true, keeping these effectively unique-per-user in practice without a
// partial unique index adding that constraint at the schema level too.
addressSchema.index({ user: 1, isDefaultShipping: 1 });
addressSchema.index({ user: 1, isDefaultBilling: 1 });

addressSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Address = mongoose.model('Address', addressSchema);
