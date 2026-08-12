import { createSlice, createAsyncThunk, type PayloadAction } from '@reduxjs/toolkit';
import { categoryApi } from './categoryApi';
import type { Category } from '../../types/catalog';

type FetchStatus = 'idle' | 'loading' | 'succeeded' | 'failed';

interface CategoryState {
  items: Category[];
  status: FetchStatus;
  error: string | null;
}

const initialState: CategoryState = { items: [], status: 'idle', error: null };

export const fetchCategories = createAsyncThunk(
  'categories/fetchAll',
  async (params: { includeInactive?: boolean } = {}, { rejectWithValue }) => {
    try {
      return await categoryApi.list(params);
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      return rejectWithValue(anyErr.response?.data?.message ?? 'Failed to load categories.');
    }
  }
);

const categorySlice = createSlice({
  name: 'categories',
  initialState,
  reducers: {
    categoriesInvalidated(state) {
      state.status = 'idle';
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchCategories.pending, (state) => {
        state.status = 'loading';
        state.error = null;
      })
      .addCase(fetchCategories.fulfilled, (state, action: PayloadAction<Category[]>) => {
        state.status = 'succeeded';
        state.items = action.payload;
      })
      .addCase(fetchCategories.rejected, (state, action) => {
        state.status = 'failed';
        state.error = action.payload as string;
      });
  },
});

export const { categoriesInvalidated } = categorySlice.actions;
export default categorySlice.reducer;
