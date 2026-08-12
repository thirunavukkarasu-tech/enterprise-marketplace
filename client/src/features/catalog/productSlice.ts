import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { productApi } from './productApi';
import type { ManagedProductFilters, PaginationMeta, Product, PublicProductFilters } from '../../types/catalog';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface ListState {
  items: Product[];
  meta: PaginationMeta | null;
  status: FetchStatus;
  error: string | null;
}

interface ProductState {
  public: ListState;
  managed: ListState;
}

const emptyList = (): ListState => ({ items: [], meta: null, status: 'idle', error: null });

const initialState: ProductState = {
  public: emptyList(),
  managed: emptyList(),
};

function extractErrorMessage(err: unknown): string {
  const anyErr = err as { response?: { data?: { message?: string } } };
  return anyErr.response?.data?.message ?? 'Failed to load products. Please try again.';
}

export const fetchPublicProducts = createAsyncThunk(
  'products/fetchPublic',
  async (filters: PublicProductFilters, { rejectWithValue }) => {
    try {
      return await productApi.listPublic(filters);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

export const fetchManagedProducts = createAsyncThunk(
  'products/fetchManaged',
  async (filters: ManagedProductFilters, { rejectWithValue }) => {
    try {
      return await productApi.listManaged(filters);
    } catch (err) {
      return rejectWithValue(extractErrorMessage(err));
    }
  }
);

const productSlice = createSlice({
  name: 'products',
  initialState,
  reducers: {
    managedListInvalidated(state) {
      // Called after create/update/delete so the next mount refetches
      // rather than showing stale data — simpler and less error-prone
      // than patching individual items in place for a management table.
      state.managed.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPublicProducts.pending, (state) => {
        state.public.status = 'loading';
        state.public.error = null;
      })
      .addCase(fetchPublicProducts.fulfilled, (state, action: PayloadAction<{ products: Product[]; meta: PaginationMeta }>) => {
        state.public.status = 'succeeded';
        state.public.items = action.payload.products;
        state.public.meta = action.payload.meta;
      })
      .addCase(fetchPublicProducts.rejected, (state, action) => {
        state.public.status = 'failed';
        state.public.error = action.payload as string;
      })

      .addCase(fetchManagedProducts.pending, (state) => {
        state.managed.status = 'loading';
        state.managed.error = null;
      })
      .addCase(fetchManagedProducts.fulfilled, (state, action: PayloadAction<{ products: Product[]; meta: PaginationMeta }>) => {
        state.managed.status = 'succeeded';
        state.managed.items = action.payload.products;
        state.managed.meta = action.payload.meta;
      })
      .addCase(fetchManagedProducts.rejected, (state, action) => {
        state.managed.status = 'failed';
        state.managed.error = action.payload as string;
      });
  },
});

export const { managedListInvalidated } = productSlice.actions;
export default productSlice.reducer;
