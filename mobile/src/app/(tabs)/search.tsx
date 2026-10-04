import { useEffect, useRef, useState } from 'react'
import { StyleSheet, Text, TextInput, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { PosterGrid } from '@/components/PosterGrid'
import { searchMulti } from '@/api/tmdb'
import type { MediaItem } from '@/api/types'
import { useLayout } from '@/lib/layout'
import { colors, radius } from '@/theme'

const DEBOUNCE_MS = 400
const SUGGESTIONS = ['Breaking Bad', 'Attack on Titan', 'Inception', 'Coco', 'Spider-Man', 'La Casa de Papel']

export default function SearchScreen() {
  const insets = useSafeAreaInsets()
  const { gutter } = useLayout()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<MediaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(false)
  const runRef = useRef(0)

  useEffect(() => {
    const q = query.trim()
    runRef.current += 1
    const run = runRef.current
    if (q.length < 2) {
      setResults([])
      setLoading(false)
      setError(false)
      return
    }
    setLoading(true)
    setError(false)
    const t = setTimeout(async () => {
      try {
        const res = await searchMulti(q)
        if (run !== runRef.current) return
        setResults(res.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv'))
      } catch {
        if (run === runRef.current) setError(true)
      } finally {
        if (run === runRef.current) setLoading(false)
      }
    }, DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [query])

  const searched = query.trim().length >= 2

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
      <Text style={[styles.title, { paddingHorizontal: gutter }]}>Buscar</Text>
      <View style={[styles.inputWrap, { marginHorizontal: gutter }]}>
        <Ionicons name="search" size={18} color={colors.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Películas, series, anime…"
          placeholderTextColor={colors.muted}
          style={styles.input}
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          accessibilityLabel="Buscar películas y series"
        />
      </View>

      {!searched ? (
        <View style={{ paddingHorizontal: gutter, marginTop: 24 }}>
          <Text style={styles.hint}>Probá con</Text>
          <View style={styles.suggestions}>
            {SUGGESTIONS.map((s) => (
              <Text key={s} style={styles.suggestion} onPress={() => setQuery(s)}>
                {s}
              </Text>
            ))}
          </View>
        </View>
      ) : error ? (
        <Text style={styles.empty}>No se pudo buscar. Revisá tu conexión.</Text>
      ) : (
        <PosterGrid items={results} loading={loading} empty={`Sin resultados para “${query.trim()}”.`} />
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  title: { color: colors.chalk, fontSize: 26, fontWeight: '800', marginBottom: 12 },
  inputWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.surface,
    borderRadius: radius.lg, paddingHorizontal: 14, marginBottom: 16, borderWidth: 1, borderColor: colors.border,
  },
  input: { flex: 1, color: colors.chalk, fontSize: 16, paddingVertical: 12 },
  hint: { color: colors.muted, fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 10 },
  suggestions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  suggestion: {
    color: colors.chalk, backgroundColor: colors.surface, borderRadius: radius.pill,
    paddingHorizontal: 14, paddingVertical: 8, overflow: 'hidden', fontSize: 13,
  },
  empty: { color: colors.muted, textAlign: 'center', marginTop: 48, fontSize: 14 },
})
