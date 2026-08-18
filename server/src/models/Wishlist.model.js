import mongoose from 'mongoose';

/**
 * One Wishlist document per user, with an embedded array of Product
 * references — not a separate WishlistItem-per-row collection.
 *
 * This follows the same reasoning DATABASE.md already applies elsewhere:
 * a wishlist is always read and written as one unit ("my wishlist"), is
 * reasonably bounded (dozens of items, not thousands), and nothing in
 * this app needs to query "who wishlisted product X" independently of a
 * specific user's list. That combination favors embedding the product
 * id array on one per-user document — the same shape RefreshToken
 * deliberately avoided (there, tokens genuinely needed independent
 * per-record expiry/revocation, which is why that one *is* a separate
 * collection with one document per token instead).
 */
const wishlistSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    products: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
      },
    ],
  },
  { timestamps: true }
);

// `user` already gets a unique index from `unique: true` above — no
// separate schema.index() call for it (see the Phase 2 postmortem on
// duplicate-index warnings).

wishlistSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Wishlist = mongoose.model('Wishlist', wishlistSchema);
