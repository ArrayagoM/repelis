import { ScrollView, StyleSheet, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { router } from 'expo-router'
import { FocusPressable } from '@/components/FocusPressable'
import { Hero } from '@/components/Hero'
import { Row } from '@/components/Row'
import { movies, tv } from '@/api/tmdb'
import { useRow } from '@/hooks/useAsync'
import { useLayout } from '@/lib/layout'
import { colors } from '@/theme'

export default function Home() {
  const insets = useSafeAreaInsets()
  const { gutter } = useLayout()
  const { items: heroItems } = useRow(movies.trending)

  return (
    <View style={styles.screen}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 32 }}>
        <Hero items={heroItems} />
        <View style={styles.rows}>
          <Row title="En cartelera" badge="Ahora" fetcher={movies.nowPlaying} mediaType="movie" />
          <Row title="Tendencias" badge="Esta semana" fetcher={movies.trending} mediaType="movie" />
          <Row title="Más populares" fetcher={movies.popular} mediaType="movie" />
          <Row title="Mejor valoradas" badge="Top" fetcher={movies.topRated} mediaType="movie" />
          <Row title="Series en tendencia" badge="TV" badgeColor={colors.blue} fetcher={tv.trending} mediaType="tv" />
          <Row title="Series populares" fetcher={tv.popular} mediaType="tv" />
          <Row title="Al aire ahora" badge="En vivo" badgeColor={colors.blue} fetcher={tv.airingToday} mediaType="tv" />
          <Row title="Anime" badge="Anime" badgeColor={colors.purple} fetcher={tv.anime} mediaType="tv" />
          <Row title="K-Drama" badge="Korea" badgeColor={colors.red} fetcher={tv.kdrama} mediaType="tv" />
          <Row title="Clásicos del cine" badge="Leyendas" fetcher={movies.classics} mediaType="movie" />
        </View>
      </ScrollView>

      <View style={[styles.topBar, { paddingTop: insets.top + 8, paddingHorizontal: gutter }]}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <Ionicons name="play" size={12} color={colors.void} />
          </View>
          <Text style={styles.brandText}>
            Life <Text style={{ color: colors.gold }}>High</Text>
          </Text>
        </View>
        <FocusPressable onPress={() => router.push('/search')} accessibilityLabel="Buscar" style={styles.searchBtn}>
          <Ionicons name="search" size={20} color={colors.chalk} />
        </FocusPressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  rows: { marginTop: 8 },
  topBar: {
    position: 'absolute', top: 0, left: 0, right: 0, flexDirection: 'row', pointerEvents: 'box-none',
    alignItems: 'center', justifyContent: 'space-between',
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  logo: { width: 24, height: 24, borderRadius: 12, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center' },
  brandText: { color: colors.chalk, fontSize: 18, fontWeight: '800' },
  searchBtn: {
    width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(8,8,14,0.55)', borderWidth: 2, borderColor: 'transparent',
  },
})
