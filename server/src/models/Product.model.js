import mongoose from 'mongoose';
import { PRODUCT_STATUS, ALL_PRODUCT_STATUSES } from '../constants/product.js';

/**
 * A real sub-schema (not a plain object literal) so it can carry its own
 * virtual — `availableStock` is always derived from `stock - reservedStock`,
 * never stored, so it can't drift from its inputs. `reservedStock` exists
 * now, always `0`, even though nothing writes to it until checkout exists
 * (Phase 6/7) — adding the field later would mean a migration touching
 * every existing product.
 */
const variantSchema = new mongoose.Schema(
  {
    sku: {
      type: String,
      required: [true, 'SKU is required'],
      trim: true,
      uppercase: true,
      maxlength: 50,
    },
    attributes: {
      type: Map,
      of: String,
      default: undefined, // e.g. { size: 'M', color: 'Red' }
    },
    price: {
      type: Number,
      required: [true, 'Price is required'],
      min: [0, 'Price cannot be negative'],
    },
    compareAtPrice: {
      type: Number,
      min: [0, 'Compare-at price cannot be negative'],
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
      default: 0,
    },
  },
  { _id: false, toJSON: { virtuals: true }, toObject: { virtuals: true } }
);

variantSchema.virtual('availableStock').get(function availableStock() {
  return this.stock - this.reservedStock;
});

const productSchema = new mongoose.Schema(
  {
    // References User, not a dedicated Vendor document — the Vendor
    // collection doesn't exist until Phase 4. See docs/DATABASE.md for
    // why this is a one-line service change later, not a migration.
    vendor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: true,
    },
    title: {
      type: String,
      required: [true, 'Title is required'],
      trim: true,
      minlength: 2,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      maxlength: 5000,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    variants: {
      type: [variantSchema],
      validate: {
        validator: (v) => Array.isArray(v) && v.length > 0,
        message: 'A product must have at least one variant',
      },
    },
    images: {
      type: [
        {
          url: { type: String, required: true },
          alt: { type: String },
          _id: false,
        },
      ],
      default: [],
    },
    status: {
      type: String,
      enum: ALL_PRODUCT_STATUSES,
      default: PRODUCT_STATUS.DRAFT,
    },
    // Denormalized from variants[].price on every create/update/variant
    // mutation — see productService.recomputePriceRange. Lets storefront
    // listing sort/filter by price without unwinding variants on every
    // query.
    priceRange: {
      min: { type: Number, default: 0 },
      max: { type: Number, default: 0 },
    },
    ratingAverage: { type: Number, default: 0, min: 0, max: 5 },
    ratingCount: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

productSchema.index({ vendor: 1, status: 1 });
productSchema.index({ category: 1, status: 1 });
productSchema.index({ status: 1, 'priceRange.min': 1 });
productSchema.index({ 'variants.sku': 1 }, { unique: true });
productSchema.index({ title: 'text', description: 'text' });

productSchema.set('toJSON', {
  virtuals: true,
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Product = mongoose.model('Product', productSchema);
