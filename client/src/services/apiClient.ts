import axios, { type InternalAxiosRequestConfig } from 'axios';

/**
 * `withCredentials: true` so the httpOnly refresh-token cookie set by the
 * API is sent automatically — the access token itself is kept in memory
 * (Redux), never in localStorage, to limit XSS exposure.
 *
 * `timeout` bounds how long a hung request can occupy the UI. 20s is
 * deliberately generous: the slowest legitimate endpoints in this app
 * are the admin dashboard aggregations and order creation (a multi-
 * document MongoDB transaction), neither of which should be cut off
 * mid-flight by an impatient client default.
 */
export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api/v1',
  withCredentials: true,
  timeout: 20000,
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

/**
 * Requests that must never be silently replayed after a token refresh.
 *
 * The 401-retry below is safe for reads and for idempotent writes, but a
 * payment mutation is neither: `POST /payments` creates a new payment
 * attempt each time it's called, so a transparent retry could produce a
 * second attempt the customer never asked for. If one of these 401s, the
 * refresh still happens (so the session recovers), but the original
 * request is surfaced as an error for the UI to handle deliberately
 * rather than being replayed behind the user's back.
 *
 * `GET /payments/:id` is a read and would be safe, but the whole prefix
 * is excluded rather than pattern-matching method+path — the conservative
 * default is the right one for the only endpoints in this app that move
 * (simulated) money.
 */
function isNonReplayableRequest(config: RetryableConfig | undefined): boolean {
  const url = config?.url ?? '';
  const method = (config?.method ?? 'get').toLowerCase();
  return url.includes('/payments') && method !== 'get';
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
        // Session recovered, but don't replay a payment mutation — let
        // the caller decide whether to re-submit (see above).
        if (isNonReplayableRequest(original)) {
          return Promise.reject(error);
        }
        original.headers = original.headers ?? {};
        original.headers.Authorization = `Bearer ${newToken}`;
        return apiClient(original);
      }

      bridge.onRefreshFailure();
    }

    return Promise.reject(error);
  }
);
