// Nieve suave para las cabeceras navideñas. Solo CSS (sin JS por copo), no atrapa clics y se apaga en equipos livianos,
// con "reducir movimiento" y mientras suena el reproductor (ver index.css).
const FLAKES = Array.from({ length: 26 }, (_, i) => ({
  left: `${(i * 37 + 11) % 100}%`,
  size: 2 + ((i * 5) % 4),
  delay: `${-((i * 7) % 13)}s`,
  duration: `${9 + ((i * 3) % 8)}s`,
  drift: `${((i % 2 ? 1 : -1) * (10 + ((i * 11) % 30)))}px`,
  opacity: 0.35 + ((i * 13) % 5) / 10,
}))

export default function Snow() {
  return (
    <div className="snow" aria-hidden="true">
      {FLAKES.map((f, i) => (
        <i key={i} style={{ left: f.left, width: f.size, height: f.size, opacity: f.opacity, animationDelay: f.delay, animationDuration: f.duration, '--drift': f.drift }} />
      ))}
    </div>
  )
}
