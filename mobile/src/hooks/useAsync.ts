import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ListFetcher } from '@/api/tmdb'
import type { MediaItem } from '@/api/types'
import { useLanguageMode } from '@/lib/LanguageProvider'
import { filterResultsByMode } from '@/lib/languageMode'
import { byReleaseDate, isOut } from '@/lib/release'

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

/** Top N: junta 2 páginas para que, después del filtro de idioma, sigan quedando N títulos. */
export function useTop(fetcher: ListFetcher, limit = 10) {
  const { mode } = useLanguageMode()
  const { data, loading, error, reload } = useAsync(async () => {
    const [a, b] = await Promise.all([fetcher(1), fetcher(2).catch(() => null)])
    return [...a.results, ...(b?.results ?? [])]
  }, [fetcher])
  const items = useMemo<MediaItem[]>(() => (data ? filterResultsByMode(data.filter((m) => isOut(m)), mode).slice(0, limit) : []), [data, mode, limit])
  return { items, loading, error, reload }
}

/** Fila del catálogo con el filtro de idioma activo aplicado (primera página). */
export function useRow(fetcher: ListFetcher, opts: { onlyReleased?: boolean; sortByDate?: boolean } = {}) {
  const { onlyReleased = false, sortByDate = false } = opts
  const { mode } = useLanguageMode()
  const { data, loading, error, reload } = useAsync(() => fetcher(1), [fetcher])
  const items = useMemo<MediaItem[]>(() => {
    if (!data) return []
    let list = filterResultsByMode(data.results, mode)
    if (onlyReleased) list = list.filter((m) => isOut(m))
    if (sortByDate) list = [...list].sort(byReleaseDate)
    return list
  }, [data, mode, onlyReleased, sortByDate])
  return { items, loading, error, reload }
}
