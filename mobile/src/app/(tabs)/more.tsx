import { useEffect, useState } from 'react'
import { Linking, ScrollView, StyleSheet, Switch, Text, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import Constants from 'expo-constants'
import { FocusPressable } from '@/components/FocusPressable'
import { useLayout } from '@/lib/layout'
import { useLanguageMode } from '@/lib/LanguageProvider'
import { LANGUAGE_MODES, MODE_DESCRIPTIONS, MODE_LABELS } from '@/lib/languageMode'
import { DOWNLOADS_PAGE, DOWNLOAD_OPTIONS } from '@/lib/downloads'
import { loadIntroSoundEnabled, saveIntroSoundEnabled } from '@/lib/intro'
import { colors, radius } from '@/theme'

export default function MoreScreen() {
  const insets = useSafeAreaInsets()
  const { gutter } = useLayout()
  const { mode, setMode } = useLanguageMode()
  const version = Constants.expoConfig?.version ?? '1.0.0'
  const [introSound, setIntroSound] = useState(true)
  useEffect(() => {
    loadIntroSoundEnabled().then(setIntroSound)
  }, [])

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ paddingTop: insets.top + 8, paddingHorizontal: gutter, paddingBottom: 48 }}
    >
      <Text style={styles.title}>Más</Text>

      <Text style={styles.section}>Idioma del catálogo</Text>
      {LANGUAGE_MODES.map((m) => {
        const active = mode === m
        return (
          <FocusPressable
            key={m}
            onPress={() => setMode(m)}
            focusScale={1.02}
            style={[styles.option, active && styles.optionActive]}
            accessibilityState={{ selected: active }}
          >
            <Ionicons name={active ? 'radio-button-on' : 'radio-button-off'} size={20} color={active ? colors.gold : colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={styles.optionTitle}>{MODE_LABELS[m]}</Text>
              <Text style={styles.optionText}>{MODE_DESCRIPTIONS[m]}</Text>
            </View>
          </FocusPressable>
        )
      })}

      <Text style={styles.section}>Sonido</Text>
      <View style={styles.option}>
        <Ionicons name="volume-high" size={22} color={colors.gold} />
        <View style={{ flex: 1 }}>
          <Text style={styles.optionTitle}>Sonido al abrir la app</Text>
          <Text style={styles.optionText}>Suena la intro de Life High cada vez que abrís la app.</Text>
        </View>
        <Switch
          value={introSound}
          onValueChange={(v) => {
            setIntroSound(v)
            saveIntroSoundEnabled(v)
          }}
          trackColor={{ false: colors.dim, true: colors.goldLo }}
          thumbColor={introSound ? colors.gold : colors.muted}
          accessibilityLabel="Sonido al abrir la app"
        />
      </View>

      <Text style={styles.section}>Life High en otras plataformas</Text>
      {DOWNLOAD_OPTIONS.map((d) => (
        <FocusPressable key={d.id} onPress={() => Linking.openURL(d.url)} focusScale={1.02} style={styles.option}>
          <Ionicons name={d.icon} size={22} color={colors.gold} />
          <View style={{ flex: 1 }}>
            <Text style={styles.optionTitle}>{d.label}</Text>
            <Text style={styles.optionText}>{d.detail}</Text>
          </View>
          <Ionicons name="download-outline" size={18} color={colors.muted} />
        </FocusPressable>
      ))}
      <FocusPressable onPress={() => Linking.openURL(DOWNLOADS_PAGE)} focusScale={1.02} style={[styles.option, { justifyContent: 'center' }]}>
        <Text style={[styles.optionTitle, { color: colors.gold }]}>Ver todas las opciones y guías de instalación</Text>
      </FocusPressable>

      <Text style={styles.section}>Acerca de</Text>
      <Text style={styles.about}>
        Life High v{version}. Datos de películas y series provistos por TMDB; este producto usa la API de TMDB pero no está avalado ni certificado por TMDB.
        {'\n\n'}
        Los videos son reproducidos por servidores de terceros y el audio disponible (incluido el doblaje al español) depende de cada servidor. Si un título arranca en otro idioma, elegí “Audio / CC” dentro del reproductor o probá otro servidor.
      </Text>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.void },
  title: { color: colors.chalk, fontSize: 26, fontWeight: '800', marginBottom: 8 },
  section: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1, marginTop: 24, marginBottom: 10 },
  option: {
    flexDirection: 'row', alignItems: 'center', gap: 14, backgroundColor: colors.surface,
    borderRadius: radius.lg, padding: 14, marginBottom: 8, borderWidth: 2, borderColor: 'transparent',
  },
  optionActive: { backgroundColor: 'rgba(232,160,32,0.10)', borderColor: 'rgba(232,160,32,0.4)' },
  optionTitle: { color: colors.chalk, fontSize: 15, fontWeight: '700' },
  optionText: { color: colors.muted, fontSize: 12, marginTop: 2, lineHeight: 17 },
  about: { color: colors.muted, fontSize: 12, lineHeight: 18 },
})
