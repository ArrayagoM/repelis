import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Popcorn, MagnifyingGlass, X, ArrowRight, Users, LockKey } from '@phosphor-icons/react'
import { searchMulti, IMG_W342 } from '../../api/tmdb'
import { rooms, roomErrorText } from '../../lib/rooms'
import { extractCode, ROOM } from '../../lib/roomRules'
import { useAuth } from '../../lib/auth'
import { useSEO } from '../../lib/useSEO'
import { phaseLabel } from '../../components/RoomBits'

const inputCls = 'w-full bg-surface border border-white/10 rounded-xl px-4 py-2.5 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50 transition-colors'

const fromTmdb = (r) => ({ type: r.media_type === 'tv' ? 'tv' : 'movie', id: r.id, title: r.title || r.name || '', poster: r.poster_path || null, year: (r.release_date || r.first_air_date || '').slice(0, 4) || null })

/** Atajos de horario: devuelven un timestamp (ms) o null = "ya". */
const WHEN = [
  ['Ahora', () => null],
  ['En 30 min', () => Date.now() + 30 * 60_000],
  ['En 1 hora', () => Date.now() + 3_600_000],
  ['Hoy 21:00', () => { const d = new Date(); d.setHours(21, 0, 0, 0); return d.getTime() > Date.now() ? d.getTime() : d.getTime() + 86_400_000 }],
  ['Mañana 21:00', () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(21, 0, 0, 0); return d.getTime() }],
]

export default function Salas() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  useSEO({
    title: 'Salas: mirá películas en grupo y charlá en vivo',
    description: 'Armá una sala, invitá a tus amigos con un enlace y esperen juntos la hora de arranque con chat y reacciones. Gratis.',
  })
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  const [title, setTitle] = useState(() => String(location.state?.title || '').slice(0, ROOM.titleMax))
  const [item, setItem] = useState(location.state?.item || null)
  const [whenIdx, setWhenIdx] = useState(0)
  const [custom, setCustom] = useState('')
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [mine, setMine] = useState(null)
  const alive = useRef(true)

  const ready = auth.status === 'in'

  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  useEffect(() => {
    if (!ready) return
    rooms.mine().then((r) => { if (alive.current) setMine(r.ok ? r.data.rooms : []) })
  }, [ready])

  useEffect(() => {
    const q = query.trim()
    if (q.length < 2) { setResults([]); return undefined }
    const t = setTimeout(async () => {
      try {
        const { data } = await searchMulti(q)
        setResults((data.results || []).filter((r) => (r.media_type === 'movie' || r.media_type === 'tv') && (r.title || r.name)).slice(0, 6).map(fromTmdb))
      } catch { setResults([]) }
    }, 350)
    return () => clearTimeout(t)
  }, [query])

  const startsAt = custom ? new Date(custom).getTime() : WHEN[whenIdx][1]()

  const create = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setError('')
    const r = await rooms.create({ title: title.trim() || (item ? `Vemos ${item.title}` : ''), startsAt, item })
    setBusy(false)
    if (!r.ok) return setError(roomErrorText(r.error))
    navigate(`/sala/${r.data.room.code}`)
  }

  const enter = (e) => {
    e.preventDefault()
    const c = extractCode(code)
    if (!c) return setError('Pegá el enlace o el código de 7 letras de la sala.')
    navigate(`/sala/${c}`)
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-28 pb-24">
      <div className="max-w-5xl mx-auto px-6 md:px-12">
        <header className="mb-10">
          <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk flex items-center gap-3"><Popcorn size={34} weight="fill" className="text-gold" /> Salas</h1>
          <p className="text-muted text-sm mt-2 max-w-2xl leading-relaxed">
            Un cine digital para ir con amigos: armás una sala, compartís el enlace y esperan juntos la hora de arranque con chat y reacciones.
            Cada quien reproduce la película en su pantalla; la sala sirve para coordinar y charlar. Hasta {ROOM.maxMembers} personas.
          </p>
        </header>

        {auth.status !== 'in' ? (
          <div className="p-8 rounded-3xl bg-card border border-white/[0.06] text-center">
            <LockKey size={32} className="text-gold mx-auto mb-3" weight="fill" />
            <p className="text-chalk font-display font-bold text-lg">Para crear o entrar a una sala necesitás una cuenta gratis</p>
            <Link to="/cuenta?modo=registro&volver=/salas" className="inline-block mt-4 px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear mi cuenta</Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-[1.4fr_1fr] gap-8">
            <form onSubmit={create} className="p-6 rounded-3xl bg-card border border-white/[0.06] space-y-5">
              <h2 className="font-display font-bold text-xl text-chalk">Crear una sala</h2>
              <label className="block text-xs text-muted font-mono uppercase tracking-wider">Nombre
                <input value={title} onChange={(e) => setTitle(e.target.value)} maxLength={ROOM.titleMax} placeholder="Ej: Noche de terror con el grupo" className={`${inputCls} mt-1.5 normal-case tracking-normal font-sans`} />
              </label>

              <div>
                <p className="text-xs text-muted font-mono uppercase tracking-wider mb-1.5">Película o serie (opcional)</p>
                {item ? (
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-surface border border-white/10">
                    <div className="w-9 h-[3.4rem] rounded-md overflow-hidden bg-card flex-shrink-0">{item.poster && <img src={`${IMG_W342}${item.poster}`} alt="" className="w-full h-full object-cover" />}</div>
                    <p className="text-chalk text-sm font-semibold truncate flex-1">{item.title} <span className="text-muted font-mono text-xs">{item.year || ''}</span></p>
                    <button type="button" onClick={() => setItem(null)} aria-label="Quitar película" className="w-8 h-8 rounded-full text-muted hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center"><X size={14} /></button>
                  </div>
                ) : (
                  <>
                    <div className="relative">
                      <MagnifyingGlass size={16} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
                      <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Buscar un título…" aria-label="Buscar película o serie" className={`${inputCls} pl-10`} />
                    </div>
                    {results.length > 0 && (
                      <ul className="mt-2 rounded-xl bg-surface border border-white/10 divide-y divide-white/5 overflow-hidden">
                        {results.map((r) => (
                          <li key={`${r.type}:${r.id}`}>
                            <button type="button" onClick={() => { setItem(r); setQuery(''); setResults([]); if (!title.trim()) setTitle(`Vemos ${r.title}`.slice(0, ROOM.titleMax)) }}
                              className="w-full flex items-center gap-3 p-2.5 text-left hover:bg-white/5">
                              <span className="w-8 h-12 rounded overflow-hidden bg-card flex-shrink-0">{r.poster && <img src={`${IMG_W342}${r.poster}`} alt="" className="w-full h-full object-cover" />}</span>
                              <span className="text-chalk text-sm truncate">{r.title} <span className="text-muted font-mono text-xs">{r.year || ''} · {r.type === 'tv' ? 'Serie' : 'Película'}</span></span>
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                )}
              </div>

              <div>
                <p className="text-xs text-muted font-mono uppercase tracking-wider mb-1.5">¿Cuándo arrancan?</p>
                <div className="flex flex-wrap gap-2">
                  {WHEN.map(([label], i) => (
                    <button key={label} type="button" onClick={() => { setWhenIdx(i); setCustom('') }} aria-pressed={!custom && whenIdx === i}
                      className={`px-3.5 py-1.5 rounded-full border text-sm transition-colors ${!custom && whenIdx === i ? 'bg-gold text-void border-gold font-semibold' : 'glass border-white/10 text-muted hover:text-chalk'}`}>{label}</button>
                  ))}
                </div>
                <label className="block mt-3 text-xs text-muted">O elegí día y hora
                  <input type="datetime-local" value={custom} onChange={(e) => setCustom(e.target.value)} className={`${inputCls} mt-1.5`} />
                </label>
              </div>

              {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">{error}</p>}
              <button type="submit" disabled={busy} className="px-8 py-3 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors disabled:opacity-50">
                {busy ? 'Creando…' : 'Abrir la sala'}
              </button>
            </form>

            <div className="space-y-8">
              <form onSubmit={enter} className="p-6 rounded-3xl bg-card border border-white/[0.06] space-y-3">
                <h2 className="font-display font-bold text-lg text-chalk">Entrar a una sala</h2>
                <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Pegá el enlace o el código" aria-label="Enlace o código de la sala" className={inputCls} />
                <button className="w-full px-5 py-2.5 rounded-full glass border border-white/10 text-chalk text-sm font-semibold hover:border-gold/40 hover:text-gold transition-colors">Entrar</button>
              </form>

              <section aria-label="Mis salas">
                <h2 className="font-display font-bold text-lg text-chalk mb-3">Mis salas</h2>
                {mine === null ? <div className="skeleton h-16 rounded-2xl" />
                  : mine.length === 0 ? <p className="text-muted text-sm">No tenés salas abiertas.</p>
                  : (
                    <ul className="space-y-2">
                      {mine.map((r) => (
                        <li key={r.code}>
                          <Link to={`/sala/${r.code}`} className="flex items-center gap-3 p-3.5 rounded-2xl bg-card border border-white/[0.06] hover:border-gold/30 transition-colors">
                            <span className="min-w-0 mr-auto">
                              <span className="block text-chalk text-sm font-semibold truncate">{r.title}</span>
                              <span className="block text-muted text-xs mt-0.5">{phaseLabel(r)} · <Users size={11} className="inline -mt-0.5" /> {r.online}</span>
                            </span>
                            <ArrowRight size={14} className="text-muted" />
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
              </section>
            </div>
          </div>
        )}
      </div>
    </motion.main>
  )
}
