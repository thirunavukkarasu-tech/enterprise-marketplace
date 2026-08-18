import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { wishlistApi } from './wishlistApi';
import { logoutUser } from '../auth/authSlice';
import type { Product } from '../../types/catalog';

interface WishlistState {
  productIds: string[];
  products: Product[];
  status: 'idle' | 'loading' | 'loaded' | 'error';
}

const initialState: WishlistState = {
  productIds: [],
  products: [],
  status: 'idle',
};

function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message ?? 'Something went wrong. Please try again.';
}

/**
 * Wishlist state is genuinely cross-cutting (unlike catalog browsing
 * state, see docs/ARCHITECTURE.md) — the same "is this wishlisted" fact
 * needs to render consistently on a product card in a grid, on the
 * product detail page, and potentially a header count, all at once. That
 * combination is exactly what Redux is for here; product listings
 * themselves stay in screen-local state via useProducts.
 */
export const fetchWishlist = createAsyncThunk('wishlist/fetch', async (_: void, { rejectWithValue }) => {
  try {
    return await wishlistApi.getOwn();
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

export const addToWishlist = createAsyncThunk('wishlist/add', async (productId: string, { rejectWithValue }) => {
  try {
    return await wishlistApi.add(productId);
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

export const removeFromWishlist = createAsyncThunk('wishlist/remove', async (productId: string, { rejectWithValue }) => {
  try {
    return await wishlistApi.remove(productId);
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

const wishlistSlice = createSlice({
  name: 'wishlist',
  initialState,
  reducers: {
    /** Called on logout — a signed-out session shouldn't keep showing
     * the previous customer's wishlist state. */
    wishlistCleared(state) {
      state.productIds = [];
      state.products = [];
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    const setFromProducts = (state: WishlistState, action: PayloadAction<Product[]>) => {
      state.products = action.payload;
      state.productIds = action.payload.map((p) => p._id);
      state.status = 'loaded';
    };

    builder
      .addCase(fetchWishlist.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchWishlist.fulfilled, setFromProducts)
      .addCase(fetchWishlist.rejected, (state) => {
        state.status = 'error';
      })
      .addCase(addToWishlist.fulfilled, setFromProducts)
      .addCase(removeFromWishlist.fulfilled, setFromProducts)
      // Reacts to auth's logout action rather than authSlice importing
      // this one — keeps the dependency one-directional (wishlist knows
      // about auth, auth doesn't need to know wishlist exists) and
      // avoids touching the completed Phase 2 authSlice.ts at all.
      .addCase(logoutUser.fulfilled, (state) => {
        state.productIds = [];
        state.products = [];
        state.status = 'idle';
      });
  },
});

export const { wishlistCleared } = wishlistSlice.actions;
export default wishlistSlice.reducer;
