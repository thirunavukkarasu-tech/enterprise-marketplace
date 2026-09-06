import { Product } from '../models/Product.model.js';
import { InventoryLedger } from '../models/InventoryLedger.model.js';
import { ApiError } from '../utils/ApiError.js';
import { canManageProduct } from '../utils/ownership.js';
import { getStockStatus, INVENTORY_CHANGE_TYPE, DEFAULT_LOW_STOCK_THRESHOLD } from '../constants/inventory.js';
import { PAGINATION_DEFAULTS } from '../constants/product.js';
import { ROLES } from '../constants/roles.js';
import { auditService } from './auditService.js';
import { AUDIT_ACTION } from '../constants/audit.js';

/**
 * Inventory is a view over the existing Product/variant data (Phase 3),
 * not a new source of truth — `Product.variants[].stock` stays
 * authoritative for what's actually sellable; this service adds the
 * *operational* layer on top: an adjustment workflow with a reason,
 * an auditable history, and a derived stock-status roll-up for the
 * vendor/admin UI. It does not duplicate Product, only reads and (for
 * adjustments) writes into it.
 */

async function loadOwnedProductOrThrow(user, productId) {
  const product = await Product.findById(productId);
  if (!product) throw ApiError.notFound('Product not found');
  if (!canManageProduct(user, product)) {
    throw ApiError.forbidden('You do not have permission to perform this action');
  }
  return product;
}

function toInventoryRow(product) {
  return product.variants.map((variant) => ({
    productId: product._id.toString(),
    productTitle: product.title,
    productStatus: product.status,
    vendor: product.vendor.toString(),
    sku: variant.sku,
    stock: variant.stock,
    reservedStock: variant.reservedStock,
    availableStock: variant.availableStock,
    stockStatus: getStockStatus(variant.availableStock),
  }));
}

export const inventoryService = {
  /**
   * Flattened one-row-per-SKU view, same shape whether the caller is a
   * vendor (forced to their own products, same pattern
   * `productService.listManaged` already established) or an admin
   * (optionally filtered by `?vendor=`). `stockStatus` filtering happens
   * in application code after the DB fetch — it's a derived value, never
   * stored, so there's nothing to index or query it by directly (see
   * docs/DATABASE.md).
   */
  async listManaged(user, { vendor, stockStatus, page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    const filter = {};
    if (user.role === ROLES.VENDOR) {
      filter.vendor = user.id; // forced server-side — never trusted from a query param
    } else if (vendor) {
      filter.vendor = vendor;
    }

    const products = await Product.find(filter).select('title status vendor variants');
    let rows = products.flatMap(toInventoryRow);

    if (stockStatus) {
      rows = rows.filter((row) => row.stockStatus === stockStatus);
    }

    const total = rows.length;
    const start = (page - 1) * limit;
    const items = rows.slice(start, start + limit);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  async history(user, productId, { page = PAGINATION_DEFAULTS.PAGE, limit = PAGINATION_DEFAULTS.LIMIT } = {}) {
    await loadOwnedProductOrThrow(user, productId);

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      InventoryLedger.find({ product: productId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate('performedBy', 'name email'),
      InventoryLedger.countDocuments({ product: productId }),
    ]);

    return { items, page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) };
  },

  /**
   * Manual stock correction — restocking, damage write-off, a recount.
   * `quantityChange` is signed (positive = add, negative = remove); the
   * resulting stock is rejected if it would go negative, never clamped
   * to zero silently, so a mistaken adjustment is visible as an error
   * rather than a quietly-wrong number.
   */
  async adjust(user, productId, { sku, quantityChange, reason }) {
    const product = await loadOwnedProductOrThrow(user, productId);

    const variant = product.variants.find((v) => v.sku === sku);
    if (!variant) {
      throw ApiError.badRequest('This product variant does not exist.');
    }

    const nextStock = variant.stock + quantityChange;
    if (nextStock < 0) {
      throw ApiError.badRequest(
        `This adjustment would reduce stock below zero (current: ${variant.stock}, change: ${quantityChange}).`
      );
    }

    variant.stock = nextStock;
    await product.save();

    await InventoryLedger.create({
      product: product._id,
      sku,
      vendor: product.vendor,
      changeType: INVENTORY_CHANGE_TYPE.ADJUSTMENT,
      quantityChange,
      resultingStock: nextStock,
      reason,
      performedBy: user.id,
    });

    await auditService.record(user.id, AUDIT_ACTION.INVENTORY_ADJUSTED, 'Product', product._id, {
      sku,
      quantityChange,
      resultingStock: nextStock,
      reason,
    });

    const row = toInventoryRow(product).find((r) => r.sku === sku);
    return row;
  },

  /** Used by the admin dashboard's low-stock count — see adminDashboardService.js. */
  DEFAULT_LOW_STOCK_THRESHOLD,

  /**
   * Writes the `SALE` side of the inventory ledger — called from
   * `orderService.createFromCart` inside the same transaction that
   * decrements stock and creates the Order, so the ledger entry and the
   * stock change it explains can never exist independently of each
   * other (if the transaction rolls back, so does this). This is the
   * one place order creation is allowed to touch InventoryLedger,
   * keeping the "inventory is a view over Product, `adjust` is the only
   * manual write path" boundary intact — a sale isn't a manual
   * adjustment, it's a distinct `changeType`, but it still only ever
   * happens through this service, not an ad hoc `InventoryLedger.create`
   * scattered into order logic.
   */
  async recordSale(entries, session) {
    if (entries.length === 0) return;
    await InventoryLedger.insertMany(
      entries.map((e) => ({
        product: e.product,
        sku: e.sku,
        vendor: e.vendor,
        changeType: INVENTORY_CHANGE_TYPE.SALE,
        quantityChange: -e.quantity,
        resultingStock: e.resultingStock,
        performedBy: e.performedBy,
      })),
      { session }
    );
  },
};
