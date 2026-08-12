import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { authApi, type AuthUser } from './authApi';

type Status = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: Status;
  error: string | null;
}

const initialState: AuthState = {
  user: null,
  accessToken: null,
  status: 'idle',
  error: null,
};

function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message ?? 'Something went wrong. Please try again.';
}

export const registerUser = createAsyncThunk(
  'auth/register',
  async (payload: { name: string; email: string; password: string; role: 'customer' | 'vendor' }, { rejectWithValue }) => {
    try {
      return await authApi.register(payload);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

export const loginUser = createAsyncThunk(
  'auth/login',
  async (payload: { email: string; password: string }, { rejectWithValue }) => {
    try {
      return await authApi.login(payload);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

export const logoutUser = createAsyncThunk('auth/logout', async () => {
  await authApi.logout();
});

/**
 * Silent bootstrap: called once when the app mounts. There's no access
 * token in memory yet after a page reload (it was never persisted on
 * purpose), so this asks the API to mint a new one from the httpOnly
 * refresh cookie, if a valid session still exists. A failure here just
 * means "not logged in" — not an error worth surfacing.
 */
export const bootstrapSession = createAsyncThunk('auth/bootstrap', async (_: void, { rejectWithValue }) => {
  try {
    return await authApi.refresh();
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    sessionCleared(state) {
      state.user = null;
      state.accessToken = null;
      state.status = 'unauthenticated';
    },
  },
  extraReducers: (builder) => {
    builder
      // register
      .addCase(registerUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(registerUser.fulfilled, (state) => {
        // Registration doesn't log the user in automatically — email
        // verification is expected first. Reset to unauthenticated so
        // the UI routes them to "check your email", not a dashboard.
        state.status = 'unauthenticated';
      })
      .addCase(registerUser.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload as string;
      })

      // login
      .addCase(loginUser.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(loginUser.fulfilled, (state, action: PayloadAction<{ user: AuthUser; accessToken: string }>) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(loginUser.rejected, (state, action) => {
        state.status = 'unauthenticated';
        state.error = action.payload as string;
      })

      // logout
      .addCase(logoutUser.fulfilled, (state) => {
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
      })

      // bootstrap (silent refresh on app load)
      .addCase(bootstrapSession.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(bootstrapSession.fulfilled, (state, action: PayloadAction<{ user: AuthUser; accessToken: string }>) => {
        state.user = action.payload.user;
        state.accessToken = action.payload.accessToken;
        state.status = 'authenticated';
      })
      .addCase(bootstrapSession.rejected, (state) => {
        // No valid session cookie — this is the normal "signed out" case,
        // not an error to show the user.
        state.user = null;
        state.accessToken = null;
        state.status = 'unauthenticated';
      });
  },
});

export const { sessionCleared } = authSlice.actions;
export default authSlice.reducer;
