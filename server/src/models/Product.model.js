import mongoose from 'mongoose';
import { ALL_PRODUCT_STATUSES, PRODUCT_STATUS } from '../constants/product.js';

/**
 * Variants are embedded on Product (not a separate collection) — see
 * docs/DATABASE.md: a variant is meaningless outside its parent product
 * and is always read/written together with it. `stock` and
 * `reservedStock` are both present now even though nothing reserves stock
 * yet (checkout doesn't exist until Phase 6/7) — adding `reservedStock`
 * later would mean a schema migration touching every existing product;
 * defining it now costs nothing and keeps this model stable once orders
 * start writing to it. `availableStock` is never stored — it's always
 * derived (`stock - reservedStock`) so it can never drift out of sync
 * with its inputs.
 */
const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
    },
    attributes: {
      // Free-form key/value pairs (e.g. { color: 'Black', size: 'M' }).
      // A fixed schema per category (e.g. requiring "size" for apparel)
      // is a Phase-4+ category-attribute-template concern — out of scope
      // for the core variant model.
      type: Map,
      of: String,
      default: {},
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare-at price cannot be negative'],
      default: null,
      validate: {
        validator: function validateCompareAtPrice(value) {
          return value == null || value >= this.price;
        },
        message: 'Compare-at price must be greater than or equal to price',
      },
    },
    stock: {
      type: Number,
      required: true,
      min: [0, 'Stock cannot be negative'],
      default: 0,
    },
    reservedStock: {
      type: Number,
      required: true,
      min: [0, 'Reserved stock cannot be negative'],
      default: 0, // stays 0 until Phase 7 order/checkout reserves against it
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { _id: true, timestamps: false }
);

variantSchema.virtual('availableStock').get(function availableStock() {
  return Math.max(0, this.stock - this.reservedStock);
});
variantSchema.set('toJSON', { virtuals: true });

const productSchema = new mongoose.Schema(
  {
    // References User directly (not a Vendor document) because the
    // dedicated Vendor collection — storefront metadata, approval status,
    // payout details — doesn't exist until Phase 4. Ownership checks in
    // productService compare this against req.user.id today; Phase 4
    // repoints this at Vendor._id once that collection exists, which is
    // a one-line service change, not a data-model rewrite (Vendor.user
    // will still be a 1:1 pointer back to the same User).
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 3,
      maxlength: 150,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 5000,
      default: '',
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          alt: { type: String, default: '' },
        },
      ],
      default: [],
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: 'A product must have at least one variant',
      },
    },
    status: {
      type: String,
      enum: ALL_PRODUCT_STATUSES,
      default: PRODUCT_STATUS.DRAFT,
    },
    // Denormalized min/max across variants — kept in sync by
    // productService on every create/update. Exists so listing/sorting/
    // filtering by price doesn't require unwinding the variants array on
    // every query; that's the whole point of denormalizing it.
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// ── Indexes — each one exists for a specific query this module makes ──
productSchema.index({ vendor: 1, status: 1 }); // vendor's own product list
productSchema.index({ category: 1, status: 1 }); // category browsing
productSchema.index({ status: 1, 'priceRange.min': 1 }); // storefront sort-by-price
productSchema.index({ title: 'text', description: 'text' }); // search
productSchema.index({ 'variants.sku': 1 }, { unique: true }); // global SKU uniqueness

productSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Product = mongoose.model('Product', productSchema);
