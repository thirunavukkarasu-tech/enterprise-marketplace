import { couponService } from '../services/couponService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const couponController = {
  async list(req, res) {
    const { items, ...meta } = await couponService.list(req.query);
    new ApiResponse(200, { coupons: items }, 'Success', meta).send(res);
  },

  async getById(req, res) {
    const coupon = await couponService.getById(req.params.id);
    new ApiResponse(200, { coupon }).send(res);
  },

  async create(req, res) {
    const coupon = await couponService.create(req.user, req.body);
    new ApiResponse(201, { coupon }, 'Coupon created').send(res);
  },

  async update(req, res) {
    const coupon = await couponService.update(req.user, req.params.id, req.body);
    new ApiResponse(200, { coupon }, 'Coupon updated').send(res);
  },

  async setStatus(req, res) {
    const coupon = await couponService.setActive(req.user, req.params.id, req.body.isActive);
    new ApiResponse(200, { coupon }, req.body.isActive ? 'Coupon activated' : 'Coupon deactivated').send(res);
  },

  async remove(req, res) {
    await couponService.remove(req.user, req.params.id);
    new ApiResponse(200, null, 'Coupon deleted').send(res);
  },
};
