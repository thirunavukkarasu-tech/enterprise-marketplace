import { Address } from '../models/Address.model.js';
import { ApiError } from '../utils/ApiError.js';

const EDITABLE_FIELDS = ['label', 'fullName', 'phone', 'line1', 'line2', 'city', 'state', 'country', 'postalCode'];

function applyFields(doc, payload) {
  for (const field of EDITABLE_FIELDS) {
    if (payload[field] !== undefined) doc[field] = payload[field];
  }
}

/**
 * Every function takes `userId` from the controller's `req.user.id` and
 * every lookup is scoped with `{ _id: addressId, user: userId }` in one
 * query — never `findById` alone followed by a separate ownership check,
 * which would (harmlessly here, but as a matter of habit) briefly load
 * another user's document into memory before deciding to reject it. This
 * mirrors the ownership-scoped-query pattern `productService` established
 * in Phase 3, not the route-separation pattern Phase 4 used for vendor
 * profiles — addresses are a *list* resource (many per user), so a
 * shared `/addresses/:id` route with an ownership-scoped query is the
 * right shape here, not a separate `/addresses/me` singleton route.
 */
async function getOwnedOrThrow(userId, addressId) {
  const address = await Address.findOne({ _id: addressId, user: userId });
  if (!address) {
    throw ApiError.notFound('Address not found');
  }
  return address;
}

export const addressService = {
  async list(userId) {
    return Address.find({ user: userId }).sort({ createdAt: -1 });
  },

  async getOne(userId, addressId) {
    return getOwnedOrThrow(userId, addressId);
  },

  async create(userId, payload) {
    const address = await Address.create({ user: userId, ...payload });
    // A customer's first address is a reasonable default for both —
    // saves an extra "set as default" click for the common single-address
    // case, without silently overriding a choice on subsequent addresses.
    const existingCount = await Address.countDocuments({ user: userId });
    if (existingCount === 1) {
      address.isDefaultShipping = true;
      address.isDefaultBilling = true;
      await address.save();
    }
    return address;
  },

  async update(userId, addressId, payload) {
    const address = await getOwnedOrThrow(userId, addressId);
    applyFields(address, payload);
    await address.save();
    return address;
  },

  async remove(userId, addressId) {
    const address = await getOwnedOrThrow(userId, addressId);
    await address.deleteOne();
  },

  async setDefaultShipping(userId, addressId) {
    const address = await getOwnedOrThrow(userId, addressId);
    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isDefaultShipping: false } });
    address.isDefaultShipping = true;
    await address.save();
    return address;
  },

  async setDefaultBilling(userId, addressId) {
    const address = await getOwnedOrThrow(userId, addressId);
    await Address.updateMany({ user: userId, _id: { $ne: addressId } }, { $set: { isDefaultBilling: false } });
    address.isDefaultBilling = true;
    await address.save();
    return address;
  },

  /** Used by checkoutService to validate an address selection belongs to
   * the checking-out customer without exposing a separate lookup path. */
  async assertOwned(userId, addressId) {
    return getOwnedOrThrow(userId, addressId);
  },
};
