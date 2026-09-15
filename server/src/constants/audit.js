/**
 * Every action this app writes to AuditLog. A closed set (not free-form
 * strings from callers) so `docs/SECURITY.md`/`docs/ARCHITECTURE.md` can
 * enumerate exactly what's tracked, and so a typo in a call site becomes
 * an import error, not a silently-uncategorized log entry.
 */
export const AUDIT_ACTION = Object.freeze({
  VENDOR_APPROVED: 'vendor.approved',
  VENDOR_REJECTED: 'vendor.rejected',
  VENDOR_SUSPENDED: 'vendor.suspended',
  VENDOR_REACTIVATED: 'vendor.reactivated',
  VENDOR_VERIFIED: 'vendor.verified',
  PRODUCT_CREATED: 'product.created',
  PRODUCT_UPDATED: 'product.updated',
  PRODUCT_STATUS_CHANGED: 'product.status_changed',
  INVENTORY_ADJUSTED: 'inventory.adjusted',
  ORDER_CREATED: 'order.created',
  ORDER_STATUS_CHANGED: 'order.status_changed',
  PAYMENT_CREATED: 'payment.created',
  PAYMENT_SUCCEEDED: 'payment.succeeded',
  PAYMENT_FAILED: 'payment.failed',
  COUPON_CREATED: 'coupon.created',
  COUPON_UPDATED: 'coupon.updated',
  COUPON_STATUS_CHANGED: 'coupon.status_changed',
  COUPON_DELETED: 'coupon.deleted',
});
