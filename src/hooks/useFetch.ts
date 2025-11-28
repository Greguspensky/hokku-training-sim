/**
 * useFetch Hook
 * Consolidates 47+ duplicate useEffect data loading patterns
 * Handles loading, error, and success states automatically
 */

'use client';

import { useState, useEffect, useCallback } from 'react';

export interface UseFetchOptions extends RequestInit {
  skip?: boolean; // Skip the automatic fetch
  onSuccess?: (data: any) => void;
  onError?: (error: string) => void;
}

export interface UseFetchResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook for fetching data with automatic loading/error/success state management
 *
 * @param url - The URL to fetch from (null to skip fetching)
 * @param options - Fetch options and hook configuration
 * @returns Object with data, loading, error, and refetch function
 *
 * @example
 * ```typescript
 * const { data: categories, loading, error } = useFetch<KnowledgeCategory[]>(
 *   companyId ? `/api/knowledge-base/categories?company_id=${companyId}` : null
 * );
 * ```
 */
export function useFetch<T = any>(
  url: string | null,
  options?: UseFetchOptions
): UseFetchResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!url || options?.skip) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(url, {
        method: options?.method || 'GET',
        headers: options?.headers,
        body: options?.body,
        ...options
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP error! status: ${response.status}`);
      }

      if (result.success === false) {
        throw new Error(result.error || 'Request failed');
      }

      // Handle both { success: true, data: ... } and { success: true, ... } formats
      const fetchedData = result.data !== undefined ? result.data : result;
      setData(fetchedData);

      if (options?.onSuccess) {
        options.onSuccess(fetchedData);
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch data';
      setError(errorMessage);
      console.error('useFetch error:', errorMessage, 'URL:', url);

      if (options?.onError) {
        options.onError(errorMessage);
      }
    } finally {
      setLoading(false);
    }
  }, [url, JSON.stringify(options)]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch: fetchData
  };
}

/**
 * Hook for lazy fetching (manual trigger)
 * Same as useFetch but doesn't fetch automatically on mount
 *
 * @param url - The URL to fetch from
 * @param options - Fetch options
 * @returns Object with data, loading, error, and fetch function
 *
 * @example
 * ```typescript
 * const { data, loading, fetch: loadCategories } = useLazyFetch<Category[]>(
 *   `/api/categories?company_id=${companyId}`
 * );
 *
 * // Later, trigger the fetch manually
 * await loadCategories();
 * ```
 */
export function useLazyFetch<T = any>(
  url: string,
  options?: UseFetchOptions
): UseFetchResult<T> & { fetch: () => Promise<void> } {
  const result = useFetch<T>(url, { ...options, skip: true });

  return {
    ...result,
    fetch: result.refetch
  };
}
