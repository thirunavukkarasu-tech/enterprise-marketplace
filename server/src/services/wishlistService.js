import { Wishlist } from '../models/Wishlist.model.js';
import { Product } from '../models/Product.model.js';
import { ApiError } from '../utils/ApiError.js';

// Only the fields a wishlist card actually needs — never the full
// product document, and never anything vendor/admin-internal.
const WISHLIST_PRODUCT_FIELDS = 'title slug images priceRange status variants';

export const wishlistService = {
  async getOwn(userId) {
    const wishlist = await Wishlist.findOne({ user: userId }).populate('products', WISHLIST_PRODUCT_FIELDS);
    if (!wishlist) return [];

    // A wishlisted product can be hard-deleted independently of the
    // wishlist that references it — populate() silently returns `null`
    // for a dangling ref rather than throwing. Filter those out of the
    // response, and quietly repair the stored array to match so this
    // doesn't reappear on every future read.
    const valid = wishlist.products.filter(Boolean);
    if (valid.length !== wishlist.products.length) {
      wishlist.products = valid;
      await wishlist.save();
    }
    return valid;
  },

  async add(userId, productId) {
    const exists = await Product.exists({ _id: productId });
    if (!exists) throw ApiError.notFound('Product not found');

    // $addToSet is the duplicate-prevention mechanism — adding an
    // already-present product is a harmless no-op, not an error. A
    // second click on a filled-in heart icon should behave the same as
    // the first, not surface a 409 for a state the user can already see.
    await Wishlist.findOneAndUpdate(
      { user: userId },
      { $addToSet: { products: productId } },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );

    return this.getOwn(userId);
  },

  async remove(userId, productId) {
    await Wishlist.findOneAndUpdate({ user: userId }, { $pull: { products: productId } });
    return this.getOwn(userId);
  },
};
