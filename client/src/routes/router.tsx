import { createBrowserRouter } from 'react-router-dom';
import { LayoutDashboard, Store, Boxes, ShoppingCart, Users, Settings, FolderTree } from 'lucide-react';

import { StorefrontLayout } from '../layouts/StorefrontLayout';
import { DashboardLayout } from '../layouts/DashboardLayout';
import { DeliveryLayout } from '../layouts/DeliveryLayout';
import { AuthLayout } from '../layouts/AuthLayout';

import { StorefrontHome } from '../pages/storefront/StorefrontHome';
import { ProductListing } from '../pages/storefront/ProductListing';
import { ProductDetail } from '../pages/storefront/ProductDetail';
import { AdminOverview } from '../pages/admin/AdminOverview';
import { AdminProducts } from '../pages/admin/AdminProducts';
import { AdminCategories } from '../pages/admin/AdminCategories';
import { AdminVendors } from '../pages/admin/AdminVendors';
import { VendorOverview } from '../pages/vendor/VendorOverview';
import { VendorProducts } from '../pages/vendor/VendorProducts';
import { VendorProductForm } from '../pages/vendor/VendorProductForm';
import { VendorProfile } from '../pages/vendor/VendorProfile';
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
  { to: '/admin/orders', label: 'Orders', icon: ShoppingCart },
  { to: '/admin/customers', label: 'Customers', icon: Users },
  { to: '/admin/settings', label: 'Settings', icon: Settings },
];

const vendorNav = [
  { to: '/vendor', label: 'Overview', icon: LayoutDashboard },
  { to: '/vendor/products', label: 'Products', icon: Boxes },
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
      { path: 'categories', element: <PlaceholderPage title="Categories" phase="Phase 3" /> },
      { path: 'vendors', element: <PlaceholderPage title="Vendor directory" phase="Phase 4" /> },
      { path: 'cart', element: <PlaceholderPage title="Cart" phase="Phase 6" /> },
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
      { path: 'orders', element: <PlaceholderPage title="Order monitoring" phase="Phase 7" /> },
      { path: 'customers', element: <PlaceholderPage title="Customer management" phase="Phase 4" /> },
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
      { path: 'orders', element: <PlaceholderPage title="Vendor orders" phase="Phase 7" /> },
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
