import { apiClient } from '../../services/apiClient';
import type { Role } from '../../types/role';

export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  isEmailVerified: boolean;
  isActive: boolean;
  createdAt: string;
}

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const authApi = {
  async register(payload: { name: string; email: string; password: string; role: 'customer' | 'vendor' }) {
    const res = await apiClient.post<Envelope<{ user: AuthUser }>>('/auth/register', payload);
    return res.data.data;
  },

  async login(payload: { email: string; password: string }) {
    const res = await apiClient.post<Envelope<{ user: AuthUser; accessToken: string }>>('/auth/login', payload);
    return res.data.data;
  },

  async logout() {
    await apiClient.post('/auth/logout');
  },

  /** Silent refresh — relies on the httpOnly cookie, no body needed. */
  async refresh() {
    const res = await apiClient.post<Envelope<{ user: AuthUser; accessToken: string }>>('/auth/refresh');
    return res.data.data;
  },

  async forgotPassword(email: string) {
    const res = await apiClient.post<Envelope<null>>('/auth/forgot-password', { email });
    return res.data.message;
  },

  async resetPassword(payload: { token: string; newPassword: string }) {
    const res = await apiClient.post<Envelope<null>>('/auth/reset-password', payload);
    return res.data.message;
  },

  async verifyEmail(token: string) {
    const res = await apiClient.get<Envelope<null>>(`/auth/verify-email/${token}`);
    return res.data.message;
  },

  async me() {
    const res = await apiClient.get<Envelope<{ user: AuthUser }>>('/auth/me');
    return res.data.data.user;
  },
};
