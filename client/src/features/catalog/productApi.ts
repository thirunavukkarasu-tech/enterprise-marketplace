import { apiClient } from '../../services/apiClient';
import type {
  CreateProductInput,
  ManagedProductFilters,
  PaginationMeta,
  Product,
  PublicProductFilters,
  UpdateProductInput,
  VariantInput,
} from '../../types/catalog';

interface Envelope<T> {
  success: boolean;
  message: string;
  data: T;
  meta?: PaginationMeta;
}

interface ProductListResult {
  products: Product[];
  meta: PaginationMeta;
}

async function unwrapList(promise: Promise<{ data: Envelope<{ products: Product[] }> }>): Promise<ProductListResult> {
  const res = await promise;
  return { products: res.data.data.products, meta: res.data.meta! };
}

export const productApi = {
  // ── Public storefront ──────────────────────────────────────────────
  listPublic(filters: PublicProductFilters) {
    return unwrapList(apiClient.get('/products', { params: filters }));
  },

  async getPublicBySlug(slug: string) {
    const res = await apiClient.get<Envelope<{ product: Product }>>(`/products/${slug}`);
    return res.data.data.product;
  },

  // ── Vendor / admin management ─────────────────────────────────────
  listManaged(filters: ManagedProductFilters) {
    return unwrapList(apiClient.get('/products/manage', { params: filters }));
  },

  async getManagedById(id: string) {
    const res = await apiClient.get<Envelope<{ product: Product }>>(`/products/manage/${id}`);
    return res.data.data.product;
  },

  async create(payload: CreateProductInput) {
    const res = await apiClient.post<Envelope<{ product: Product }>>('/products/manage', payload);
    return res.data.data.product;
  },

  async update(id: string, payload: UpdateProductInput) {
    const res = await apiClient.patch<Envelope<{ product: Product }>>(`/products/manage/${id}`, payload);
    return res.data.data.product;
  },

  async remove(id: string) {
    await apiClient.delete(`/products/manage/${id}`);
  },

  // ── Variant / SKU sub-resource ────────────────────────────────────
  async addVariant(productId: string, payload: VariantInput) {
    const res = await apiClient.post<Envelope<{ product: Product }>>(`/products/manage/${productId}/variants`, payload);
    return res.data.data.product;
  },

  async updateVariant(productId: string, variantId: string, payload: Partial<VariantInput>) {
    const res = await apiClient.patch<Envelope<{ product: Product }>>(
      `/products/manage/${productId}/variants/${variantId}`,
      payload
    );
    return res.data.data.product;
  },

  async removeVariant(productId: string, variantId: string) {
    const res = await apiClient.delete<Envelope<{ product: Product }>>(
      `/products/manage/${productId}/variants/${variantId}`
    );
    return res.data.data.product;
  },
};
