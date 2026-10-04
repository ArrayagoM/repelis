import { useCallback, useEffect, useMemo, useState } from 'react'
import { ActivityIndicator, Platform, ScrollView, StyleSheet, Text, View } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { StatusBar } from 'expo-status-bar'
import * as ScreenOrientation from 'expo-screen-orientation'
import { useKeepAwake } from 'expo-keep-awake'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { Ionicons } from '@expo/vector-icons'
import { EmbedPlayer } from '@/components/EmbedPlayer'
import { FocusPressable } from '@/components/FocusPressable'
import type { MediaType } from '@/api/types'
import { useLayout } from '@/lib/layout'
import { buildUrl, getOrderedSources, loadRememberedSource, rememberSource } from '@/lib/playerSources'
import { colors, radius } from '@/theme'

const LOAD_TIMEOUT_MS = 12000
const TIP_MS = 12000

type Phase = 'loading' | 'ready' | 'playing' | 'failed'

export default function PlayerScreen() {
  const { type, id, title, season, episode } = useLocalSearchParams<{
    type: string; id: string; title?: string; season?: string; episode?: string; seasons?: string
  }>()
  const mediaType: MediaType = type === 'tv' ? 'tv' : 'movie'
  const isTV = mediaType === 'tv'
  const insets = useSafeAreaInsets()
  const { isTV: isTvDevice, isTablet } = useLayout()

  useKeepAwake()

  // Celulares: horizontal mientras se reproduce. Tablets y TV respetan la orientación del dispositivo.
  useEffect(() => {
    if (Platform.OS === 'web' || isTvDevice || isTablet) return
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE).catch(() => {})
    return () => {
      ScreenOrientation.unlockAsync().catch(() => {})
    }
  }, [isTvDevice, isTablet])

  const [remembered, setRemembered] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    loadRememberedSource().then(setRemembered)
  }, [])
  const sources = useMemo(() => (remembered === undefined ? [] : getOrderedSources(remembered)), [remembered])

  const [idx, setIdx] = useState(0)
  const [phase, setPhase] = useState<Phase>('loading')
  const [reloadKey, setReloadKey] = useState(0)
  const [tries, setTries] = useState(0)
  const [showTip, setShowTip] = useState(true)
  const [ep, setEp] = useState({ season: Number(season) || 1, episode: Number(episode) || 1 })

  const source = sources[idx]
  const url = source ? buildUrl(source, { mediaType, id, season: ep.season, episode: ep.episode }) : ''

  const goTo = useCallback((i: number, countAsTry = false) => {
    setIdx(i)
    setPhase('loading')
    setReloadKey((k) => k + 1)
    setTries((t) => (countAsTry ? t + 1 : 0))
  }, [])

  const next = useCallback(
    (auto = false) => {
      if (sources.length === 0) return
      if (auto && tries + 1 >= sources.length) {
        setPhase('failed')
        return
      }
      goTo((idx + 1) % sources.length, auto)
    },
    [sources.length, idx, tries, goTo],
  )

  // Si el servidor no termina de cargar a tiempo, pasamos solos al siguiente.
  useEffect(() => {
    if (phase !== 'loading' || !source) return
    const t = setTimeout(() => next(true), LOAD_TIMEOUT_MS)
    return () => clearTimeout(t)
  }, [phase, source, reloadKey, next])

  useEffect(() => {
    const t = setTimeout(() => setShowTip(false), TIP_MS)
    return () => clearTimeout(t)
  }, [])

  const onLoaded = useCallback(() => setPhase((p) => (p === 'loading' ? 'ready' : p)), [])
  const onPlaying = useCallback(() => {
    setPhase('playing')
    if (source) rememberSource(source.id)
  }, [source])

  const changeEpisode = (s: number, e: number) => {
    setEp({ season: Math.max(1, s), episode: Math.max(1, e) })
    goTo(0)
  }

  const close = () => (router.canGoBack() ? router.back() : router.replace('/'))
  const sidePad = Math.max(insets.left, insets.right, 12)

  return (
    <View style={styles.screen}>
      <StatusBar hidden />

      <View style={[styles.bar, { paddingTop: Math.max(insets.top, 4), paddingLeft: sidePad, paddingRight: sidePad }]}>
        <FocusPressable onPress={close} accessibilityLabel="Cerrar reproductor" style={styles.iconBtn}>
          <Ionicons name="close" size={20} color={colors.chalk} />
        </FocusPressable>

        <View style={styles.titleWrap}>
          <Text style={styles.title} numberOfLines={1}>{title || 'Reproduciendo…'}</Text>
          {isTV && <Text style={styles.sub}>T{ep.season} · E{ep.episode}</Text>}
        </View>

        {isTV && (
          <View style={styles.epNav}>
            <FocusPressable
              onPress={() => (ep.episode > 1 ? changeEpisode(ep.season, ep.episode - 1) : ep.season > 1 && changeEpisode(ep.season - 1, 1))}
              accessibilityLabel="Episodio anterior"
              style={styles.iconBtn}
            >
              <Ionicons name="play-skip-back" size={16} color={colors.chalk} />
            </FocusPressable>
            <FocusPressable onPress={() => changeEpisode(ep.season, ep.episode + 1)} accessibilityLabel="Episodio siguiente" style={styles.iconBtn}>
              <Ionicons name="play-skip-forward" size={16} color={colors.chalk} />
            </FocusPressable>
          </View>
        )}

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll} contentContainerStyle={styles.chips}>
          {sources.map((s, i) => (
            <FocusPressable
              key={s.id}
              onPress={() => goTo(i)}
              focusScale={1.05}
              style={[styles.chip, i === idx && styles.chipActive]}
              accessibilityState={{ selected: i === idx }}
              accessibilityLabel={`Servidor ${s.label}`}
            >
              {s.esLat && <View style={[styles.dot, i !== idx && { opacity: 0.5 }]} />}
              <Text style={[styles.chipText, i === idx && styles.chipTextActive]}>{s.label}</Text>
            </FocusPressable>
          ))}
        </ScrollView>

        <FocusPressable onPress={() => goTo(idx)} accessibilityLabel="Recargar servidor" style={styles.iconBtn}>
          <Ionicons name="refresh" size={18} color={colors.chalk} />
        </FocusPressable>
      </View>

      <View style={styles.stage}>
        {source && phase !== 'failed' && (
          <EmbedPlayer
            key={`${source.id}-${ep.season}-${ep.episode}-${reloadKey}`}
            url={url}
            onLoaded={onLoaded}
            onPlaying={onPlaying}
            onFailed={() => next(true)}
          />
        )}

        {(phase === 'loading' || remembered === undefined) && phase !== 'failed' && (
          <View style={styles.overlay}>
            <ActivityIndicator color={colors.gold} size="large" />
            <Text style={styles.overlayText}>
              {source?.label ?? 'Preparando…'}
              {sources.length > 0 && <Text style={styles.overlayMuted}>  ·  {idx + 1}/{sources.length}</Text>}
            </Text>
            <FocusPressable onPress={() => next()} style={styles.skip} accessibilityLabel="Saltar al siguiente servidor">
              <Text style={styles.skipText}>Saltar al siguiente →</Text>
            </FocusPressable>
          </View>
        )}

        {phase === 'failed' && (
          <View style={styles.overlay}>
            <Ionicons name="sad-outline" size={40} color={colors.muted} />
            <Text style={styles.failTitle}>Ningún servidor respondió</Text>
            <Text style={styles.failText}>
              Probamos {sources.length} servidores. Suele pasar con estrenos recientes o cine de nicho. Revisá tu conexión o reintentá en unos minutos.
            </Text>
            <View style={styles.failActions}>
              <FocusPressable hasTVPreferredFocus onPress={() => goTo(0)} style={styles.skip}>
                <Text style={styles.skipText}>Reintentar</Text>
              </FocusPressable>
              <FocusPressable onPress={close} style={[styles.skip, { backgroundColor: colors.surface }]}>
                <Text style={[styles.skipText, { color: colors.chalk }]}>Volver</Text>
              </FocusPressable>
            </View>
          </View>
        )}

        {showTip && phase !== 'failed' && (
          <View style={[styles.tip, { left: sidePad, right: sidePad }]}>
            <Ionicons name="volume-high" size={16} color={colors.gold} />
            <Text style={styles.tipText}>
              ¿Audio en otro idioma? Abrí <Text style={styles.tipBold}>Audio / CC</Text> dentro del reproductor y elegí Español/Latino, o probá otro servidor arriba.
            </Text>
            <FocusPressable onPress={() => setShowTip(false)} accessibilityLabel="Cerrar aviso" style={styles.tipClose}>
              <Ionicons name="close" size={14} color={colors.muted} />
            </FocusPressable>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#000' },
  bar: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.deep, paddingBottom: 6, borderBottomWidth: 1, borderBottomColor: colors.border },
  iconBtn: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 2, borderColor: 'transparent',
  },
  titleWrap: { flexShrink: 1, maxWidth: 220 },
  title: { color: colors.chalk, fontSize: 14, fontWeight: '700' },
  sub: { color: colors.muted, fontSize: 11 },
  epNav: { flexDirection: 'row', gap: 6 },
  chipsScroll: { flex: 1 },
  chips: { gap: 6, alignItems: 'center', paddingHorizontal: 4 },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: radius.pill,
    paddingHorizontal: 11, paddingVertical: 6, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 2, borderColor: 'transparent',
  },
  chipActive: { backgroundColor: 'rgba(232,160,32,0.18)', borderColor: 'rgba(232,160,32,0.5)' },
  chipText: { color: colors.muted, fontSize: 12, fontWeight: '600' },
  chipTextActive: { color: colors.gold },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.emerald },
  stage: { flex: 1, backgroundColor: '#000' },
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24 },
  overlayText: { color: colors.chalk, fontSize: 15, fontWeight: '600' },
  overlayMuted: { color: colors.muted, fontWeight: '400' },
  skip: {
    backgroundColor: colors.gold, borderRadius: radius.pill, paddingHorizontal: 22, paddingVertical: 10,
    borderWidth: 2, borderColor: 'transparent',
  },
  skipText: { color: colors.void, fontWeight: '800', fontSize: 14 },
  failTitle: { color: colors.chalk, fontSize: 18, fontWeight: '800' },
  failText: { color: colors.muted, fontSize: 13, textAlign: 'center', maxWidth: 420, lineHeight: 19 },
  failActions: { flexDirection: 'row', gap: 10, marginTop: 4 },
  tip: {
    position: 'absolute', top: 8, flexDirection: 'row', alignItems: 'center', gap: 8, pointerEvents: 'box-none',
    backgroundColor: 'rgba(8,8,14,0.9)', borderRadius: radius.md, paddingHorizontal: 12, paddingVertical: 8,
    borderWidth: 1, borderColor: 'rgba(232,160,32,0.3)',
  },
  tipText: { flex: 1, color: 'rgba(240,237,232,0.9)', fontSize: 12, lineHeight: 16 },
  tipBold: { color: colors.gold, fontWeight: '700' },
  tipClose: { width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderRadius: 12, borderWidth: 2, borderColor: 'transparent' },
})
