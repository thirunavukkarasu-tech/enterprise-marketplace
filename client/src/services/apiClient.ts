import axios, { type InternalAxiosRequestConfig } from 'axios';

/**
 * `withCredentials: true` so the httpOnly refresh-token cookie set by the
 * API is sent automatically — the access token itself is kept in memory
 * (Redux), never in localStorage, to limit XSS exposure.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1',
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
});

/**
 * apiClient can't import the Redux store directly — the store's slices
 * (authSlice) live above apiClient in the dependency graph, and importing
 * the store here would create a cycle. Instead, `store/index.ts` calls
 * `configureAuthBridge(...)` once, right after the store is created,
 * wiring these three functions to real Redux state/dispatch. Until that
 * happens, the bridge is a harmless no-op (useful in tests).
 */
interface AuthBridge {
  getAccessToken: () => string | null;
  refresh: () => Promise<string | null>;
  onRefreshFailure: () => void;
}

let bridge: AuthBridge = {
  getAccessToken: () => null,
  refresh: async () => null,
  onRefreshFailure: () => {},
};

export function configureAuthBridge(next: AuthBridge) {
  bridge = next;
}

// Attach the current access token to every outgoing request.
apiClient.interceptors.request.use((config) => {
  const token = bridge.getAccessToken();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Single-flight refresh: if several requests 401 at once, only one
// refresh call is made and every request waits on the same promise.
let refreshInFlight: Promise<string | null> | null = null;

interface RetryableConfig extends InternalAxiosRequestConfig {
  _retried?: boolean;
}

apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config as RetryableConfig | undefined;
    const status = error.response?.status;
    const isAuthEndpoint = original?.url?.includes('/auth/login') || original?.url?.includes('/auth/refresh');

    if (status === 401 && original && !original._retried && !isAuthEndpoint) {
      original._retried = true;

      if (!refreshInFlight) {
        refreshInFlight = bridge.refresh().finally(() => {
          refreshInFlight = null;
        });
      }

      const newToken = await refreshInFlight;

      if (newToken) {
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }

      bridge.onRefreshFailure();
    }

    return Promise.reject(error);
  }
);
