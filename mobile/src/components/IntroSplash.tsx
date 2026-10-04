import { useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native'
import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio'
import { INTRO_FADE_OUT_MS, INTRO_HIT_MS, INTRO_TOTAL_MS, loadIntroSoundEnabled, shouldShowIntro } from '@/lib/intro'
import { colors } from '@/theme'

const WORD = ['L', 'I', 'F', 'E', ' ', 'H', 'I', 'G', 'H']

const timing = (value: Animated.Value, toValue: number, duration: number, delay = 0, easing = Easing.out(Easing.cubic)) =>
  Animated.timing(value, { toValue, duration, delay, easing, useNativeDriver: true })

// Arranque: whoosh de luz → golpe (logo + ondas) → nombre letra por letra → fundido. Con sonido; toque para saltar.
export function IntroSplash() {
  const [visible, setVisible] = useState(() => shouldShowIntro())
  const playerRef = useRef<AudioPlayer | null>(null)

  const glow = useRef(new Animated.Value(0)).current
  const line = useRef(new Animated.Value(0)).current
  const logo = useRef(new Animated.Value(0)).current
  const ring1 = useRef(new Animated.Value(0)).current
  const ring2 = useRef(new Animated.Value(0)).current
  const tagline = useRef(new Animated.Value(0)).current
  const overlay = useRef(new Animated.Value(1)).current
  const letters = useMemo(() => WORD.map(() => new Animated.Value(0)), [])

  const finish = () => {
    playerRef.current?.pause()
    setVisible(false)
  }

  useEffect(() => {
    if (!visible) return
    let cancelled = false

    AccessibilityInfo.isReduceMotionEnabled().then((reduce) => {
      if (reduce && !cancelled) setVisible(false)
    })

    const anim = Animated.parallel([
      timing(glow, 1, 2200, 0, Easing.out(Easing.quad)),
      timing(line, 1, INTRO_HIT_MS + 250, 0, Easing.in(Easing.quad)),
      timing(logo, 1, 700, INTRO_HIT_MS, Easing.out(Easing.back(2.2))),
      timing(ring1, 1, 1100, INTRO_HIT_MS),
      timing(ring2, 1, 1100, INTRO_HIT_MS + 120),
      ...letters.map((v, i) => timing(v, 1, 450, INTRO_HIT_MS + 350 + i * 55)),
      timing(tagline, 1, 800, INTRO_HIT_MS + 950),
      timing(overlay, 0, INTRO_FADE_OUT_MS, INTRO_TOTAL_MS - INTRO_FADE_OUT_MS, Easing.inOut(Easing.cubic)),
    ])
    anim.start()

    // Sonido: respeta el modo silencio del iPhone y no corta la música que ya esté sonando.
    loadIntroSoundEnabled().then(async (enabled) => {
      if (!enabled || cancelled) return
      try {
        await setAudioModeAsync({ playsInSilentMode: false, interruptionMode: 'mixWithOthers' })
        const player = createAudioPlayer(require('../../assets/sounds/intro.wav'))
        player.volume = 0.85
        playerRef.current = player
        if (!cancelled) player.play()
      } catch {
        // sin audio disponible: la animación sigue igual
      }
    });

    const timer = setTimeout(finish, INTRO_TOTAL_MS)
    return () => {
      cancelled = true
      clearTimeout(timer)
      anim.stop()
      playerRef.current?.remove()
      playerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!visible) return null

  const ringStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 0.01, 1], outputRange: [0, 0.9, 0] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.6, 7] }) }],
  })

  return (
    <Animated.View style={[styles.root, { opacity: overlay }]} accessibilityLabel="Life High — Cinema sin límites" accessible>
      <Pressable style={StyleSheet.absoluteFill} onPress={finish} accessibilityRole="button" accessibilityLabel="Saltar intro" />

      <Animated.View
        style={[
          styles.glow,
          {
            opacity: glow.interpolate({ inputRange: [0, 0.45, 1], outputRange: [0, 0.6, 1] }),
            transform: [{ scale: glow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 1] }) }],
          },
        ]}
      />
      <Animated.View
        style={[
          styles.line,
          {
            opacity: line.interpolate({ inputRange: [0, 0.2, 0.9, 1], outputRange: [0, 1, 1, 0] }),
            transform: [{ scaleX: line.interpolate({ inputRange: [0, 0.8, 1], outputRange: [0, 1, 0.2] }) }],
          },
        ]}
      />
      <Animated.View style={[styles.ring, ringStyle(ring1)]} />
      <Animated.View style={[styles.ring, ringStyle(ring2)]} />

      <View style={styles.center}>
        <Animated.View
          style={[
            styles.logo,
            {
              opacity: logo.interpolate({ inputRange: [0, 0.05, 1], outputRange: [0, 1, 1] }),
              transform: [
                { scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0, 1] }) },
                { rotate: logo.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }) },
              ],
            },
          ]}
        >
          <View style={styles.triangle} />
        </Animated.View>

        <View style={styles.word}>
          {WORD.map((ch, i) => (
            <Animated.Text
              key={i}
              style={[
                styles.letter,
                { color: i > 4 ? colors.gold : colors.chalk, width: ch === ' ' ? 14 : undefined },
                {
                  opacity: letters[i],
                  transform: [{ translateY: letters[i].interpolate({ inputRange: [0, 1], outputRange: [14, 0] }) }],
                },
              ]}
            >
              {ch}
            </Animated.Text>
          ))}
        </View>

        <Animated.View style={{ opacity: tagline }}>
          <Text style={styles.tagline}>CINEMA SIN LÍMITES</Text>
        </Animated.View>
      </View>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  root: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: colors.void, alignItems: 'center', justifyContent: 'center', zIndex: 999, elevation: 999 },
  glow: { pointerEvents: 'none', position: 'absolute', width: 900, height: 900, borderRadius: 450, backgroundColor: 'rgba(232,160,32,0.12)' },
  line: { pointerEvents: 'none', position: 'absolute', width: '90%', height: 2, backgroundColor: colors.gold },
  ring: { pointerEvents: 'none', position: 'absolute', width: 110, height: 110, borderRadius: 55, borderWidth: 2, borderColor: colors.gold },
  center: { pointerEvents: 'none', alignItems: 'center' },
  triangle: {
    width: 0, height: 0, marginLeft: 8, borderStyle: 'solid', borderLeftWidth: 34, borderTopWidth: 21, borderBottomWidth: 21,
    borderLeftColor: colors.void, borderTopColor: 'transparent', borderBottomColor: 'transparent',
  },
  logo: {
    width: 104, height: 104, borderRadius: 52, backgroundColor: colors.gold, alignItems: 'center', justifyContent: 'center',
    shadowColor: colors.gold, shadowOpacity: 0.7, shadowRadius: 40, shadowOffset: { width: 0, height: 0 }, elevation: 20,
  },
  word: { flexDirection: 'row', marginTop: 28 },
  letter: { fontSize: 38, fontWeight: '800', letterSpacing: 5 },
  tagline: { marginTop: 12, color: colors.muted, fontSize: 12, letterSpacing: 4 },
})
