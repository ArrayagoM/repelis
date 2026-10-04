import { memo } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FocusPressable } from '@/components/FocusPressable'
import { poster } from '@/api/tmdb'
import { titleOf, yearOf, type MediaItem, type MediaType } from '@/api/types'
import { colors, radius } from '@/theme'

interface Props {
  item: MediaItem
  width: number
  mediaType?: MediaType
}

export const resolveType = (item: MediaItem, fallback?: MediaType): MediaType =>
  item.media_type === 'tv' || item.media_type === 'movie' ? item.media_type : fallback ?? (item.name && !item.title ? 'tv' : 'movie')

function PosterCardBase({ item, width, mediaType }: Props) {
  const type = resolveType(item, mediaType)
  const title = titleOf(item)
  const uri = poster(item.poster_path)

  return (
    <FocusPressable
      onPress={() => router.push(`/title/${type}/${item.id}`)}
      accessibilityLabel={title}
      style={[styles.card, { width }]}
    >
      <View style={[styles.imageWrap, { width, height: Math.round(width * 1.5) }]}>
        {uri ? (
          <Image source={{ uri }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={String(item.id)} />
        ) : (
          <View style={styles.noImage}>
            <Ionicons name="film-outline" size={28} color={colors.dim} />
          </View>
        )}
        {!!item.vote_average && item.vote_average > 0 && (
          <View style={styles.rating}>
            <Ionicons name="star" size={10} color={colors.gold} />
            <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <Text numberOfLines={1} style={styles.title}>{title}</Text>
      <Text style={styles.year}>{yearOf(item) || ' '}</Text>
    </FocusPressable>
  )
}

export const PosterCard = memo(PosterCardBase)

const styles = StyleSheet.create({
  card: { borderRadius: radius.md, borderWidth: 2, borderColor: 'transparent' },
  imageWrap: { borderRadius: radius.md, overflow: 'hidden', backgroundColor: colors.card },
  noImage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  rating: {
    position: 'absolute', top: 6, right: 6, flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(8,8,14,0.82)', borderRadius: radius.pill, paddingHorizontal: 6, paddingVertical: 2,
  },
  ratingText: { color: colors.chalk, fontSize: 10, fontWeight: '700' },
  title: { color: colors.chalk, fontSize: 12, fontWeight: '600', marginTop: 6 },
  year: { color: colors.muted, fontSize: 11, marginTop: 1 },
})
