// Lista rankeada con barra de proporción, etiqueta y valor.
// Serie única → sin leyenda. Un solo hue por lista.
//
// props.items: [{ label, value, hint? }]
// props.accent: 'gold' | 'sky' | 'emerald' | 'purple' | 'blue'
const ACCENTS = {
  gold:    { bar: 'bg-gold/25',    text: 'text-gold' },
  sky:     { bar: 'bg-sky-500/25', text: 'text-sky-300' },
  emerald: { bar: 'bg-emerald-500/25', text: 'text-emerald-300' },
  purple:  { bar: 'bg-purple-500/25', text: 'text-purple-300' },
  blue:    { bar: 'bg-blue-500/25', text: 'text-blue-300' },
}

export default function BarList({ items = [], accent = 'gold', max, emptyLabel = 'Sin datos aún' }) {
  const total = max ?? Math.max(1, ...items.map((i) => i.value))
  const a = ACCENTS[accent] || ACCENTS.gold

  if (!items.length) {
    return <p className="text-muted/40 text-xs py-6 text-center">{emptyLabel}</p>
  }

  return (
    <div className="space-y-1.5">
      {items.map((it, idx) => {
        const pct = Math.max(2, Math.round((it.value / total) * 100))
        return (
          <div key={`${it.label}-${idx}`} className="relative flex items-center h-7 rounded-md overflow-hidden group">
            {/* Barra de fondo proporcional */}
            <div className={`absolute inset-y-0 left-0 ${a.bar} rounded-md transition-all group-hover:brightness-125`}
              style={{ width: `${pct}%` }} />
            {/* Contenido */}
            <div className="relative flex items-center justify-between w-full px-2.5 gap-2">
              <span className="flex items-center gap-2 min-w-0">
                {it.icon && <span className="text-sm leading-none flex-shrink-0">{it.icon}</span>}
                <span className="text-chalk text-xs truncate">{it.label}</span>
                {it.hint && <span className="text-muted/40 text-[10px] font-mono flex-shrink-0">{it.hint}</span>}
              </span>
              <span className={`${a.text} text-xs font-mono font-bold flex-shrink-0`}>{it.value}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
