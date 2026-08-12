import mongoose from 'mongoose';

/**
 * Self-referencing `parent` gives one collection both top-level categories
 * and subcategories without a separate Subcategory model — a subcategory
 * is just a Category whose `parent` is set. Kept flat (no nested embedded
 * tree) so categories can be queried, paginated, and moderated like any
 * other collection; the tree shape is assembled in the service layer from
 * a flat list, which is cheap at marketplace-category scale (tens to a
 * few hundred documents, not millions).
 */
const categorySchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Category name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
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
      maxlength: 500,
      default: '',
    },
    parent: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      default: null,
    },
    image: {
      url: { type: String, default: null },
      alt: { type: String, default: '' },
    },
    isActive: {
      type: Boolean,
      default: true,
    },
  },
  { timestamps: true }
);

categorySchema.index({ parent: 1, isActive: 1 });

categorySchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.__v;
    return ret;
  },
});

export const Category = mongoose.model('Category', categorySchema);
