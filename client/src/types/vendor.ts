export type VendorStatus = 'pending' | 'approved' | 'rejected' | 'suspended';

export interface VendorAddress {
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface VendorMediaRef {
  url: string;
  alt?: string;
}

export interface VendorUserRef {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
}

export interface Vendor {
  _id: string;
  user: VendorUserRef | string;
  storeName: string;
  legalBusinessName?: string;
  description?: string;
  businessEmail: string;
  businessPhone: string;
  address: VendorAddress;
  taxId?: string;
  logo?: VendorMediaRef;
  banner?: VendorMediaRef;
  status: VendorStatus;
  isVerified: boolean;
  verifiedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionReason?: string;
  suspensionReason?: string;
  createdAt: string;
  updatedAt: string;
}

/** Fields a vendor may submit on onboarding or self-update — mirrors the
 * backend's SELF_EDITABLE_FIELDS allow-list. Admin-controlled fields
 * (status, isVerified, user, review metadata) are intentionally absent
 * from this type, not just from the form UI. */
export interface VendorProfileInput {
  storeName: string;
  legalBusinessName?: string;
  description?: string;
  businessEmail: string;
  businessPhone: string;
  address: VendorAddress;
  taxId?: string;
  logo?: VendorMediaRef;
  banner?: VendorMediaRef;
}

export interface VendorProductCounts {
  total: number;
  active: number;
  draft: number;
  archived: number;
}

export interface VendorDashboardNotice {
  tone: 'info' | 'error';
  message: string;
}

export interface VendorDashboardProduct {
  _id: string;
  title: string;
  slug: string;
  status: string;
  priceRange: { min: number; max: number };
  createdAt: string;
}

export interface VendorDashboard {
  vendor: Vendor;
  productCounts: VendorProductCounts;
  profileCompletion: number;
  recentProducts: VendorDashboardProduct[];
  notices: VendorDashboardNotice[];
}

export interface VendorListQuery {
  q?: string;
  status?: VendorStatus;
  isVerified?: boolean;
  sort?: 'newest' | 'oldest' | 'name_asc' | 'name_desc';
  page?: number;
  limit?: number;
}
