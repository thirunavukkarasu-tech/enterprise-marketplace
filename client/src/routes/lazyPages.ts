import { lazy } from 'react';

/**
 * Admin and vendor screens, code-split out of the main bundle.
 *
 * They're role-gated — a customer (the overwhelming majority of traffic
 * on a storefront) never navigates to any of them — and they're the only
 * screens that import `recharts`, which dominated the bundle before this
 * split. The storefront and customer screens are deliberately NOT here:
 * they're the first-paint path, so deferring them would trade a smaller
 * bundle for a slower initial render, which is the wrong direction.
 *
 * These live in their own module rather than in `router.tsx` so that
 * file keeps exporting only the router (a non-component). A module that
 * mixes component and non-component exports breaks React Fast Refresh,
 * which is what `react(only-export-components)` flags — this file
 * exports only components, and `router.tsx` exports only the router.
 *
 * Every page is a named export, hence the `.then()` mapping — React.lazy
 * expects a module with a `default`. The Suspense boundary these resolve
 * against lives in `DashboardLayout`, around its `<Outlet />`.
 */
export const AdminOverview = lazy(() =>
  import('../pages/admin/AdminOverview').then((m) => ({ default: m.AdminOverview }))
);
export const AdminProducts = lazy(() =>
  import('../pages/admin/AdminProducts').then((m) => ({ default: m.AdminProducts }))
);
export const AdminCategories = lazy(() =>
  import('../pages/admin/AdminCategories').then((m) => ({ default: m.AdminCategories }))
);
export const AdminVendors = lazy(() =>
  import('../pages/admin/AdminVendors').then((m) => ({ default: m.AdminVendors }))
);
export const AdminOrders = lazy(() =>
  import('../pages/admin/AdminOrders').then((m) => ({ default: m.AdminOrders }))
);
export const AdminCoupons = lazy(() =>
  import('../pages/admin/AdminCoupons').then((m) => ({ default: m.AdminCoupons }))
);
export const AdminCustomers = lazy(() =>
  import('../pages/admin/AdminCustomers').then((m) => ({ default: m.AdminCustomers }))
);
export const AdminAuditLog = lazy(() =>
  import('../pages/admin/AdminAuditLog').then((m) => ({ default: m.AdminAuditLog }))
);
export const VendorOverview = lazy(() =>
  import('../pages/vendor/VendorOverview').then((m) => ({ default: m.VendorOverview }))
);
export const VendorProducts = lazy(() =>
  import('../pages/vendor/VendorProducts').then((m) => ({ default: m.VendorProducts }))
);
export const VendorProductForm = lazy(() =>
  import('../pages/vendor/VendorProductForm').then((m) => ({ default: m.VendorProductForm }))
);
export const VendorProfile = lazy(() =>
  import('../pages/vendor/VendorProfile').then((m) => ({ default: m.VendorProfile }))
);
export const Inventory = lazy(() => import('../pages/vendor/Inventory').then((m) => ({ default: m.Inventory })));
