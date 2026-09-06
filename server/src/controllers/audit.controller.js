import { auditService } from '../services/auditService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const auditController = {
  async list(req, res) {
    const { items, ...meta } = await auditService.list(req.query);
    new ApiResponse(200, { logs: items }, 'Success', meta).send(res);
  },
};
