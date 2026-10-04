import { useMemo, type ReactElement } from 'react'
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native'
import { PosterCard } from '@/components/PosterCard'
import type { MediaItem, MediaType } from '@/api/types'
import { useLayout } from '@/lib/layout'
import { colors } from '@/theme'

interface Props {
  items: MediaItem[]
  mediaType?: MediaType
  loading?: boolean
  onEndReached?: () => void
  header?: ReactElement
  empty?: string
}

const GAP = 12

// Grilla adaptable: 3 columnas en celular, 5 en tablet, 6-8 en pantallas grandes / TV.
export function PosterGrid({ items, mediaType, loading, onEndReached, header, empty }: Props) {
  const { width, gutter, columns } = useLayout()
  const cardWidth = useMemo(
    () => Math.floor((width - gutter * 2 - GAP * (columns - 1)) / columns),
    [width, gutter, columns],
  )

  return (
    <FlatList
      key={columns}
      data={items}
      numColumns={columns}
      keyExtractor={(m, i) => `${m.id}-${i}`}
      ListHeaderComponent={header}
      contentContainerStyle={{ paddingHorizontal: gutter, paddingBottom: 32 }}
      columnWrapperStyle={{ gap: GAP }}
      ItemSeparatorComponent={() => <View style={{ height: 16 }} />}
      renderItem={({ item }) => <PosterCard item={item} width={cardWidth} mediaType={mediaType} />}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.6}
      ListFooterComponent={loading ? <ActivityIndicator color={colors.gold} style={{ marginVertical: 24 }} /> : null}
      ListEmptyComponent={
        !loading && empty ? <Text style={styles.empty}>{empty}</Text> : null
      }
      keyboardShouldPersistTaps="handled"
    />
  )
}

const styles = StyleSheet.create({
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48, fontSize: 14 },
})
