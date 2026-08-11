import { configureStore } from '@reduxjs/toolkit';
import authReducer from '../features/auth/authSlice';

export const store = configureStore({
  reducer: {
    auth: authReducer,
    // Phase 3+: cart, catalog, vendor, notifications slices mount here as
    // they're built — each domain owns its own slice file under
    // src/features/<domain>/.
  },
});

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
