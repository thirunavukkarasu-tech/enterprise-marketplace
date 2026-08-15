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
 * Only Customer and Vendor accounts can be created through the public
 * /auth/register endpoint. Delivery Partner accounts are onboarded
 * internally by an admin (Phase 4+ admin user management) — a stranger
 * self-signing-up as a delivery partner isn't a real-world flow for a
 * marketplace that's responsible for the packages in their hands.
 * Super Admin accounts are never created through a public endpoint at
 * all; the only one in this project comes from the seed script.
 */
export const PUBLIC_REGISTERABLE_ROLES = [ROLES.CUSTOMER, ROLES.VENDOR];

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

export const ALL_VENDOR_STATUSES = Object.values(VENDOR_STATUS);

/**
 * Which admin-driven transitions are legal from a given status. Enforced
 * server-side in vendorService — never inferred from whatever the client
 * happens to send. REJECTED is terminal for this phase: there's no
 * resubmission flow yet, so an admin cannot move a rejected vendor
 * anywhere from here without a product decision on what resubmission
 * should look like.
 */
export const VENDOR_STATUS_TRANSITIONS = Object.freeze({
  [VENDOR_STATUS.PENDING]: [VENDOR_STATUS.APPROVED, VENDOR_STATUS.REJECTED],
  [VENDOR_STATUS.APPROVED]: [VENDOR_STATUS.SUSPENDED],
  [VENDOR_STATUS.SUSPENDED]: [VENDOR_STATUS.APPROVED],
  [VENDOR_STATUS.REJECTED]: [],
});
