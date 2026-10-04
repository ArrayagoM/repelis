import { FlatList, StyleSheet, Text, View } from 'react-native'
import { PosterCard } from '@/components/PosterCard'
import type { ListFetcher } from '@/api/tmdb'
import type { MediaType } from '@/api/types'
import { useRow } from '@/hooks/useAsync'
import { useLayout } from '@/lib/layout'
import { colors, radius } from '@/theme'

interface Props {
  title: string
  badge?: string
  badgeColor?: string
  fetcher: ListFetcher
  mediaType?: MediaType
}

export function Row({ title, badge, badgeColor = colors.gold, fetcher, mediaType }: Props) {
  const { gutter, rowPosterWidth } = useLayout()
  const { items, loading, error, reload } = useRow(fetcher)

  if (!loading && !error && items.length === 0) return null

  return (
    <View style={styles.section}>
      <View style={[styles.header, { paddingHorizontal: gutter }]}>
        <Text style={styles.title}>{title}</Text>
        {!!badge && (
          <View style={[styles.badge, { borderColor: badgeColor }]}>
            <Text style={[styles.badgeText, { color: badgeColor }]}>{badge}</Text>
          </View>
        )}
      </View>

      {error ? (
        <Text onPress={reload} style={[styles.error, { marginHorizontal: gutter }]}>
          No se pudo cargar. Tocá para reintentar.
        </Text>
      ) : loading ? (
        <View style={[styles.skeletonRow, { paddingHorizontal: gutter }]}>
          {[0, 1, 2, 3, 4].map((i) => (
            <View key={i} style={[styles.skeleton, { width: rowPosterWidth, height: Math.round(rowPosterWidth * 1.5) }]} />
          ))}
        </View>
      ) : (
        <FlatList
          horizontal
          data={items}
          keyExtractor={(m) => String(m.id)}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ paddingHorizontal: gutter, gap: 12 }}
          renderItem={({ item }) => <PosterCard item={item} width={rowPosterWidth} mediaType={mediaType} />}
          initialNumToRender={6}
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
  error: { color: colors.muted, fontSize: 13, paddingVertical: 24 },
  skeletonRow: { flexDirection: 'row', gap: 12 },
  skeleton: { backgroundColor: colors.card, borderRadius: radius.md },
})
