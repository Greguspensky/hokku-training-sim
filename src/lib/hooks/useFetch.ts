import { useState, useEffect, useCallback } from 'react'

export interface UseFetchOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  body?: any
  headers?: Record<string, string>
  skip?: boolean // Skip the fetch if true
  onSuccess?: (data: T) => void
  onError?: (error: Error) => void
  transform?: (data: any) => T // Transform response data
}

export interface UseFetchResult<T> {
  data: T | null
  loading: boolean
  error: Error | null
  refetch: () => Promise<void>
  reset: () => void
}

/**
 * Custom hook for making API requests with loading, error, and data states
 *
 * @example
 * ```tsx
 * const { data, loading, error, refetch } = useFetch<User>('/api/user', {
 *   method: 'GET',
 *   onSuccess: (user) => console.log('User loaded:', user)
 * })
 * ```
 */
export function useFetch<T = any>(
  url: string | null,
  options: UseFetchOptions<T> = {}
): UseFetchResult<T> {
  const {
    method = 'GET',
    body,
    headers = {},
    skip = false,
    onSuccess,
    onError,
    transform
  } = options

  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<Error | null>(null)

  const fetchData = useCallback(async () => {
    if (!url || skip) return

    setLoading(true)
    setError(null)

    try {
      const fetchOptions: RequestInit = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      }

      if (body && method !== 'GET') {
        fetchOptions.body = JSON.stringify(body)
      }

      const response = await fetch(url, fetchOptions)

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: response.statusText }))
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`)
      }

      const responseData = await response.json()
      const finalData = transform ? transform(responseData) : responseData

      setData(finalData)
      onSuccess?.(finalData)
    } catch (err) {
      const error = err instanceof Error ? err : new Error('An unknown error occurred')
      setError(error)
      onError?.(error)
    } finally {
      setLoading(false)
    }
  }, [url, method, body, headers, skip, onSuccess, onError, transform])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const reset = useCallback(() => {
    setData(null)
    setError(null)
    setLoading(false)
  }, [])

  return {
    data,
    loading,
    error,
    refetch: fetchData,
    reset
  }
}

/**
 * Hook for lazy fetching - doesn't auto-fetch on mount
 *
 * @example
 * ```tsx
 * const { data, loading, fetch } = useLazyFetch<User>()
 *
 * const handleClick = () => {
 *   fetch('/api/user')
 * }
 * ```
 */
export function useLazyFetch<T = any>(
  options: Omit<UseFetchOptions<T>, 'skip'> = {}
) {
  const [url, setUrl] = useState<string | null>(null)

  const result = useFetch<T>(url, { ...options, skip: !url })

  const fetch = useCallback((fetchUrl: string, fetchBody?: any) => {
    if (fetchBody) {
      options.body = fetchBody
    }
    setUrl(fetchUrl)
  }, [options])

  return {
    ...result,
    fetch
  }
}
