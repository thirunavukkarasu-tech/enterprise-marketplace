export type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded';

export interface OrderItem {
  product: string;
  sku: string;
  title: string;
  quantity: number;
  unitPrice: number;
  lineSubtotal: number;
}

export interface OrderVendorGroup {
  _id: string;
  vendor: string;
  items: OrderItem[];
  subtotal: number;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface OrderAddressSnapshot {
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
}

export interface OrderCustomerRef {
  _id: string;
  name: string;
  email: string;
}

export interface Order {
  _id: string;
  orderNumber: string;
  customer: string | OrderCustomerRef;
  vendorGroups: OrderVendorGroup[];
  shippingAddress: OrderAddressSnapshot;
  billingAddress: OrderAddressSnapshot;
  shippingMethod: string;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingFee: number;
  grandTotal: number;
  paymentStatus: 'pending';
  createdAt: string;
  updatedAt: string;
}

export interface PaginationMeta {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface OrderListQuery {
  status?: OrderStatus;
  customer?: string;
  vendor?: string;
  from?: string;
  to?: string;
  page?: number;
  limit?: number;
}

/** Server-side whitelist mirrored for the frontend to disable
 * not-currently-legal actions rather than let a click 400. The backend
 * is still the enforcing source of truth — see docs/SECURITY.md. */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};
