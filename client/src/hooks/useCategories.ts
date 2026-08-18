import { useCallback, useEffect, useState } from 'react';
import { categoryApi } from '../features/catalog/categoryApi';
import type { Category } from '../types/catalog';

type Status = 'idle' | 'loading' | 'success' | 'error';

/**
 * Category data is read-only, screen-local state — it doesn't need to
 * live in Redux (see docs/ARCHITECTURE.md: "not every piece of state
 * needs to be global"). This hook is the shared fetch-with-status pattern
 * used by every catalog screen instead of duplicating loading/error
 * handling in each component.
 */
export function useCategories({ managed = false, withCounts = false }: { managed?: boolean; withCounts?: boolean } = {}) {
  const [categories, setCategories] = useState<Category[]>([]);
  const [status, setStatus] = useState<Status>('idle');
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    setStatus('loading');
    setError(null);
    try {
      const result = managed ? await categoryApi.listManaged() : await categoryApi.list({ withCounts });
      setCategories(result);
      setStatus('success');
    } catch (err) {
      const anyErr = err as { response?: { data?: { message?: string } } };
      setError(anyErr.response?.data?.message ?? 'Failed to load categories.');
      setStatus('error');
    }
  }, [managed, withCounts]);

  useEffect(() => {
    refetch();
  }, [refetch]);

  return { categories, status, error, refetch };
}
