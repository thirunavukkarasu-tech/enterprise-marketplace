export type CartItemIssue =
  | 'product_unavailable'
  | 'variant_unavailable'
  | 'out_of_stock'
  | 'insufficient_stock'
  | 'price_changed';

export interface CartItemImage {
  url: string;
  alt?: string;
}

/** Server-hydrated cart item — always priced at the CURRENT product
 * price, never the stored snapshot. `priceSnapshot` is shown only to
 * explain a `price_changed` issue, never used for totals. */
export interface CartItem {
  itemId: string;
  product: string;
  sku: string;
  quantity: number;
  priceSnapshot: number;
  title: string | null;
  image?: CartItemImage | null;
  currentPrice: number | null;
  availableStock: number;
  issue: CartItemIssue | null;
  lineSubtotal: number;
  addedAt: string;
}

export type ShippingMethod = 'standard' | 'express';

/** The full server-calculated cart — every total here is authoritative;
 * the frontend never computes its own subtotal/tax/total. */
export interface Cart {
  cartId: string;
  items: CartItem[];
  itemCount: number;
  subtotal: number;
  discountAmount: number;
  taxAmount: number;
  shippingMethod: ShippingMethod;
  shippingFee: number;
  grandTotal: number;
  hasBlockingIssues: boolean;
  hasPriceChanges: boolean;
  priceChangeMessage: string | null;
}

export type AddressLabel = 'home' | 'work' | 'other';

export interface Address {
  _id: string;
  user: string;
  label: AddressLabel;
  fullName: string;
  phone: string;
  line1: string;
  line2?: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  isDefaultShipping: boolean;
  isDefaultBilling: boolean;
  createdAt: string;
  updatedAt: string;
}

export type AddressInput = Omit<Address, '_id' | 'user' | 'isDefaultShipping' | 'isDefaultBilling' | 'createdAt' | 'updatedAt'>;

/** Checkout review response — everything Phase 7's order creation would
 * need, without persisting anything. */
export interface CheckoutSummary extends Cart {
  shippingAddress: Address;
  billingAddress: Address;
  canProceed: boolean;
  reviewedAt: string;
}
