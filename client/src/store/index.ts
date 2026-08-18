import { configureStore } from '@reduxjs/toolkit';
import authReducer, { sessionCleared, bootstrapSession } from '../features/auth/authSlice';
import wishlistReducer, { wishlistCleared } from '../features/wishlist/wishlistSlice';
import { configureAuthBridge } from '../services/apiClient';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    wishlist: wishlistReducer,
    // Phase 6+: cart, notifications slices mount here as they're built —
    // each domain owns its own slice file under src/features/<domain>/.
  },
});

/**
 * Wire apiClient's auth bridge to the real store now that it exists.
 * apiClient can't import `store` directly (see apiClient.ts) — this is
 * the one place that closes the loop, right after creation. The bridge's
 * refresh() reuses the same `bootstrapSession` thunk the app calls on
 * mount, so there's exactly one code path that talks to /auth/refresh and
 * updates the auth slice — not a second, parallel one.
 */
configureAuthBridge({
  getAccessToken: () => store.getState().auth.accessToken,
  refresh: async () => {
    try {
      const result = await store.dispatch(bootstrapSession()).unwrap();
      return result.accessToken;
    } catch {
      return null;
    }
  },
  onRefreshFailure: () => {
    store.dispatch(sessionCleared());
    store.dispatch(wishlistCleared());
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
