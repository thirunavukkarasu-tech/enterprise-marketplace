import { authService } from '../services/authService.js';
import { ApiResponse } from '../utils/ApiResponse.js';
import { setRefreshCookie, clearRefreshCookie, REFRESH_COOKIE_NAME } from '../utils/cookies.js';

export const authController = {
  async register(req, res) {
    const user = await authService.register(req.body);
    new ApiResponse(201, { user }, 'Registration successful. Please check your email to verify your account.').send(
      res
    );
  },

  async login(req, res) {
    const { user, accessToken, refreshTokenRaw } = await authService.login({
      ...req.body,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, refreshTokenRaw);
    new ApiResponse(200, { user, accessToken }, 'Login successful').send(res);
  },

  async refresh(req, res) {
    const refreshTokenRaw = req.cookies?.[REFRESH_COOKIE_NAME];
    const { user, accessToken, refreshTokenRaw: rotated } = await authService.refresh({
      refreshTokenRaw,
      ip: req.ip,
      userAgent: req.headers['user-agent'],
    });
    setRefreshCookie(res, rotated);
    new ApiResponse(200, { user, accessToken }, 'Token refreshed').send(res);
  },

  async logout(req, res) {
    const refreshTokenRaw = req.cookies?.[REFRESH_COOKIE_NAME];
    await authService.logout({ refreshTokenRaw });
    clearRefreshCookie(res);
    new ApiResponse(200, null, 'Logged out').send(res);
  },

  async forgotPassword(req, res) {
    await authService.forgotPassword(req.body);
    // Uniform response regardless of whether the account exists.
    new ApiResponse(200, null, 'If an account with that email exists, a reset link has been sent.').send(res);
  },

  async resetPassword(req, res) {
    await authService.resetPassword(req.body);
    new ApiResponse(200, null, 'Password reset successful. Please log in with your new password.').send(res);
  },

  async verifyEmail(req, res) {
    await authService.verifyEmail({ token: req.params.token });
    new ApiResponse(200, null, 'Email verified successfully.').send(res);
  },

  async me(req, res) {
    const user = await authService.getMe(req.user.id);
    new ApiResponse(200, { user }).send(res);
  },
};
