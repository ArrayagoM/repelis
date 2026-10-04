import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ListFetcher } from '@/api/tmdb'
import type { MediaItem } from '@/api/types'
import { useLanguageMode } from '@/lib/LanguageProvider'
import { filterResultsByMode } from '@/lib/languageMode'

interface AsyncState<T> {
  data: T | null
  loading: boolean
  error: Error | null
}

export function useAsync<T>(fn: () => Promise<T>, deps: readonly unknown[]) {
  const [state, setState] = useState<AsyncState<T>>({ data: null, loading: true, error: null })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true, error: null }))
    fn()
      .then((data) => {
        if (!cancelled) setState({ data, loading: false, error: null })
      })
      .catch((error: unknown) => {
        if (!cancelled) setState({ data: null, loading: false, error: error instanceof Error ? error : new Error(String(error)) })
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { ...state, reload }
}

/** Fila del catálogo con el filtro de idioma activo aplicado (primera página). */
export function useRow(fetcher: ListFetcher) {
  const { mode } = useLanguageMode()
  const { data, loading, error, reload } = useAsync(() => fetcher(1), [fetcher])
  const items = useMemo<MediaItem[]>(() => (data ? filterResultsByMode(data.results, mode) : []), [data, mode])
  return { items, loading, error, reload }
}
