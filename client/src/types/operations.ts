export type StockStatus = 'in_stock' | 'low_stock' | 'out_of_stock';

export interface InventoryRow {
  productId: string;
  productTitle: string;
  productStatus: string;
  vendor: string;
  sku: string;
  stock: number;
  reservedStock: number;
  availableStock: number;
  stockStatus: StockStatus;
}

export interface InventoryLedgerEntry {
  _id: string;
  product: string;
  sku: string;
  vendor: string;
  changeType: 'sale' | 'adjustment';
  quantityChange: number;
  resultingStock: number;
  reason?: string;
  performedBy: { _id: string; name: string; email: string } | string;
  createdAt: string;
}

export interface InventoryListQuery {
  vendor?: string;
  stockStatus?: StockStatus;
  page?: number;
  limit?: number;
}

export interface AuditLogEntry {
  _id: string;
  actor: { _id: string; name: string; email: string; role: string } | string;
  action: string;
  entityType: string;
  entityId: string;
  metadata: Record<string, unknown>;
  createdAt: string;
}

export interface TrendPoint {
  date: string;
  revenue: number;
  orders: number;
}

export interface VendorPerformanceRow {
  vendorUserId: string;
  storeName: string;
  revenue: number;
  orderCount: number;
}

export interface AdminDashboardOverview {
  totalUsers: number;
  totalVendorAccounts: number;
  totalCustomers: number;
  totalProducts: number;
  activeProducts: number;
  pendingVendorApprovals: number;
  lowStockProductCount: number;
  pendingOrderGroups: number;
  completedOrderGroups: number;
  cancelledOrderGroups: number;
  totalRevenue: number;
  revenueTrend: TrendPoint[];
  vendorPerformance: VendorPerformanceRow[];
  recentActivity: AuditLogEntry[];
}

export interface AdminCustomerRow {
  _id: string;
  name: string;
  email: string;
  isActive: boolean;
  isEmailVerified: boolean;
  orderCount: number;
  totalSpent: number;
  createdAt: string;
}

export interface AdminCustomerDetail extends AdminCustomerRow {
  recentOrders: { orderId: string; orderNumber: string; grandTotal: number; createdAt: string }[];
}
