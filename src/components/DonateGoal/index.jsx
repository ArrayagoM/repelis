import { useEffect, useState } from 'react'
import { loadGoal, formatMoney } from '../../lib/donations'

/**
 * Meta del mes + "en qué se gasta". Lee /donation-goal.json; si no hay meta cargada no muestra nada
 * (nunca inventamos números).
 */
export default function DonateGoal({ compact = false }) {
  const [goal, setGoal] = useState(null)
  useEffect(() => {
    let cancelled = false
    loadGoal().then((g) => { if (!cancelled) setGoal(g) })
    return () => { cancelled = true }
  }, [])

  if (!goal) return null
  const { currency, raised, percent } = goal

  return (
    <div className={compact ? '' : 'px-5 pt-4'}>
      <div className="flex items-baseline justify-between text-xs mb-1.5">
        <span className="text-chalk font-semibold">Costos del mes cubiertos</span>
        <span className="text-gold font-mono font-bold">{percent}%</span>
      </div>
      <div className="h-2.5 rounded-full bg-white/10 overflow-hidden"
        role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100} aria-label="Costos del mes cubiertos">
        <div className="h-full rounded-full bg-gradient-to-r from-gold-lo to-gold-hi transition-all duration-700" style={{ width: `${Math.max(percent, raised > 0 ? 3 : 0)}%` }} />
      </div>
      <p className="text-muted text-[11px] mt-1.5">
        {raised > 0
          ? `${formatMoney(raised, currency)} de ${formatMoney(goal.goal, currency)}`
          : `Meta del mes: ${formatMoney(goal.goal, currency)} · sé el primero en aportar`}
      </p>

      {!compact && goal.costs.length > 0 && (
        <details className="mt-3 group">
          <summary className="text-muted text-xs cursor-pointer hover:text-gold transition-colors select-none">¿En qué se gasta?</summary>
          <ul className="mt-2 space-y-1">
            {goal.costs.map((c) => (
              <li key={c.label} className="flex justify-between gap-3 text-xs text-muted">
                <span className="truncate">{c.label}{c.note ? <span className="text-muted/50"> · {c.note}</span> : null}</span>
                <span className="font-mono text-chalk/80 flex-shrink-0">{formatMoney(c.amount, currency)}</span>
              </li>
            ))}
          </ul>
        </details>
      )}
    </div>
  )
}
