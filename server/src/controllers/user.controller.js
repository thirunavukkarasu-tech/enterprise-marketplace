import { userService } from '../services/userService.js';
import { ApiResponse } from '../utils/ApiResponse.js';

export const userController = {
  async updateOwnProfile(req, res) {
    const user = await userService.updateOwnProfile(req.user.id, req.body);
    new ApiResponse(200, { user }, 'Profile updated').send(res);
  },
};
