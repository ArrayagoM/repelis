import { useEffect, useMemo, useState } from 'react'
import { StyleSheet, Text, View } from 'react-native'
import { Image } from 'expo-image'
import { LinearGradient } from 'expo-linear-gradient'
import { router } from 'expo-router'
import { Ionicons } from '@expo/vector-icons'
import { FocusPressable } from '@/components/FocusPressable'
import { resolveType } from '@/components/PosterCard'
import { backdrop } from '@/api/tmdb'
import { titleOf, yearOf, type MediaItem } from '@/api/types'
import { useLayout } from '@/lib/layout'
import { isOut } from '@/lib/release'
import { colors, radius } from '@/theme'

const ROTATE_MS = 7000

export function Hero({ items }: { items: MediaItem[] }) {
  const { width, isTV, isTablet, gutter } = useLayout()
  const slides = useMemo(() => items.filter((m) => m.backdrop_path && isOut(m)).slice(0, 6), [items])
  const [index, setIndex] = useState(0)

  useEffect(() => {
    if (slides.length < 2) return
    const t = setInterval(() => setIndex((i) => (i + 1) % slides.length), ROTATE_MS)
    return () => clearInterval(t)
  }, [slides.length])

  const height = isTV ? 520 : isTablet ? 440 : 400
  const item = slides[index % Math.max(slides.length, 1)]

  if (!item) return <View style={{ height: 120 }} />

  const type = resolveType(item)
  const title = titleOf(item)
  const textWidth = isTV || isTablet ? Math.min(width * 0.5, 560) : width - gutter * 2

  return (
    <View style={{ height, width: '100%', backgroundColor: colors.void }}>
      <Image
        source={{ uri: backdrop(item.backdrop_path, 'w1280') }}
        style={StyleSheet.absoluteFill}
        contentFit="cover"
        transition={400}
        recyclingKey={String(item.id)}
      />
      <LinearGradient colors={['rgba(8,8,14,0.1)', 'rgba(8,8,14,0.55)', colors.void]} style={StyleSheet.absoluteFill} />
      {(isTV || isTablet) && (
        <LinearGradient
          colors={[colors.void, 'transparent']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.7, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
      )}

      <View style={[styles.content, { paddingHorizontal: gutter, width: textWidth + gutter * 2 }]}>
        <View style={styles.metaRow}>
          <View style={styles.tag}>
            <Text style={styles.tagText}>{type === 'tv' ? 'Serie' : 'Película'}</Text>
          </View>
          {!!item.vote_average && (
            <View style={styles.rating}>
              <Ionicons name="star" size={12} color={colors.gold} />
              <Text style={styles.ratingText}>{item.vote_average.toFixed(1)}</Text>
            </View>
          )}
          {!!yearOf(item) && <Text style={styles.year}>{yearOf(item)}</Text>}
        </View>

        <Text style={[styles.title, isTV && { fontSize: 44 }]} numberOfLines={2}>{title}</Text>
        {!!item.overview && (
          <Text style={styles.overview} numberOfLines={isTV || isTablet ? 3 : 2}>{item.overview}</Text>
        )}

        <View style={styles.actions}>
          <FocusPressable
            hasTVPreferredFocus
            onPress={() => router.push({ pathname: `/player/${type}/${item.id}`, params: { title } })}
            style={styles.play}
            accessibilityLabel={`Reproducir ${title}`}
          >
            <Ionicons name="play" size={18} color={colors.void} />
            <Text style={styles.playText}>Reproducir</Text>
          </FocusPressable>
          <FocusPressable
            onPress={() => router.push(`/title/${type}/${item.id}`)}
            style={styles.info}
            accessibilityLabel={`Más información de ${title}`}
          >
            <Ionicons name="information-circle-outline" size={18} color={colors.chalk} />
            <Text style={styles.infoText}>Más info</Text>
          </FocusPressable>
        </View>

        {slides.length > 1 && (
          <View style={styles.dots}>
            {slides.map((s, i) => (
              <View key={s.id} style={[styles.dot, i === index && styles.dotActive]} />
            ))}
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  content: { position: 'absolute', left: 0, bottom: 18 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  tag: { borderWidth: 1, borderColor: 'rgba(232,160,32,0.4)', borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3 },
  tagText: { color: colors.gold, fontSize: 10, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.8 },
  rating: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  ratingText: { color: colors.chalk, fontSize: 13, fontWeight: '700' },
  year: { color: colors.muted, fontSize: 13 },
  title: { color: colors.chalk, fontSize: 30, fontWeight: '800', letterSpacing: -0.5 },
  overview: { color: 'rgba(240,237,232,0.75)', fontSize: 14, lineHeight: 20, marginTop: 8 },
  actions: { flexDirection: 'row', gap: 12, marginTop: 16 },
  play: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.gold,
    borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent',
  },
  playText: { color: colors.void, fontWeight: '800', fontSize: 15 },
  info: {
    flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: radius.pill, paddingHorizontal: 20, paddingVertical: 12, borderWidth: 2, borderColor: 'transparent',
  },
  infoText: { color: colors.chalk, fontWeight: '700', fontSize: 15 },
  dots: { flexDirection: 'row', gap: 6, marginTop: 16 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.dim },
  dotActive: { width: 22, backgroundColor: colors.gold },
})
