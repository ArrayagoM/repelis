import { useEffect, useState } from 'react'
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, Text, View } from 'react-native'
import { useLocalSearchParams, router } from 'expo-router'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { Ionicons } from '@expo/vector-icons'
import { FocusPressable } from '@/components/FocusPressable'
import { PosterCard } from '@/components/PosterCard'
import { backdrop, getDetail, getSeason, poster } from '@/api/tmdb'
import { titleOf, yearOf, type Episode, type MediaType } from '@/api/types'
import { useAsync } from '@/hooks/useAsync'
import { useLayout } from '@/lib/layout'
import { colors, radius } from '@/theme'

const LANG_NAMES: Record<string, string> = {
  en: 'Inglés', es: 'Español', ja: 'Japonés', ko: 'Coreano', fr: 'Francés', it: 'Italiano',
  de: 'Alemán', pt: 'Portugués', zh: 'Chino', hi: 'Hindi', ru: 'Ruso', tr: 'Turco',
}

export default function TitleScreen() {
  const { type, id } = useLocalSearchParams<{ type: string; id: string }>()
  const mediaType: MediaType = type === 'tv' ? 'tv' : 'movie'
  const insets = useSafeAreaInsets()
  const { width, isTablet, isTV, gutter, rowPosterWidth } = useLayout()
  const { data, loading, error, reload } = useAsync(() => getDetail(mediaType, id), [mediaType, id])
  const [season, setSeason] = useState<number | null>(null)
  const [episodes, setEpisodes] = useState<Episode[]>([])
  const [loadingEps, setLoadingEps] = useState(false)

  const seasons = (data?.seasons ?? []).filter((s) => s.season_number > 0)

  useEffect(() => {
    if (mediaType === 'tv' && data && season === null) setSeason(seasons[0]?.season_number ?? 1)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, mediaType])

  useEffect(() => {
    if (mediaType !== 'tv' || season === null) return
    let cancelled = false
    setLoadingEps(true)
    getSeason(id, season)
      .then((eps) => !cancelled && setEpisodes(eps))
      .catch(() => !cancelled && setEpisodes([]))
      .finally(() => !cancelled && setLoadingEps(false))
    return () => {
      cancelled = true
    }
  }, [id, mediaType, season])

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={colors.gold} size="large" />
      </View>
    )
  }
  if (error || !data) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>No se pudo cargar este título.</Text>
        <FocusPressable onPress={reload} style={styles.retry}>
          <Text style={styles.retryText}>Reintentar</Text>
        </FocusPressable>
        <FocusPressable onPress={() => router.back()} style={[styles.retry, { backgroundColor: colors.surface }]}>
          <Text style={[styles.retryText, { color: colors.chalk }]}>Volver</Text>
        </FocusPressable>
      </View>
    )
  }

  const title = titleOf(data)
  const runtime = data.runtime || data.episode_run_time?.[0]
  const wide = isTablet || isTV
  const cover = backdrop(data.backdrop_path, 'w1280')
  const origLang = data.original_language ?? ''
  const origName = LANG_NAMES[origLang] ?? origLang.toUpperCase()
  const similar = data.similar?.results.filter((m) => m.poster_path) ?? []
  const cast = (data.credits?.cast ?? []).filter((c) => c.profile_path).slice(0, 14)

  const details = (
    <>
        <View style={styles.langBox}>
          <Ionicons name={origLang === 'es' ? 'checkmark-circle' : 'volume-high'} size={18} color={origLang === 'es' ? colors.emerald : colors.gold} />
          <Text style={styles.langText}>
            {origLang === 'es'
              ? 'Audio original en español: lo escuchás en tu idioma sin depender de doblaje.'
              : `Idioma original: ${origName}. El doblaje al español no está garantizado: depende del servidor. Si arranca en otro idioma, abrí Audio/CC dentro del reproductor o probá otro servidor.`}
          </Text>
        </View>

        {!!data.overview && <Text style={styles.overview}>{data.overview}</Text>}
    </>
  )

  const play = (s?: number, e?: number) =>
    router.push({
      pathname: `/player/${mediaType}/${id}`,
      params: { title, ...(s ? { season: String(s), episode: String(e ?? 1), seasons: String(seasons.length) } : {}) },
    })

  return (
    <ScrollView style={styles.screen} contentContainerStyle={{ paddingBottom: 48 }} showsVerticalScrollIndicator={false}>
      <View style={{ height: wide ? 380 : 260 }}>
        {cover && <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" transition={300} />}
        <LinearGradient colors={['rgba(8,8,14,0.2)', colors.void]} style={StyleSheet.absoluteFill} />
        <FocusPressable
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          accessibilityLabel="Volver"
          style={[styles.back, { top: insets.top + 8, left: gutter }]}
        >
          <Ionicons name="arrow-back" size={20} color={colors.chalk} />
        </FocusPressable>
      </View>

      <View style={[styles.body, { paddingHorizontal: gutter }, wide && styles.bodyWide]}>
        <Image
          source={{ uri: poster(data.poster_path, 'w500') }}
          style={[styles.poster, wide ? { width: 200, height: 300, marginTop: -120 } : { width: 110, height: 165, marginTop: -90 }]}
          contentFit="cover"
        />
        <View style={styles.info}>
          <Text style={[styles.title, wide && { fontSize: 32 }]}>{title}</Text>
          {!!data.tagline && <Text style={styles.tagline}>“{data.tagline}”</Text>}
          <View style={styles.meta}>
            {!!data.vote_average && (
              <View style={styles.metaItem}>
                <Ionicons name="star" size={14} color={colors.gold} />
                <Text style={styles.metaText}>{data.vote_average.toFixed(1)}</Text>
              </View>
            )}
            {!!yearOf(data) && <Text style={styles.metaText}>{yearOf(data)}</Text>}
            {!!runtime && <Text style={styles.metaText}>{Math.floor(runtime / 60) ? `${Math.floor(runtime / 60)}h ` : ''}{runtime % 60}m</Text>}
            {mediaType === 'tv' && !!data.number_of_seasons && <Text style={styles.metaText}>{data.number_of_seasons} temp.</Text>}
          </View>
          <View style={styles.genres}>
            {data.genres?.map((g) => (
              <Text key={g.id} style={styles.genre}>{g.name}</Text>
            ))}
          </View>

          {mediaType === 'movie' && (
            <FocusPressable hasTVPreferredFocus onPress={() => play()} style={styles.playBtn} accessibilityLabel={`Reproducir ${title}`}>
              <Ionicons name="play" size={20} color={colors.void} />
              <Text style={styles.playText}>Reproducir ahora</Text>
            </FocusPressable>
          )}

          {wide && details}
        </View>
      </View>

      {!wide && <View style={{ paddingHorizontal: gutter }}>{details}</View>}

      {mediaType === 'tv' && (
        <View style={{ paddingHorizontal: gutter, marginTop: 24 }}>
          <Text style={styles.section}>Episodios</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingBottom: 12 }}>
            {seasons.map((s) => (
              <FocusPressable
                key={s.season_number}
                onPress={() => setSeason(s.season_number)}
                focusScale={1.05}
                style={[styles.seasonChip, season === s.season_number && styles.seasonChipActive]}
              >
                <Text style={[styles.seasonText, season === s.season_number && { color: colors.gold }]}>Temporada {s.season_number}</Text>
              </FocusPressable>
            ))}
          </ScrollView>
          {loadingEps ? (
            <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} />
          ) : (
            episodes.map((ep) => (
              <FocusPressable
                key={ep.id}
                onPress={() => play(season ?? 1, ep.episode_number)}
                focusScale={1.02}
                style={styles.episode}
                accessibilityLabel={`Episodio ${ep.episode_number} ${ep.name}`}
              >
                {ep.still_path ? (
                  <Image source={{ uri: backdrop(ep.still_path, 'w780') }} style={styles.still} contentFit="cover" />
                ) : (
                  <View style={[styles.still, styles.stillEmpty]}>
                    <Ionicons name="play-circle-outline" size={28} color={colors.dim} />
                  </View>
                )}
                <View style={{ flex: 1 }}>
                  <Text style={styles.epTitle} numberOfLines={1}>{ep.episode_number}. {ep.name}</Text>
                  {!!ep.overview && <Text style={styles.epOverview} numberOfLines={2}>{ep.overview}</Text>}
                  {!!ep.runtime && <Text style={styles.epMeta}>{ep.runtime} min</Text>}
                </View>
                <Ionicons name="play" size={18} color={colors.gold} />
              </FocusPressable>
            ))
          )}
        </View>
      )}

      {cast.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Text style={[styles.section, { paddingHorizontal: gutter }]}>Reparto</Text>
          <FlatList
            horizontal
            data={cast}
            keyExtractor={(c) => String(c.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: 14 }}
            renderItem={({ item }) => (
              <View style={styles.castItem}>
                <Image source={{ uri: poster(item.profile_path, 'w185') }} style={styles.castPhoto} contentFit="cover" />
                <Text style={styles.castName} numberOfLines={1}>{item.name}</Text>
                {!!item.character && <Text style={styles.castRole} numberOfLines={1}>{item.character}</Text>}
              </View>
            )}
          />
        </View>
      )}

      {similar.length > 0 && (
        <View style={{ marginTop: 28 }}>
          <Text style={[styles.section, { paddingHorizontal: gutter }]}>Similares</Text>
          <FlatList
            horizontal
            data={similar}
            keyExtractor={(m) => String(m.id)}
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
            renderItem={({ item }) => <PosterCard item={item} width={Math.min(rowPosterWidth, width / 3)} mediaType={mediaType} />}
          />
        </View>
      )}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  center: { flex: 1, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', gap: 12 },
  errorText: { color: colors.muted, fontSize: 14 },
  retry: { backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10, borderWidth: 2, borderColor: 'transparent' },
  retryText: { color: colors.void, fontWeight: '800' },
  back: {
    position: 'absolute', width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,8,14,0.6)', borderWidth: 2, borderColor: 'transparent',
  },
  body: { flexDirection: 'row', gap: 16 },
  bodyWide: { gap: 28 },
  poster: { borderRadius: radius.md, backgroundColor: colors.card },
  info: { flex: 1, paddingTop: 12 },
  title: { color: colors.chalk, fontSize: 22, fontWeight: '800' },
  tagline: { color: colors.gold, fontSize: 13, fontStyle: 'italic', marginTop: 4 },
  meta: { flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginTop: 10 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  metaText: { color: colors.muted, fontSize: 13 },
  genres: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  genre: { color: colors.muted, fontSize: 11, borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, overflow: 'hidden' },
  playBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, alignSelf: 'flex-start',
    backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 24, paddingVertical: 12, marginTop: 16,
    borderWidth: 2, borderColor: 'transparent',
  },
  playText: { color: colors.void, fontWeight: '800', fontSize: 15 },
  langBox: {
    flexDirection: 'row', gap: 10, backgroundColor: 'rgba(232,160,32,0.07)', borderRadius: radius.md,
    padding: 12, marginTop: 16, borderWidth: 1, borderColor: 'rgba(232,160,32,0.2)',
  },
  langText: { flex: 1, color: 'rgba(240,237,232,0.85)', fontSize: 12, lineHeight: 17 },
  overview: { color: 'rgba(240,237,232,0.78)', fontSize: 14, lineHeight: 21, marginTop: 14 },
  section: { color: colors.chalk, fontSize: 18, fontWeight: '800', marginBottom: 10 },
  seasonChip: { backgroundColor: colors.surface, borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, borderWidth: 2, borderColor: 'transparent' },
  seasonChipActive: { backgroundColor: 'rgba(232,160,32,0.16)', borderColor: 'rgba(232,160,32,0.5)' },
  seasonText: { color: colors.muted, fontSize: 13, fontWeight: '600' },
  episode: {
    flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card,
    borderRadius: radius.md, padding: 10, marginBottom: 8, borderWidth: 2, borderColor: 'transparent',
  },
  still: { width: 120, height: 68, borderRadius: radius.sm, backgroundColor: colors.surface },
  stillEmpty: { alignItems: 'center', justifyContent: 'center' },
  epTitle: { color: colors.chalk, fontSize: 14, fontWeight: '700' },
  epOverview: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 16 },
  epMeta: { color: colors.dim, fontSize: 11, marginTop: 2 },
  castItem: { width: 84, alignItems: 'center' },
  castPhoto: { width: 72, height: 72, borderRadius: 36, backgroundColor: colors.card },
  castName: { color: colors.chalk, fontSize: 11, fontWeight: '600', marginTop: 6 },
  castRole: { color: colors.muted, fontSize: 10, marginTop: 1 },
})
