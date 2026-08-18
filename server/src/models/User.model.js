import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import { ALL_ROLES, ROLES } from '../constants/roles.js';

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, 'Name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Invalid email address'],
    },
    passwordHash: {
      type: String,
      required: true,
      select: false, // never returned by default — must opt in with .select('+passwordHash')
    },
    role: {
      type: String,
      enum: ALL_ROLES,
      default: ROLES.CUSTOMER,
      required: true,
    },
    isEmailVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },

    // Optional — added in Phase 5 for the customer (and general account)
    // profile page. Deliberately not required: it didn't exist through
    // registration in Phase 2, so every existing account would otherwise
    // start in a permanently-invalid state.
    phone: {
      type: String,
      trim: true,
      match: [/^[+]?[0-9\s\-()]{7,20}$/, 'Invalid phone number'],
    },

    // Email verification (hashed token; raw token only ever exists in the
    // outgoing email/link, never persisted).
    emailVerificationTokenHash: { type: String, select: false },
    emailVerificationExpiry: { type: Date, select: false },

    // Password reset (same hashed-token pattern).
    passwordResetTokenHash: { type: String, select: false },
    passwordResetExpiry: { type: Date, select: false },

    passwordChangedAt: { type: Date, select: false },
  },
  { timestamps: true }
);

// Note: `email` already gets a unique index from `unique: true` above —
// no separate schema.index() call needed for it (declaring both creates
// a duplicate-index warning at startup).
userSchema.index({ role: 1, isActive: 1 });

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.passwordHash);
};

// Strip anything sensitive even in the rare case a sensitive field was
// explicitly selected — this transform runs on every res.json(user).
userSchema.set('toJSON', {
  transform: (_doc, ret) => {
    delete ret.passwordHash;
    delete ret.emailVerificationTokenHash;
    delete ret.emailVerificationExpiry;
    delete ret.passwordResetTokenHash;
    delete ret.passwordResetExpiry;
    delete ret.__v;
    return ret;
  },
});

export const User = mongoose.model('User', userSchema);
