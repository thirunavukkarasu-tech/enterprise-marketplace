import { vendorService } from '../services/vendorService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const vendorController = {
  // ── self-service (vendor role) ──────────────────────────────────────
  async createOwnProfile(req, res) {
    const vendor = await vendorService.createOwnProfile(req.user.id, req.body);
    new ApiResponse(201, { vendor }, 'Vendor profile submitted for review').send(res);
  },

  async getOwnProfile(req, res) {
    const vendor = await vendorService.getOwnProfile(req.user.id);
    new ApiResponse(200, { vendor }).send(res);
  },

  async updateOwnProfile(req, res) {
    const vendor = await vendorService.updateOwnProfile(req.user.id, req.body);
    new ApiResponse(200, { vendor }, 'Profile updated').send(res);
  },

  async getOwnDashboard(req, res) {
    const dashboard = await vendorService.getOwnDashboard(req.user.id);
    new ApiResponse(200, dashboard).send(res);
  },

  // ── admin management ────────────────────────────────────────────────
  async listAll(req, res) {
    const { items, ...meta } = await vendorService.listAll(req.query);
    new ApiResponse(200, { vendors: items }, 'Success', meta).send(res);
  },

  async getById(req, res) {
    const vendor = await vendorService.getById(req.params.id);
    new ApiResponse(200, { vendor }).send(res);
  },

  async approve(req, res) {
    const vendor = await vendorService.approve(req.user, req.params.id);
    new ApiResponse(200, { vendor }, 'Vendor approved').send(res);
  },

  async reject(req, res) {
    const vendor = await vendorService.reject(req.user, req.params.id, req.body.reason);
    new ApiResponse(200, { vendor }, 'Vendor rejected').send(res);
  },

  async suspend(req, res) {
    const vendor = await vendorService.suspend(req.user, req.params.id, req.body.reason);
    new ApiResponse(200, { vendor }, 'Vendor suspended').send(res);
  },

  async reactivate(req, res) {
    const vendor = await vendorService.reactivate(req.user, req.params.id);
    new ApiResponse(200, { vendor }, 'Vendor reactivated').send(res);
  },

  async setVerification(req, res) {
    const vendor = await vendorService.setVerification(req.user, req.params.id, req.body.isVerified);
    const message = req.body.isVerified ? 'Vendor marked as verified' : 'Vendor verification revoked';
    new ApiResponse(200, { vendor }, message).send(res);
  },
};
