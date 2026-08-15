import { useCallback, useEffect, useState } from 'react';
import { vendorApi } from '../features/vendor/vendorApi';
import type { PaginationMeta } from '../types/catalog';
import type { Vendor, VendorListQuery } from '../types/vendor';

type Status = 'idle' | 'loading' | 'success' | 'error';

const EMPTY_META: PaginationMeta = { page: 1, limit: 20, total: 0, totalPages: 1 };

/**
 * Same fetch-with-status pattern as useProducts/useCategories (Phase 3) —
 * admin vendor-list data is screen-local, read-mostly state, not a
 * cross-cutting concern the rest of the app needs, so it doesn't go in
 * Redux (see docs/ARCHITECTURE.md).
 */
export function useVendors(query: VendorListQuery) {
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [meta, setMeta] = useState<PaginationMeta>(EMPTY_META);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const queryKey = JSON.stringify(query);

  const refetch = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = await vendorApi.listAll(query);
      setVendors(result.vendors);
      setMeta(result.meta ?? EMPTY_META);
      setStatus('success');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to load vendors.');
      setStatus('error');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [queryKey]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { vendors, meta, status, error, refetch };
}
