import { User } from '../models/User.model.js';
import { ApiError } from '../utils/ApiError.js';

// Same double-layer pattern established in Phase 4's vendorService: the
// validator already excludes admin-controlled fields, and this explicit
// allow-list is the second, independent layer — every write in this file
// goes through it, never `Object.assign` or `findByIdAndUpdate(id, req.body)`.
const SELF_EDITABLE_FIELDS = ['name', 'phone'];

function applyFields(doc, payload, allowedFields) {
  for (const field of allowedFields) {
    if (payload[field] !== undefined) doc[field] = payload[field];
  }
}

export const userService = {
  async updateOwnProfile(userId, payload) {
    const user = await User.findById(userId);
    if (!user) throw ApiError.notFound('User not found');

    applyFields(user, payload, SELF_EDITABLE_FIELDS);
    await user.save();
    return user;
  },
};
