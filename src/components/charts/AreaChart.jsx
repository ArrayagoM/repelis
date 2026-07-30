import { useState, useMemo, useRef } from 'react'
import { scaleLinear } from 'd3-scale'

// Serie temporal: área para visitantes + línea para páginas vistas.
// Un solo eje Y (misma unidad: conteo de eventos). Crosshair + tooltip.
//
// props.data: [{ date: 'YYYY-MM-DD', visitors: n, pageviews: n }]
export default function AreaChart({ data = [], height = 220 }) {
  const [hover, setHover] = useState(null)   // índice bajo el cursor
  const wrapRef = useRef(null)

  const W = 720, H = height
  const PAD = { top: 16, right: 16, bottom: 26, left: 34 }
  const innerW = W - PAD.left - PAD.right
  const innerH = H - PAD.top - PAD.bottom

  const { xFor, yFor, areaPath, linePath, maxY, points } = useMemo(() => {
    const n = Math.max(1, data.length)
    const maxY = Math.max(4, ...data.map((d) => Math.max(d.visitors, d.pageviews)))
    const x = scaleLinear().domain([0, n - 1 || 1]).range([PAD.left, PAD.left + innerW])
    const y = scaleLinear().domain([0, maxY]).range([PAD.top + innerH, PAD.top]).nice()

    const pts = data.map((d, i) => ({
      i, d,
      x: x(i),
      yV: y(d.visitors),
      yP: y(d.pageviews),
    }))

    const line = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yV}`).join(' ')
    const area = pts.length
      ? `${line} L${pts[pts.length - 1].x},${y(0)} L${pts[0].x},${y(0)} Z`
      : ''
    const pline = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yP}`).join(' ')

    return { xFor: x, yFor: y, areaPath: area, linePath: line, pviewLine: pline, maxY, points: pts }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, height])

  const pviewLine = useMemo(
    () => points.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.yP}`).join(' '),
    [points],
  )

  const onMove = (e) => {
    const rect = wrapRef.current?.getBoundingClientRect()
    if (!rect || !points.length) return
    const relX = ((e.clientX - rect.left) / rect.width) * W
    let nearest = 0, best = Infinity
    points.forEach((p) => {
      const dist = Math.abs(p.x - relX)
      if (dist < best) { best = dist; nearest = p.i }
    })
    setHover(nearest)
  }

  const fmtDay = (iso) => {
    try {
      return new Date(iso + 'T00:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })
    } catch { return iso }
  }

  const yTicks = yFor.ticks(4)
  const hv = hover != null ? points[hover] : null

  return (
    <div ref={wrapRef} className="relative w-full"
      onMouseMove={onMove} onMouseLeave={() => setHover(null)}>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height }} preserveAspectRatio="none">
        {/* Grid horizontal recesivo */}
        {yTicks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={PAD.left + innerW} y1={yFor(t)} y2={yFor(t)}
              stroke="#ffffff" strokeOpacity="0.05" strokeWidth="1" />
            <text x={PAD.left - 6} y={yFor(t) + 3} textAnchor="end"
              fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#8a8a9a">{t}</text>
          </g>
        ))}

        {/* Área visitantes */}
        <defs>
          <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#E8A020" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#E8A020" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        <path d={areaPath} fill="url(#areaGrad)" />
        <path d={linePath} fill="none" stroke="#E8A020" strokeWidth="2"
          strokeLinejoin="round" strokeLinecap="round" />

        {/* Línea páginas vistas */}
        <path d={pviewLine} fill="none" stroke="#38BDF8" strokeWidth="2"
          strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" opacity="0.85" />

        {/* Etiquetas eje X (cada 1 si son pocos días) */}
        {points.map((p) => (
          <text key={p.i} x={p.x} y={H - 8} textAnchor="middle"
            fontSize="9" fontFamily="JetBrains Mono, monospace" fill="#8a8a9a">
            {fmtDay(p.d.date)}
          </text>
        ))}

        {/* Crosshair + marcadores */}
        {hv && (
          <g>
            <line x1={hv.x} x2={hv.x} y1={PAD.top} y2={PAD.top + innerH}
              stroke="#ffffff" strokeOpacity="0.15" strokeWidth="1" />
            <circle cx={hv.x} cy={hv.yV} r="4" fill="#E8A020" stroke="#08080E" strokeWidth="2" />
            <circle cx={hv.x} cy={hv.yP} r="4" fill="#38BDF8" stroke="#08080E" strokeWidth="2" />
          </g>
        )}
      </svg>

      {/* Leyenda */}
      <div className="flex items-center gap-4 mt-1 px-1">
        <span className="flex items-center gap-1.5 text-[10px] text-muted font-mono">
          <span className="w-3 h-0.5 rounded-full bg-gold inline-block" /> Visitantes
        </span>
        <span className="flex items-center gap-1.5 text-[10px] text-muted font-mono">
          <span className="w-3 h-0 border-t-2 border-dashed border-sky-400 inline-block" /> Páginas vistas
        </span>
      </div>

      {/* Tooltip */}
      {hv && (
        <div
          className="absolute pointer-events-none bg-[#0E0E18] border border-white/15 rounded-lg px-3 py-2 shadow-xl z-10 text-[11px]"
          style={{
            left: `${(hv.x / W) * 100}%`,
            top: 4,
            transform: `translateX(${hv.x > W / 2 ? '-110%' : '10%'})`,
          }}
        >
          <p className="text-chalk font-semibold mb-1">{fmtDay(hv.d.date)}</p>
          <p className="text-gold flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-gold" /> {hv.d.visitors} visitantes
          </p>
          <p className="text-sky-300 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-sky-400" /> {hv.d.pageviews} páginas
          </p>
        </div>
      )}
    </div>
  )
}
