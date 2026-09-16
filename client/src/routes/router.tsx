import { createBrowserRouter } from 'react-router-dom';
import { LayoutDashboard, Store, Boxes, ShoppingCart, Users, Settings, FolderTree, History, PackageSearch, Tag } from 'lucide-react';

import { StorefrontLayout } from '../layouts/StorefrontLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DeliveryLayout } from '../layouts/DeliveryLayout';
import { AuthLayout } from '../layouts/AuthLayout';

import { StorefrontHome } from '../pages/storefront/StorefrontHome';
import { ProductListing } from '../pages/storefront/ProductListing';
import { ProductDetail } from '../pages/storefront/ProductDetail';
import { CategoriesIndex } from '../pages/storefront/CategoriesIndex';
import { CategoryBrowse } from '../pages/storefront/CategoryBrowse';
import { Wishlist } from '../pages/customer/Wishlist';
import { CustomerProfile } from '../pages/customer/CustomerProfile';
import { Cart } from '../pages/customer/Cart';
import { Checkout } from '../pages/customer/Checkout';
import { Addresses } from '../pages/customer/Addresses';
import { MyOrders } from '../pages/customer/MyOrders';
import { MyOrderDetail } from '../pages/customer/MyOrderDetail';

// Admin and vendor screens are lazily loaded — see routes/lazyPages.ts
// for why these specific screens and not the storefront ones.
import {
  AdminOverview,
  AdminProducts,
  AdminCategories,
  AdminVendors,
  AdminOrders,
  AdminCoupons,
  AdminCustomers,
  AdminAuditLog,
  VendorOverview,
  VendorProducts,
  VendorProductForm,
  VendorProfile,
  Inventory,
} from './lazyPages';

import { DeliveryActive } from '../pages/delivery/DeliveryActive';
import { PlaceholderPage } from '../components/common/PlaceholderPage';
import { Unauthorized } from '../pages/Unauthorized';

import { Login } from '../pages/auth/Login';
import { Register } from '../pages/auth/Register';
import { ForgotPassword } from '../pages/auth/ForgotPassword';
import { ResetPassword } from '../pages/auth/ResetPassword';
import { VerifyEmail } from '../pages/auth/VerifyEmail';

import { ProtectedRoute } from './ProtectedRoute';

const adminNav = [
  { to: '/admin', label: 'Overview', icon: LayoutDashboard },
  { to: '/admin/vendors', label: 'Vendors', icon: Store },
  { to: '/admin/products', label: 'Products', icon: Boxes },
  { to: '/admin/categories', label: 'Categories', icon: FolderTree },
  { to: '/admin/inventory', label: 'Inventory', icon: PackageSearch },
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/coupons', label: 'Coupons', icon: Tag },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/audit-log', label: 'Audit Log', icon: History },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const vendorNav = [
  { to: '/vendor', label: 'Overview', icon: LayoutDashboard },
  { to: '/vendor/products', label: 'Products', icon: Boxes },
  { to: '/vendor/inventory', label: 'Inventory', icon: PackageSearch },
  { to: '/vendor/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/vendor/settings', label: 'Store Profile', icon: Settings },
];

export const router = createBrowserRouter([
  {
    path: '/',
    element: <StorefrontLayout />,
    children: [
      { index: true, element: <StorefrontHome /> },
      { path: 'products', element: <ProductListing /> },
      { path: 'products/:slug', element: <ProductDetail /> },
      { path: 'categories', element: <CategoriesIndex /> },
      { path: 'categories/:id', element: <CategoryBrowse /> },
      { path: 'vendors', element: <PlaceholderPage title="Vendor directory" phase="Coming soon" /> },
      {
        path: 'cart',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <Cart />
          </ProtectedRoute>
        ),
      },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <Checkout />
          </ProtectedRoute>
        ),
      },
      {
        path: 'addresses',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <Addresses />
          </ProtectedRoute>
        ),
      },
      {
        path: 'wishlist',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <Wishlist />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <MyOrders />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id',
        element: (
          <ProtectedRoute allowedRoles={['customer']}>
            <MyOrderDetail />
          </ProtectedRoute>
        ),
      },
      {
        path: 'account',
        element: (
          <ProtectedRoute>
            <CustomerProfile />
          </ProtectedRoute>
        ),
      },
    ],
  },
  {
    path: '/',
    element: <AuthLayout />,
    children: [
      { path: 'login', element: <Login /> },
      { path: 'register', element: <Register /> },
      { path: 'forgot-password', element: <ForgotPassword /> },
      { path: 'reset-password/:token', element: <ResetPassword /> },
      { path: 'verify-email/:token', element: <VerifyEmail /> },
    ],
  },
  { path: '/unauthorized', element: <Unauthorized /> },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['super_admin']}>
        <DashboardLayout navItems={adminNav} roleLabel="Super Admin" roleTone="indigo" />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <AdminOverview /> },
      { path: 'vendors', element: <AdminVendors /> },
      { path: 'products', element: <AdminProducts /> },
      { path: 'categories', element: <AdminCategories /> },
      { path: 'inventory', element: <Inventory scope="admin" /> },
      { path: 'orders', element: <AdminOrders /> },
      { path: 'coupons', element: <AdminCoupons /> },
      { path: 'customers', element: <AdminCustomers /> },
      { path: 'audit-log', element: <AdminAuditLog /> },
      { path: 'settings', element: <PlaceholderPage title="System settings" phase="Phase 10" /> },
    ],
  },
  {
    path: '/vendor',
    element: (
      <ProtectedRoute allowedRoles={['vendor']}>
        <DashboardLayout navItems={vendorNav} roleLabel="Vendor" roleTone="marigold" />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <VendorOverview /> },
      { path: 'products', element: <VendorProducts /> },
      { path: 'products/new', element: <VendorProductForm /> },
      { path: 'products/:id/edit', element: <VendorProductForm /> },
      { path: 'orders', element: <AdminOrders scope="vendor" /> },
      { path: 'inventory', element: <Inventory /> },
      { path: 'settings', element: <VendorProfile /> },
    ],
  },
  {
    path: '/delivery',
    element: (
      <ProtectedRoute allowedRoles={['delivery_partner']}>
        <DeliveryLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <DeliveryActive /> },
      { path: 'tracking', element: <PlaceholderPage title="Live tracking" phase="Phase 8" /> },
      { path: 'history', element: <PlaceholderPage title="Delivery history" phase="Phase 8" /> },
    ],
  },
  {
    path: '*',
    element: <PlaceholderPage title="Page not found" phase="—" description="Check the URL and try again." />,
  },
]);
