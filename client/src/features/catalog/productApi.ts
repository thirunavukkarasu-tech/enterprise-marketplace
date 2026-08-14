import { apiClient } from '../../services/apiClient';
import type { PaginationMeta, Product, ProductInput, ProductListQuery, ProductStatus } from '../../types/catalog';

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

function toQueryString(query: ProductListQuery = {}): string {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value !== undefined && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export const productApi = {
  /** Public storefront listing — always active-only, enforced server-side. */
  async listPublic(query?: ProductListQuery): Promise<ProductListResult> {
    const res = await apiClient.get<Envelope<{ products: Product[] }>>(`/products${toQueryString(query)}`);
    return { products: res.data.data.products, meta: res.data.meta as PaginationMeta };
  },

  async getPublicBySlug(slug: string) {
    const res = await apiClient.get<Envelope<{ product: Product }>>(`/products/slug/${slug}`);
    return res.data.data.product;
  },

  /** Vendor sees only their own products; admin may pass `vendor` to filter any. */
  async listManaged(query?: ProductListQuery): Promise<ProductListResult> {
    const res = await apiClient.get<Envelope<{ products: Product[] }>>(`/products/manage${toQueryString(query)}`);
    return { products: res.data.data.products, meta: res.data.meta as PaginationMeta };
  },

  async getManagedById(id: string) {
    const res = await apiClient.get<Envelope<{ product: Product }>>(`/products/manage/${id}`);
    return res.data.data.product;
  },

  async create(payload: ProductInput) {
    const res = await apiClient.post<Envelope<{ product: Product }>>('/products/manage', payload);
    return res.data.data.product;
  },

  async update(id: string, payload: Partial<ProductInput>) {
    const res = await apiClient.patch<Envelope<{ product: Product }>>(`/products/manage/${id}`, payload);
    return res.data.data.product;
  },

  async updateStatus(id: string, status: ProductStatus) {
    const res = await apiClient.patch<Envelope<{ product: Product }>>(`/products/manage/${id}/status`, { status });
    return res.data.data.product;
  },

  async remove(id: string) {
    await apiClient.delete(`/products/manage/${id}`);
  },

  async addVariant(id: string, variant: ProductInput['variants'][number]) {
    const res = await apiClient.post<Envelope<{ product: Product }>>(`/products/manage/${id}/variants`, variant);
    return res.data.data.product;
  },

  async updateVariant(id: string, sku: string, payload: Partial<ProductInput['variants'][number]>) {
    const res = await apiClient.patch<Envelope<{ product: Product }>>(`/products/manage/${id}/variants/${sku}`, payload);
    return res.data.data.product;
  },

  async removeVariant(id: string, sku: string) {
    const res = await apiClient.delete<Envelope<{ product: Product }>>(`/products/manage/${id}/variants/${sku}`);
    return res.data.data.product;
  },
};
