import { useCallback, useEffect, useRef, useState } from 'react'
import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { FocusPressable } from '@/components/FocusPressable'
import { PosterGrid } from '@/components/PosterGrid'
import { getGenres, movies, tv, type ListFetcher } from '@/api/tmdb'
import type { Genre, MediaItem, MediaType } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { useLayout } from '@/lib/layout'
import { useLanguageMode } from '@/lib/LanguageProvider'
import { filterResultsByMode, getDiscoverParamsForMode } from '@/lib/languageMode'
import { colors, radius } from '@/theme'

interface Category {
  key: string
  label: string
  fetcher: ListFetcher
}

const CATEGORIES: Record<MediaType, Category[]> = {
  movie: [
    { key: 'popular', label: 'Populares', fetcher: movies.popular },
    { key: 'trending', label: 'Tendencias', fetcher: movies.trending },
    { key: 'topRated', label: 'Mejor valoradas', fetcher: movies.topRated },
    { key: 'nowPlaying', label: 'En cartelera', fetcher: movies.nowPlaying },
    { key: 'upcoming', label: 'Próximos', fetcher: movies.upcoming },
    { key: 'classics', label: 'Clásicos', fetcher: movies.classics },
    { key: 'animeMovies', label: 'Anime', fetcher: movies.animeMovies },
  ],
  tv: [
    { key: 'popular', label: 'Populares', fetcher: tv.popular },
    { key: 'trending', label: 'Tendencias', fetcher: tv.trending },
    { key: 'topRated', label: 'Mejor valoradas', fetcher: tv.topRated },
    { key: 'airingToday', label: 'Al aire hoy', fetcher: tv.airingToday },
    { key: 'anime', label: 'Anime', fetcher: tv.anime },
    { key: 'kdrama', label: 'K-Drama', fetcher: tv.kdrama },
  ],
}

type Selection = { kind: 'cat'; key: string } | { kind: 'genre'; id: number }

const MAX_PAGES_PER_LOAD = 5
const MIN_NEW_ITEMS = 12

export function Browse({ type, title }: { type: MediaType; title: string }) {
  const insets = useSafeAreaInsets()
  const { gutter } = useLayout()
  const { mode } = useLanguageMode()
  const [selection, setSelection] = useState<Selection>({ kind: 'cat', key: 'popular' })
  const [items, setItems] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const pageRef = useRef(0)
  const totalPagesRef = useRef(1)
  const loadingRef = useRef(false)
  const runRef = useRef(0)

  const { data: genres } = useAsync<Genre[]>(() => getGenres(type), [type])

  const fetchPage = useCallback(
    async (page: number) => {
      if (selection.kind === 'genre') {
        const base = type === 'movie' ? movies.discover : tv.discover
        return base(page, { with_genres: selection.id, ...getDiscoverParamsForMode(mode) })
      }
      const cat = CATEGORIES[type].find((c) => c.key === selection.key) ?? CATEGORIES[type][0]
      return cat.fetcher(page)
    },
    [selection, type, mode],
  )

  const loadMore = useCallback(async () => {
    if (loadingRef.current || pageRef.current >= totalPagesRef.current) return
    loadingRef.current = true
    setLoading(true)
    const run = runRef.current
    try {
      let added = 0
      let guard = 0
      while (added < MIN_NEW_ITEMS && pageRef.current < totalPagesRef.current && guard < MAX_PAGES_PER_LOAD) {
        const next = pageRef.current + 1
        const res = await fetchPage(next)
        if (run !== runRef.current) return
        pageRef.current = next
        totalPagesRef.current = Math.min(res.total_pages, 500)
        // los discover ya vienen filtrados por el servidor; las categorías se filtran en cliente
        const fresh = selection.kind === 'genre' ? res.results : filterResultsByMode(res.results, mode)
        added += fresh.length
        setItems((prev) => {
          const seen = new Set(prev.map((m) => m.id))
          return [...prev, ...fresh.filter((m) => !seen.has(m.id))]
        })
        guard++
      }
    } catch {
      // se queda con lo cargado; el usuario puede seguir scrolleando para reintentar
    } finally {
      if (run === runRef.current) {
        loadingRef.current = false
        setLoading(false)
      }
    }
  }, [fetchPage, selection.kind, mode])

  useEffect(() => {
    runRef.current += 1
    pageRef.current = 0
    totalPagesRef.current = 1
    loadingRef.current = false
    setItems([])
    loadMore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selection, type, mode])

  const selectedKey = selection.kind === 'cat' ? `c:${selection.key}` : `g:${selection.id}`

  const chips = (
    <View style={{ marginHorizontal: -gutter }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingHorizontal: gutter }]}>
        {CATEGORIES[type].map((c) => (
          <Chip key={c.key} label={c.label} active={selectedKey === `c:${c.key}`} onPress={() => setSelection({ kind: 'cat', key: c.key })} />
        ))}
      </ScrollView>
      {!!genres && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={[styles.chips, { paddingHorizontal: gutter }]}>
          {genres.map((g) => (
            <Chip key={g.id} label={g.name} subtle active={selectedKey === `g:${g.id}`} onPress={() => setSelection({ kind: 'genre', id: g.id })} />
          ))}
        </ScrollView>
      )}
    </View>
  )

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { paddingHorizontal: gutter }]}>{title}</Text>
      <PosterGrid
        items={items}
        mediaType={type}
        loading={loading}
        onEndReached={loadMore}
        header={chips}
        empty="No encontramos títulos con este filtro. Probá otro género o cambiá el modo de idioma en “Más”."
      />
    </View>
  )
}

function Chip({ label, active, subtle, onPress }: { label: string; active: boolean; subtle?: boolean; onPress: () => void }) {
  return (
    <FocusPressable
      onPress={onPress}
      focusScale={1.05}
      style={[styles.chip, subtle && styles.chipSubtle, active && styles.chipActive]}
      accessibilityState={{ selected: active }}
    >
      <Text style={[styles.chipText, active && styles.chipTextActive]}>{label}</Text>
    </FocusPressable>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  title: { color: colors.chalk, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  chips: { gap: 8, paddingVertical: 6 },
  chip: {
    borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8,
    backgroundColor: colors.surface, borderWidth: 2, borderColor: 'transparent',
  },
  chipSubtle: { backgroundColor: colors.card },
  chipActive: { backgroundColor: 'rgba(232,160,32,0.16)', borderColor: 'rgba(232,160,32,0.5)' },
  chipText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  chipTextActive: { color: colors.gold },
})
