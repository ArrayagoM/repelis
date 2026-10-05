import { useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Fire } from '@phosphor-icons/react'
import { useLibrary, getLibrary, markAchievementsSeen } from '../../lib/library'
import { computeAchievements, computeStreak, newlyUnlocked } from '../../lib/achievements'
import { showToast } from '../../lib/toast'

/** Chip 🔥 con los días de racha (Navbar). Aparece desde 2 días seguidos. */
export function StreakChip() {
  const lib = useLibrary()
  const { current } = useMemo(() => computeStreak(lib.days), [lib.days])
  if (current < 2) return null
  return (
    <Link to="/mi-lista#logros" title={`${current} días seguidos viendo algo`} aria-label={`Racha de ${current} días`}
      className="hidden lg:flex items-center gap-1 h-8 px-2.5 rounded-full bg-orange-500/15 border border-orange-400/30 text-orange-300 text-xs font-bold hover:bg-orange-500/25 transition-all">
      <Fire size={14} weight="fill" />
      {current}
    </Link>
  )
}

/** Avisa (una sola vez) cada logro nuevo. No renderiza nada. */
export function AchievementWatcher() {
  const lib = useLibrary()
  useEffect(() => {
    // Estado fresco (no el de este render): evita avisar dos veces en modo estricto
    const fresh = newlyUnlocked(getLibrary())
    if (!fresh.length) return
    markAchievementsSeen(fresh.map((a) => a.id))
    fresh.slice(0, 3).forEach((a, i) => setTimeout(() => showToast({
      icon: a.icon, title: `Logro desbloqueado: ${a.title}`, text: a.desc,
      actionLabel: 'Ver mis logros', to: '/mi-lista#logros', ttl: 8000,
    }), i * 600))
  }, [lib])
  return null
}

/** Racha + insignias (página Mi lista). */
export function AchievementsPanel() {
  const lib = useLibrary()
  const streak = useMemo(() => computeStreak(lib.days), [lib.days])
  const list = useMemo(() => computeAchievements(lib), [lib])
  const done = list.filter((a) => a.done).length

  return (
    <section id="logros" className="max-w-7xl mx-auto px-6 md:px-12" aria-label="Logros">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
        <h2 className="font-display font-bold text-xl sm:text-2xl text-chalk">Tus logros</h2>
        <span className="text-muted text-sm font-mono">{done} de {list.length}</span>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-5">
        <Stat label="Racha actual" value={`${streak.current} día${streak.current === 1 ? '' : 's'}`} hint={streak.current > 0 && !streak.activeToday ? 'Mirá algo hoy para sumarla' : 'Seguí así'} icon="🔥" />
        <Stat label="Mejor racha" value={`${streak.best} día${streak.best === 1 ? '' : 's'}`} icon="🏅" />
        <Stat label="Tiempo viendo" value={`${Math.floor(lib.minutes / 60)} h ${Math.floor(lib.minutes % 60)} min`} icon="⏱️" />
      </div>

      <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {list.map((a) => (
          <li key={a.id}
            className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-colors ${a.done ? 'bg-gold/10 border-gold/30' : 'bg-card border-white/[0.06]'}`}>
            <span className={`text-3xl leading-none ${a.done ? '' : 'grayscale opacity-40'}`} aria-hidden="true">{a.icon}</span>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-semibold ${a.done ? 'text-gold' : 'text-chalk/80'}`}>{a.title}</p>
              <p className="text-muted text-xs leading-snug">{a.desc}</p>
              {!a.done && (
                <div className="mt-2 flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-white/10 overflow-hidden"
                    role="progressbar" aria-valuenow={a.value} aria-valuemin={0} aria-valuemax={a.target}>
                    <div className="h-full bg-gold/70" style={{ width: `${Math.round((a.value / a.target) * 100)}%` }} />
                  </div>
                  <span className="text-[10px] font-mono text-muted">{a.value}/{a.target}</span>
                </div>
              )}
            </div>
            {a.done && <span className="text-gold text-xs font-bold">✓</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}

function Stat({ label, value, hint, icon }) {
  return (
    <div className="p-4 rounded-2xl bg-card border border-white/[0.06]">
      <p className="text-muted text-[11px] uppercase tracking-wider font-mono">{icon} {label}</p>
      <p className="text-chalk font-display font-bold text-xl mt-1">{value}</p>
      {hint && <p className="text-muted/70 text-[11px] mt-0.5">{hint}</p>}
    </div>
  )
}
