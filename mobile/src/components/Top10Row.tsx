import { FlatList, StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FocusPressable } from '@/components/FocusPressable'
import { resolveType } from '@/components/PosterCard'
import { poster, type ListFetcher } from '@/api/tmdb'
import { titleOf, type MediaItem, type MediaType } from '@/api/types'
import { useTop } from '@/hooks/useAsync'
import { useLayout } from '@/lib/layout'
import { colors, radius } from '@/theme'

interface Props {
  title: string
  badge?: string
  badgeColor?: string
  fetcher: ListFetcher
  mediaType?: MediaType
}

// Ranking "Top 10": número grande detrás de cada póster.
export function Top10Row({ title, badge = 'Hoy', badgeColor = colors.gold, fetcher, mediaType }: Props) {
  const { gutter, rowPosterWidth, isTV } = useLayout()
  const { items, loading, error, reload } = useTop(fetcher, 10)
  const posterW = Math.round(rowPosterWidth * 0.92)
  const numeralSize = Math.round(posterW * 1.25)

  if (!loading && !error && items.length === 0) return null

  const renderItem = ({ item, index }: { item: MediaItem; index: number }) => {
    const type = resolveType(item, mediaType)
    const name = titleOf(item)
    const uri = poster(item.poster_path)
    return (
      <FocusPressable
        onPress={() => router.push(`/title/${type}/${item.id}`)}
        accessibilityLabel={`Puesto ${index + 1}: ${name}`}
        focusScale={1.05}
        style={styles.item}
      >
        <Text style={[styles.numeral, { fontSize: numeralSize, lineHeight: numeralSize * 0.9, width: index === 9 ? numeralSize * 1.25 : numeralSize * 0.62 }]}>
          {index + 1}
        </Text>
        <View style={[styles.poster, { width: posterW, height: Math.round(posterW * 1.5) }]}>
          {uri ? (
            <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={String(item.id)} />
          ) : (
            <View style={styles.noImage}>
              <Ionicons name="film-outline" size={26} color={colors.dim} />
            </View>
          )}
        </View>
      </FocusPressable>
    )
  }

  return (
    <View style={styles.section}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <View style={[styles.badge, { borderColor: badgeColor }]}>
          <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
        </View>
        <Text style={[styles.title, isTV && { fontSize: 24 }]}>{title}</Text>
      </View>

      {error ? (
        <Text onPress={reload} style={[styles.error, { marginHorizontal: gutter }]}>No se pudo cargar. Tocá para reintentar.</Text>
      ) : loading ? (
        <View style={[styles.skeletonRow, { paddingHorizontal: gutter }]}>
          {[0, 1, 2].map((i) => (
            <View key={i} style={[styles.skeleton, { width: posterW, height: Math.round(posterW * 1.5) }]} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(m) => String(m.id)}
          renderItem={renderItem}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 6 }}
          initialNumToRender={4}
          windowSize={5}
        />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  section: { marginBottom: 24 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 },
  title: { color: colors.chalk, fontSize: 18, fontWeight: '800' },
  badge: { borderWidth: 1, borderRadius: radius.pill, paddingHorizontal: 8, paddingVertical: 2 },
  badgeText: { fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  item: { flexDirection: 'row', alignItems: 'flex-end', borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  numeral: {
    color: colors.gold, opacity: 0.4, fontWeight: '900', textAlign: 'right', marginRight: -8, marginBottom: 4,
    includeFontPadding: false,
  },
  poster: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  error: { color: colors.muted, fontSize: 13, paddingVertical: 24 },
  skeletonRow: { flexDirection: 'row', gap: 12 },
  skeleton: { backgroundColor: colors.card, borderRadius: radius.md },
})
