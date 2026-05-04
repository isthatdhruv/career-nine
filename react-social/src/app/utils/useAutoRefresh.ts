import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Trigger-only auto-refresh: runs `callback` every `intervalMs` while the
 * component is mounted, and again whenever the tab regains focus/visibility.
 * The component keeps its own state; this hook does not manage data.
 */
export function useRefreshInterval(
  callback: () => void,
  options: { intervalMs?: number; skip?: boolean; refreshOnFocus?: boolean } = {}
) {
  const { intervalMs = 20_000, skip = false, refreshOnFocus = true } = options
  const cbRef = useRef(callback)
  cbRef.current = callback

  useEffect(() => {
    if (skip) return
    const interval = intervalMs > 0
      ? window.setInterval(() => { cbRef.current() }, intervalMs)
      : null
    const onVisible = () => {
      if (document.visibilityState === 'visible') cbRef.current()
    }
    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
    }
    return () => {
      if (interval !== null) window.clearInterval(interval)
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', onVisible)
      }
    }
  }, [intervalMs, skip, refreshOnFocus])
}

export interface UseAutoRefreshOptions {
  intervalMs?: number
  skip?: boolean
  refreshOnFocus?: boolean
}

export interface UseAutoRefreshResult<T> {
  data: T | undefined
  loading: boolean
  error: unknown
  refetch: (opts?: { silent?: boolean }) => Promise<void>
}

const DEFAULT_INTERVAL_MS = 20_000

export function useAutoRefresh<T>(
  fetchFn: () => Promise<T>,
  options: UseAutoRefreshOptions = {}
): UseAutoRefreshResult<T> {
  const { intervalMs = DEFAULT_INTERVAL_MS, skip = false, refreshOnFocus = true } = options

  const [data, setData] = useState<T | undefined>(undefined)
  const [loading, setLoading] = useState<boolean>(!skip)
  const [error, setError] = useState<unknown>(undefined)

  const fetchRef = useRef(fetchFn)
  fetchRef.current = fetchFn

  const mountedRef = useRef(true)

  const refetch = useCallback(async (opts?: { silent?: boolean }) => {
    if (!opts?.silent) setLoading(true)
    try {
      const result = await fetchRef.current()
      if (mountedRef.current) {
        setData(result)
        setError(undefined)
      }
    } catch (e) {
      if (mountedRef.current) setError(e)
    } finally {
      if (mountedRef.current && !opts?.silent) setLoading(false)
    }
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (skip) return
    refetch()

    const interval = intervalMs > 0
      ? window.setInterval(() => { refetch({ silent: true }) }, intervalMs)
      : null

    const onVisible = () => {
      if (document.visibilityState === 'visible') refetch({ silent: true })
    }

    if (refreshOnFocus) {
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', onVisible)
    }

    return () => {
      if (interval !== null) window.clearInterval(interval)
      if (refreshOnFocus) {
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', onVisible)
      }
    }
  }, [skip, intervalMs, refreshOnFocus, refetch])

  return { data, loading, error, refetch }
}
