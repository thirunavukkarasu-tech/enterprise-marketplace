import { apiClient } from '../../services/apiClient';
import type { AuthUser } from '../auth/authApi';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
}

export const userApi = {
  /** Reading the current user already exists at GET /auth/me (Phase 2) —
   * not duplicated here. This is only the write side. */
  async updateOwnProfile(payload: { name?: string; phone?: string }) {
    const res = await apiClient.patch<Envelope<{ user: AuthUser }>>('/users/me', payload);
    return res.data.data.user;
  },
};
