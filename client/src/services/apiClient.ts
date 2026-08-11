import axios from 'axios';

/**
 * `withCredentials: true` so the httpOnly refresh-token cookie set by the
 * API (Phase 2) is sent automatically — the access token itself is kept
 * in memory (Redux), never in localStorage, to limit XSS exposure.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

// Response interceptor placeholder: Phase 2 adds silent-refresh-on-401
// logic here (single-flight refresh + retry the original request).
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(error)
);
