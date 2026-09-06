import { orderService } from '../services/orderService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { ROLES } from '../constants/roles.js';

export const orderController = {
  // ── customer ─────────────────────────────────────────────────────────
  async createFromCart(req, res) {
    const order = await orderService.createFromCart(req.user.id, req.body);
    new ApiResponse(201, { order }, 'Order placed').send(res);
  },

  async listOwn(req, res) {
    const { items, ...meta } = await orderService.listForCustomer(req.user.id, req.query);
    new ApiResponse(200, { orders: items }, 'Success', meta).send(res);
  },

  async getOwn(req, res) {
    const order = await orderService.getForCustomer(req.user.id, req.params.id);
    new ApiResponse(200, { order }).send(res);
  },

  // ── managed: vendor sees own orders, admin sees everything ──────────
  // Same role-branching pattern productController.listManaged/
  // getManagedById established in Phase 3 — one route, the service
  // decides scope from req.user, not two parallel route trees.
  async listManaged(req, res) {
    const { items, ...meta } =
      req.user.role === ROLES.VENDOR
        ? await orderService.listForVendor(req.user.id, req.query)
        : await orderService.listForAdmin(req.query);
    new ApiResponse(200, { orders: items }, 'Success', meta).send(res);
  },

  async getManagedById(req, res) {
    const order =
      req.user.role === ROLES.VENDOR
        ? await orderService.getForVendor(req.user.id, req.params.id)
        : await orderService.getForAdmin(req.params.id);
    new ApiResponse(200, { order }).send(res);
  },

  // ── shared: vendor updates their own group, admin updates any ───────
  async updateStatus(req, res) {
    const order = await orderService.updateStatus(req.user, req.params.id, req.body);
    new ApiResponse(200, { order }, 'Order status updated').send(res);
  },
};
