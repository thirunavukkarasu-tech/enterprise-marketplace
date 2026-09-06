import { adminDashboardService } from '../services/adminDashboardService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const adminDashboardController = {
  async getOverview(req, res) {
    const overview = await adminDashboardService.getOverview();
    new ApiResponse(200, { overview }).send(res);
  },
};
