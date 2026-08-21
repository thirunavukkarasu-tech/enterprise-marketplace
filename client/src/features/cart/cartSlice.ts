import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { cartApi } from './cartApi';
import { logoutUser } from '../auth/authSlice';
import type { Cart, ShippingMethod } from '../../types/cart';

interface CartState {
  cart: Cart | null;
  status: 'idle' | 'loading' | 'loaded' | 'error';
  error: string | null;
  /** Set only while a mutation (add/update/remove/clear) is in flight, so
   * the UI can disable just the control being used, not the whole page. */
  mutating: boolean;
}

const initialState: CartState = {
  cart: null,
  status: 'idle',
  error: null,
  mutating: false,
};

function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message ?? 'Something went wrong. Please try again.';
}

/**
 * Same reasoning as Phase 5's wishlist slice (see
 * docs/ARCHITECTURE.md): the same "how many items are in my cart" fact
 * needs to render in the storefront header badge, on the cart page, and
 * during checkout, all at once — that combination is what makes this a
 * Redux slice rather than a per-page fetch hook.
 */
export const fetchCart = createAsyncThunk('cart/fetch', async (shippingMethod: ShippingMethod | undefined, { rejectWithValue }) => {
  try {
    return await cartApi.getOwn(shippingMethod);
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

export const addCartItem = createAsyncThunk(
  'cart/addItem',
  async (payload: { productId: string; sku: string; quantity?: number }, { rejectWithValue }) => {
    try {
      return await cartApi.addItem(payload);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

export const updateCartItemQuantity = createAsyncThunk(
  'cart/updateItem',
  async (payload: { itemId: string; quantity: number }, { rejectWithValue }) => {
    try {
      return await cartApi.updateItemQuantity(payload.itemId, payload.quantity);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

export const removeCartItem = createAsyncThunk('cart/removeItem', async (itemId: string, { rejectWithValue }) => {
  try {
    return await cartApi.removeItem(itemId);
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

export const clearCart = createAsyncThunk('cart/clear', async (_: void, { rejectWithValue }) => {
  try {
    return await cartApi.clear();
  } catch (err) {
    return rejectWithValue(extractErrorMessage(err));
  }
});

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    cartCleared(state) {
      state.cart = null;
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    const setCart = (state: CartState, action: PayloadAction<Cart>) => {
      state.cart = action.payload;
      state.status = 'loaded';
      state.mutating = false;
      state.error = null;
    };
    const setMutating = (state: CartState) => {
      state.mutating = true;
      state.error = null;
    };
    const setMutationError = (state: CartState, action: { payload: unknown }) => {
      state.mutating = false;
      state.error = action.payload as string;
    };

    builder
      .addCase(fetchCart.pending, (state) => {
        state.status = 'loading';
      })
      .addCase(fetchCart.fulfilled, setCart)
      .addCase(fetchCart.rejected, (state, action) => {
        state.status = 'error';
        state.error = action.payload as string;
      })

      .addCase(addCartItem.pending, setMutating)
      .addCase(addCartItem.fulfilled, setCart)
      .addCase(addCartItem.rejected, setMutationError)

      .addCase(updateCartItemQuantity.pending, setMutating)
      .addCase(updateCartItemQuantity.fulfilled, setCart)
      .addCase(updateCartItemQuantity.rejected, setMutationError)

      .addCase(removeCartItem.pending, setMutating)
      .addCase(removeCartItem.fulfilled, setCart)
      .addCase(removeCartItem.rejected, setMutationError)

      .addCase(clearCart.pending, setMutating)
      .addCase(clearCart.fulfilled, setCart)
      .addCase(clearCart.rejected, setMutationError)

      // Reacts to auth's logout action rather than authSlice importing
      // this one — same one-directional dependency Phase 5's wishlist
      // slice established, keeps the completed Phase 2 authSlice.ts
      // untouched.
      .addCase(logoutUser.fulfilled, (state) => {
        state.cart = null;
        state.status = 'idle';
      });
  },
});

export const { cartCleared } = cartSlice.actions;
export default cartSlice.reducer;
