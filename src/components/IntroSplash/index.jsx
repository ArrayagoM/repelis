import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { getDeviceCaps } from '../../lib/deviceCaps'
import { isStandalone } from '../../lib/install'
import {
  INTRO_SOUND_URL, INTRO_TOTAL_MS, introSeen, isBotUA, markIntroSeen, prefersReducedMotion, shouldPlayIntro,
} from '../../lib/intro'

// Línea de tiempo (ms) alineada con public/sounds/intro.wav: el golpe grave cae en 1000 ms.
const HIT = 1.0

const WORD = ['L', 'I', 'F', 'E', ' ', 'H', 'I', 'G', 'H']

export default function IntroSplash() {
  const { pathname } = useLocation()
  const [show, setShow] = useState(() =>
    typeof window !== 'undefined' &&
    shouldPlayIntro({
      pathname,
      standalone: isStandalone(),
      reducedMotion: prefersReducedMotion(),
      seen: introSeen(),
      bot: isBotUA(navigator.userAgent) || navigator.webdriver === true,
      lowEnd: getDeviceCaps().lowEnd,
    }),
  )
  const audioRef = useRef(null)

  const finish = useCallback(() => {
    audioRef.current?.pause()
    setShow(false)
  }, [])

  useEffect(() => {
    if (!show) return
    markIntroSeen()

    // Si el navegador bloquea el audio sin interacción previa, la animación sigue en silencio.
    const audio = new Audio(INTRO_SOUND_URL)
    audio.volume = 0.85
    audioRef.current = audio
    audio.play().catch(() => {})

    const timer = setTimeout(finish, INTRO_TOTAL_MS)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      clearTimeout(timer)
      audio.pause()
      document.body.style.overflow = prevOverflow
    }
  }, [show, finish])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="intro"
          className="fixed inset-0 z-[200] bg-void flex items-center justify-center overflow-hidden cursor-pointer select-none"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 1.06 }}
          transition={{ duration: 0.55, ease: [0.4, 0, 0.2, 1] }}
          onClick={finish}
          role="img"
          aria-label="Life High — Cinema sin límites"
        >
          {/* Resplandor que crece hasta el golpe */}
          <motion.div
            aria-hidden="true"
            className="absolute w-[120vmax] h-[120vmax] rounded-full"
            style={{ background: 'radial-gradient(circle, rgba(232,160,32,0.28) 0%, rgba(232,160,32,0.08) 25%, transparent 55%)' }}
            initial={{ scale: 0.05, opacity: 0 }}
            animate={{ scale: [0.05, 0.5, 1], opacity: [0, 0.5, 1, 0.55] }}
            transition={{ duration: 2.2, times: [0, HIT / 2.2, 1], ease: 'easeOut' }}
          />

          {/* Línea de luz que se abre (el "whoosh") */}
          <motion.div
            aria-hidden="true"
            className="absolute h-[2px] bg-gradient-to-r from-transparent via-gold to-transparent"
            initial={{ width: 0, opacity: 0 }}
            animate={{ width: ['0vw', '90vw', '0vw'], opacity: [0, 1, 0] }}
            transition={{ duration: HIT + 0.25, times: [0, HIT / (HIT + 0.25), 1], ease: 'easeIn' }}
          />

          {/* Onda de choque en el golpe */}
          {[0, 0.12].map((delay) => (
            <motion.div
              key={delay}
              aria-hidden="true"
              className="absolute w-28 h-28 rounded-full border-2 border-gold"
              initial={{ scale: 0.6, opacity: 0 }}
              animate={{ scale: [0.6, 7], opacity: [0.9, 0] }}
              transition={{ delay: HIT + delay, duration: 1.1, ease: 'easeOut' }}
            />
          ))}

          <div className="relative flex flex-col items-center">
            {/* Logo */}
            <motion.div
              className="w-24 h-24 sm:w-28 sm:h-28 rounded-full bg-gold flex items-center justify-center"
              style={{ boxShadow: '0 0 60px rgba(232,160,32,0.65), 0 0 140px rgba(232,160,32,0.35)' }}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: [0, 1.18, 1], rotate: 0, opacity: 1 }}
              transition={{ delay: HIT, duration: 0.7, times: [0, 0.55, 1], ease: [0.16, 1, 0.3, 1] }}
            >
              <svg viewBox="0 0 12 12" className="w-11 h-11 sm:w-12 sm:h-12" aria-hidden="true">
                <polygon points="3.5,2 10,6 3.5,10" fill="#08080E" />
              </svg>
            </motion.div>

            {/* Nombre: letras que se revelan una a una */}
            <div className="mt-7 flex font-display font-extrabold text-4xl sm:text-5xl tracking-[0.18em]" aria-hidden="true">
              {WORD.map((ch, i) => (
                <motion.span
                  key={i}
                  className={i > 4 ? 'text-gold' : 'text-chalk'}
                  style={{ display: 'inline-block', minWidth: ch === ' ' ? '0.5em' : undefined }}
                  initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
                  animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                  transition={{ delay: HIT + 0.35 + i * 0.055, duration: 0.45, ease: 'easeOut' }}
                >
                  {ch}
                </motion.span>
              ))}
            </div>

            <motion.p
              className="mt-3 text-muted text-xs sm:text-sm tracking-[0.35em] uppercase"
              initial={{ opacity: 0, letterSpacing: '0.7em' }}
              animate={{ opacity: 1, letterSpacing: '0.35em' }}
              transition={{ delay: HIT + 0.95, duration: 0.8, ease: 'easeOut' }}
            >
              Cinema sin límites
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
