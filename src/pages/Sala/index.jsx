import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { motion } from 'framer-motion'
import { Popcorn, Crown, Copy, Check, WhatsappLogo, SignOut, PaperPlaneRight, Clock, Play, X, Users, LockKey, ArrowLeft } from '@phosphor-icons/react'
import { IMG_W342 } from '../../api/tmdb'
import { rooms, roomErrorText, useRoom } from '../../lib/rooms'
import { EMOJIS, ROOM, extractCode } from '../../lib/roomRules'
import { useAuth } from '../../lib/auth'
import { useMe } from '../../lib/social'
import { showToast } from '../../lib/toast'
import { useSEO } from '../../lib/useSEO'
import { FloatingReactions, phaseLabel, useCountdown } from '../../components/RoomBits'

const timeOf = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

export default function Sala() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { code: raw } = useParams()
  const code = extractCode(raw)
  const navigate = useNavigate()
  const auth = useAuth()
  const me = useMe()
  const ready = auth.status === 'in' && !!me.data?.profile

  const [info, setInfo] = useState({ loading: true, room: null, error: '' })
  useSEO({ title: info.room ? `Sala: ${info.room.title}` : 'Sala', description: 'Sala de cine digital de Life High', noindex: true })

  useEffect(() => {
    if (!code) return setInfo({ loading: false, room: null, error: 'room_not_found' })
    let cancelled = false
    rooms.info(code).then((r) => { if (!cancelled) setInfo(r.ok ? { loading: false, room: r.data.room, error: '' } : { loading: false, room: null, error: r.error }) })
    return () => { cancelled = true }
  }, [code])

  const live = useRoom(code, ready && !!info.room)

  if (info.loading) return <div className="min-h-screen bg-void pt-32 px-6"><div className="max-w-5xl mx-auto skeleton h-72 rounded-3xl" /></div>
  if (!info.room) {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Popcorn size={40} className="text-gold" />
        <p className="text-chalk font-display font-bold text-xl">{roomErrorText(info.error || 'room_not_found')}</p>
        <Link to="/salas" className="text-gold text-sm hover:underline">Ir a Salas</Link>
      </main>
    )
  }

  // Todavía sin cuenta o sin @usuario: vista previa de la sala con el pedido para entrar
  if (!ready) {
    const r = info.room
    return (
      <main className="min-h-screen bg-void pt-28 pb-24 px-6">
        <div className="max-w-xl mx-auto p-8 rounded-3xl bg-card border border-white/[0.06] text-center space-y-3">
          <Popcorn size={36} className="text-gold mx-auto" weight="fill" />
          <h1 className="font-display font-extrabold text-2xl text-chalk">{r.title}</h1>
          <p className="text-muted text-sm">Sala de @{r.host?.handle || 'alguien'} · {phaseLabel(r)} · {r.online} conectados</p>
          {r.item && <p className="text-chalk/80 text-sm">Película: <strong>{r.item.title}</strong></p>}
          <LockKey size={20} className="text-gold mx-auto mt-2" />
          {auth.status !== 'in'
            ? <><p className="text-muted text-sm">Para entrar al chat necesitás una cuenta gratis.</p>
                <Link to={`/cuenta?modo=registro&volver=/sala/${code}`} className="inline-block px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear cuenta o ingresar</Link></>
            : <><p className="text-muted text-sm">Elegí tu @usuario para que te vean en el chat.</p>
                <Link to="/perfil" className="inline-block px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear mi perfil</Link></>}
        </div>
      </main>
    )
  }

  if (live.status === 'error') {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Popcorn size={40} className="text-gold" />
        <p className="text-chalk font-display font-bold text-xl max-w-md">{roomErrorText(live.error)}</p>
        <Link to="/salas" className="text-gold text-sm hover:underline">Ir a Salas</Link>
      </main>
    )
  }

  return <RoomView code={code} live={live} base={info.room} navigate={navigate} />
}

function RoomView({ code, live, base, navigate }) {
  const room = live.room || base
  const { text: countdown, started } = useCountdown(room.phase === 'scheduled' ? room.startsAt : null, live.offset)
  const scheduled = room.phase === 'scheduled' && !started
  const closed = room.phase === 'closed' || room.phase === 'expired'
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [err, setErr] = useState('')
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState('')
  const box = useRef(null)
  const stick = useRef(true)
  const announced = useRef(false)

  const url = typeof window !== 'undefined' ? `${window.location.origin}/sala/${code}` : ''

  // Auto-scroll solo si la persona ya estaba abajo (no le movemos la pantalla si está leyendo arriba)
  useEffect(() => {
    const el = box.current
    if (el && stick.current) el.scrollTop = el.scrollHeight
  }, [live.messages.length])
  const onScroll = () => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }

  // Aviso cuando llega la hora
  useEffect(() => {
    if (room.phase === 'scheduled' && started && !announced.current) {
      announced.current = true
      showToast({ icon: '🍿', title: '¡Es la hora!', text: 'Cada quien le da play a su película.', ttl: 6000, tone: 'green' })
    }
  }, [started, room.phase])

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sending || closed) return
    setSending(true); setErr('')
    const r = await live.say(t)
    setSending(false)
    if (r.ok) { setText(''); stick.current = true } else setErr(roomErrorText(r.error))
  }
  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sin portapapeles */ } }
  const leave = async () => { await live.leave(); navigate('/salas') }
  const close = async () => { if (window.confirm('¿Cerrar la sala para todos?')) { await rooms.close(code) } }
  const saveWhen = async () => {
    const startsAt = when ? new Date(when).getTime() : null
    const r = await rooms.update(code, { startsAt })
    if (r.ok) setEditing(false); else showToast({ icon: '⚠️', title: roomErrorText(r.error), ttl: 4000, tone: 'blue' })
  }
  const kick = async (handle) => { if (window.confirm(`¿Sacar a @${handle} de la sala?`)) await rooms.kick(code, handle) }
  const waLink = `https://wa.me/?text=${encodeURIComponent(`Sumate a mi sala "${room.title}" en Life High: ${url}`)}`
  const itemLink = room.item ? `/${room.item.type}/${room.item.id}` : null

  const sorted = useMemo(() => live.members, [live.members])

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-24 pb-10">
      <FloatingReactions items={live.fx} onDone={live.consumeFx} />
      <div className="max-w-6xl mx-auto px-4 md:px-8 space-y-4">
        <header className="flex flex-wrap items-center gap-3">
          <Link to="/salas" aria-label="Volver a Salas" className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold"><ArrowLeft size={16} /></Link>
          <div className="mr-auto min-w-0">
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-chalk truncate">{room.title}</h1>
            <p className="text-muted text-xs">Anfitrión: @{room.host?.handle || '—'} · <Users size={11} className="inline -mt-0.5" /> {sorted.length}/{ROOM.maxMembers}</p>
          </div>
          <button onClick={copy} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-chalk text-sm hover:border-gold/40 hover:text-gold transition-colors">
            {copied ? <Check size={14} className="text-emerald-300" /> : <Copy size={14} />} {copied ? 'Copiado' : 'Copiar enlace'}
          </button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-sm hover:bg-emerald-500/25 transition-colors">
            <WhatsappLogo size={15} weight="fill" /> Invitar
          </a>
          <button onClick={leave} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:text-red-300 hover:border-red-400/40 transition-colors"><SignOut size={14} /> Salir</button>
        </header>

        <div className="grid lg:grid-cols-[320px_1fr] gap-4">
          {/* Lateral: película, hora y personas */}
          <aside className="space-y-4">
            <section className="p-4 rounded-3xl bg-card border border-white/[0.06] text-center space-y-3">
              {closed ? (
                <p className="text-muted text-sm py-4">La sala terminó. ¡Gracias por venir!</p>
              ) : scheduled ? (
                <>
                  <p className="text-muted text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5"><Clock size={13} /> Arranca en</p>
                  <p aria-live="off" className="font-display font-extrabold text-5xl text-gold tabular-nums">{countdown}</p>
                  <p className="text-muted text-xs">{phaseLabel(room)}</p>
                </>
              ) : (
                <div className="py-2 space-y-1">
                  <p className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-widest"><Play size={12} weight="fill" /> ¡Es la hora!</p>
                  <p className="text-chalk text-sm">Cada quien le da play a su película y charlamos acá.</p>
                </div>
              )}
              {room.item && (
                <div className="flex items-center gap-3 p-2.5 rounded-2xl bg-surface border border-white/[0.06] text-left">
                  <div className="w-12 h-[4.5rem] rounded-lg overflow-hidden bg-card flex-shrink-0">{room.item.poster && <img src={`${IMG_W342}${room.item.poster}`} alt="" className="w-full h-full object-cover" />}</div>
                  <div className="min-w-0">
                    <p className="text-chalk text-sm font-semibold leading-tight">{room.item.title}</p>
                    <p className="text-muted text-xs font-mono">{room.item.year || ''}{room.item.type === 'tv' ? ' · Serie' : ''}</p>
                    {!closed && <Link to={itemLink} target="_blank" className="inline-flex items-center gap-1 mt-1.5 text-xs text-gold hover:underline"><Play size={11} weight="fill" /> Abrir en otra pestaña</Link>}
                  </div>
                </div>
              )}
              {room.isHost && !closed && (
                <div className="text-left space-y-2 pt-1">
                  {editing ? (
                    <div className="space-y-2">
                      <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Nuevo horario" className="w-full bg-surface border border-white/10 rounded-xl px-3 py-2 text-chalk text-sm" />
                      <div className="flex gap-2">
                        <button onClick={saveWhen} className="px-4 py-1.5 rounded-full bg-gold text-void text-xs font-bold">Guardar</button>
                        <button onClick={() => { setWhen(''); rooms.update(code, { startsAt: null }).then(() => setEditing(false)) }} className="px-4 py-1.5 rounded-full glass border border-white/10 text-muted text-xs">Sin horario</button>
                        <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-muted text-xs">Cancelar</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex gap-2">
                      <button onClick={() => setEditing(true)} className="px-4 py-1.5 rounded-full glass border border-white/10 text-chalk text-xs hover:border-gold/40">Cambiar horario</button>
                      <button onClick={close} className="px-4 py-1.5 rounded-full glass border border-white/10 text-red-300 text-xs hover:border-red-400/50">Cerrar sala</button>
                    </div>
                  )}
                </div>
              )}
            </section>

            <section aria-label="Personas" className="p-4 rounded-3xl bg-card border border-white/[0.06]">
              <h2 className="font-display font-bold text-sm text-chalk mb-3">En la sala ({sorted.length})</h2>
              <ul className="space-y-1.5">
                {sorted.map((m) => (
                  <li key={m.handle} className="flex items-center gap-2 text-sm">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" aria-hidden="true" />
                    <Link to={`/u/${m.handle}`} className="text-chalk hover:text-gold truncate">@{m.handle}</Link>
                    {m.host && <Crown size={13} weight="fill" className="text-gold flex-shrink-0" aria-label="Anfitrión" />}
                    {m.me && <span className="text-muted text-[11px]">(vos)</span>}
                    {room.isHost && !m.me && !closed && <button onClick={() => kick(m.handle)} aria-label={`Sacar a @${m.handle}`} className="ml-auto w-6 h-6 rounded-full text-muted hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center"><X size={12} /></button>}
                  </li>
                ))}
              </ul>
            </section>
          </aside>

          {/* Chat */}
          <section aria-label="Chat de la sala" className="rounded-3xl bg-card border border-white/[0.06] flex flex-col h-[70vh] lg:h-[calc(100vh-9rem)] min-h-[24rem]">
            <div ref={box} onScroll={onScroll} className="flex-1 overflow-y-auto p-4 space-y-2" role="log" aria-live="polite">
              {live.messages.length === 0 && <p className="text-muted text-sm text-center py-8">Todavía no hay mensajes. ¡Rompé el hielo!</p>}
              {live.messages.map((m) => m.kind === 'sys' ? (
                <p key={m.seq} className="text-center text-muted/70 text-xs py-0.5">{m.text}</p>
              ) : (
                <div key={m.seq} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3.5 py-2 ${m.mine ? 'bg-gold/15 border border-gold/25' : 'bg-surface border border-white/[0.06]'}`}>
                    {!m.mine && <p className="text-gold text-[11px] font-semibold mb-0.5">@{m.handle}</p>}
                    <p className="text-chalk text-sm leading-snug break-words whitespace-pre-line">{m.text}</p>
                    <p className="text-muted/60 text-[10px] text-right mt-0.5">{timeOf(m.at)}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="border-t border-white/[0.06] p-3 space-y-2">
              <div className="flex gap-1.5 flex-wrap" role="group" aria-label="Reacciones">
                {EMOJIS.map((e) => (
                  <button key={e} onClick={() => !closed && live.react(e)} disabled={closed} aria-label={`Reaccionar ${e}`}
                    className="w-10 h-10 rounded-full glass border border-white/10 text-xl hover:scale-110 hover:border-gold/40 transition disabled:opacity-40">{e}</button>
                ))}
              </div>
              {err && <p role="alert" className="text-red-300 text-xs">{err}</p>}
              <form onSubmit={send} className="flex gap-2">
                <input value={text} onChange={(e) => setText(e.target.value)} maxLength={ROOM.textMax} disabled={closed} aria-label="Escribí un mensaje"
                  placeholder={closed ? 'La sala terminó' : 'Escribí un mensaje…'}
                  className="flex-1 bg-surface border border-white/10 rounded-full px-4 py-2.5 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50" />
                <button disabled={sending || !text.trim() || closed} aria-label="Enviar" className="w-11 h-11 rounded-full bg-gold text-void flex items-center justify-center hover:bg-gold-hi transition-colors disabled:opacity-40"><PaperPlaneRight size={18} weight="fill" /></button>
              </form>
            </div>
          </section>
        </div>
      </div>
    </motion.main>
  )
}
