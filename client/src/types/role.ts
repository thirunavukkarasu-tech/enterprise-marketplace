// Mirrors server/src/constants/roles.js — kept as literal strings (not an
// enum) so it serializes identically to the API's JSON without a mapping
// layer.
export type Role = 'super_admin' | 'vendor' | 'customer' | 'delivery_partner';

export interface RoleMeta {
  role: Role;
  label: string;
  code: string; // short mono-set code used in the directory strip / badges
  description: string;
}

export const ROLE_DIRECTORY: RoleMeta[] = [
  { role: 'customer', label: 'Customer', code: 'CST', description: 'Browse, buy, and track orders' },
  { role: 'vendor', label: 'Vendor', code: 'VND', description: 'List products and fulfil orders' },
  { role: 'delivery_partner', label: 'Delivery', code: 'DLV', description: 'Accept and deliver shipments' },
  { role: 'super_admin', label: 'Admin', code: 'ADM', description: 'Oversee the marketplace' },
];
