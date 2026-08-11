/**
 * Central role registry for RBAC.
 *
 * Defined in Phase 1 (even though auth lands in Phase 2) because the folder
 * structure, route stubs, and DB schema decisions throughout the app all
 * need to agree on the same four role strings from day one.
 */
export const ROLES = Object.freeze({
  SUPER_ADMIN: 'super_admin',
  VENDOR: 'vendor',
  CUSTOMER: 'customer',
  DELIVERY_PARTNER: 'delivery_partner',
});

export const ALL_ROLES = Object.values(ROLES);

/**
 * Vendor-facing accounts go through an approval workflow before they can
 * act as a vendor; this status lives on the Vendor model, not the User
 * model, so a rejected/suspended vendor doesn't lose their base user
 * account.
 */
export const VENDOR_STATUS = Object.freeze({
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  SUSPENDED: 'suspended',
});
