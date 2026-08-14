import { useCallback, useEffect, useState } from 'react';
import { productApi } from '../features/catalog/productApi';
import type { PaginationMeta, Product, ProductListQuery } from '../types/catalog';

type Status = 'idle' | 'loading' | 'success' | 'error';

const EMPTY_META: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 1 };

/**
 * Shared fetch-with-status hook for both the public storefront listing
 * and the vendor/admin managed listing — same shape, different endpoint
 * and query params. Re-fetches whenever `query` changes (by value, via
 * JSON.stringify in the dependency), so search/filter/sort/page controls
 * just need to update `query` and this hook does the rest.
 */
export function useProducts(query: ProductListQuery, { managed = false }: { managed?: boolean } = {}) {
  const [products, setProducts] = useState<Product[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify(query);

  const refetch = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = managed ? await productApi.listManaged(query) : await productApi.listPublic(query);
      setProducts(result.products);
      setMeta(result.meta ?? EMPTY_META);
      setStatus('success');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to load products.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey, managed]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { products, meta, status, error, refetch };
}
