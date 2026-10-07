import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion } from 'framer-motion'
import { Popcorn, Crown, Copy, Check, WhatsappLogo, SignOut, ChatCircleText, Clock, Play, X, Users, LockKey, ArrowLeft, MicrophoneSlash, Microphone } from '@phosphor-icons/react'
import { IMG_W342 } from '../../api/tmdb'
import { rooms, roomErrorText } from '../../lib/rooms'
import { EMOJIS, ROOM, extractCode } from '../../lib/roomRules'
import { useRoomSession } from '../../lib/roomSession'
import { useAuth } from '../../lib/auth'
import { openPlayer } from '../../store/slices/playerSlice'
import { showToast } from '../../lib/toast'
import { useSEO } from '../../lib/useSEO'
import { Avatar } from '../../components/Community'
import VoiceControls from '../../components/VoiceControls'
import SyncControls from '../../components/SyncControls'
import { phaseLabel, useCountdown } from '../../components/RoomBits'

export default function Sala() {
  useEffect(() => { window.scrollTo(0, 0) }, [])
  const { code: raw } = useParams()
  const code = extractCode(raw)
  const auth = useAuth()
  const s = useRoomSession()
  const ready = auth.status === 'in'

  const [info, setInfo] = useState({ loading: true, room: null, error: '' })
  useSEO({ title: info.room ? `Sala: ${info.room.title}` : 'Sala', description: 'Sala de cine digital de Life High', noindex: true })

  useEffect(() => {
    if (!code) return setInfo({ loading: false, room: null, error: 'room_not_found' })
    let cancelled = false
    rooms.info(code).then((r) => { if (!cancelled) setInfo(r.ok ? { loading: false, room: r.data.room, error: '' } : { loading: false, room: null, error: r.error }) })
    return () => { cancelled = true }
  }, [code])

  // Entrar a la sala = activarla en la raíz de la app (sigue viva si navegás o abrís la película)
  useEffect(() => { if (ready && code && info.room && s.code !== code) s.enter(code) }, [ready, code, info.room, s])

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
          <p className="text-muted text-sm">Para entrar necesitás una cuenta gratis.</p>
          <Link to={`/cuenta?modo=registro&volver=/sala/${code}`} className="inline-block px-6 py-2.5 rounded-full bg-gold text-void font-bold text-sm hover:bg-gold-hi">Crear cuenta o ingresar</Link>
        </div>
      </main>
    )
  }

  if (s.code === code && s.live.status === 'error') {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <Popcorn size={40} className="text-gold" />
        <p className="text-chalk font-display font-bold text-xl max-w-md">{roomErrorText(s.live.error)}</p>
        <Link to="/salas" onClick={() => s.exit()} className="text-gold text-sm hover:underline">Ir a Salas</Link>
      </main>
    )
  }

  return <RoomView code={code} base={info.room} />
}

/** Una persona en la sala: círculo con su inicial, @usuario y, cuando haya voz, anillo si está hablando. */
function Tile({ m, canKick, onKick }) {
  return (
    <li className="relative flex flex-col items-center gap-1.5 p-3 rounded-2xl bg-surface border border-white/[0.06] w-28 sm:w-32">
      <span className={`rounded-full p-0.5 transition-shadow ${m.speaking ? 'ring-2 ring-emerald-400 shadow-[0_0_18px_rgba(52,211,153,0.6)]' : 'ring-1 ring-white/10'}`}>
        <Avatar name={m.name || m.handle} size={56} />
      </span>
      <Link to={`/u/${m.handle}`} className="text-chalk text-xs font-semibold hover:text-gold truncate max-w-full">@{m.handle}</Link>
      <span className="flex items-center gap-1 h-4">
        {m.host && <Crown size={12} weight="fill" className="text-gold" aria-label="Anfitrión" />}
        {m.me && <span className="text-muted text-[10px]">vos</span>}
        {m.muted && <MicrophoneSlash size={12} className="text-red-300" aria-label="Micrófono apagado" />}
        {m.inVoice && !m.muted && <Microphone size={12} className="text-emerald-300" aria-label="En la llamada" />}
      </span>
      {canKick && <button onClick={onKick} aria-label={`Sacar a @${m.handle}`} className="absolute top-1 right-1 w-6 h-6 rounded-full text-muted hover:text-red-300 hover:bg-red-500/10 flex items-center justify-center"><X size={12} /></button>}
    </li>
  )
}

function RoomView({ code, base }) {
  const s = useRoomSession()
  const live = s.live
  const navigate = useNavigate()
  const dispatch = useDispatch()
  const room = live.room || base
  const { text: countdown, started } = useCountdown(room.phase === 'scheduled' ? room.startsAt : null, live.offset)
  const scheduled = room.phase === 'scheduled' && !started
  const closed = room.phase === 'closed' || room.phase === 'expired'
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(false)
  const [when, setWhen] = useState('')
  const announced = useRef(false)
  const [autoOpen, setAutoOpen] = useState(() => { try { return localStorage.getItem('lifehigh:room:autoopen') !== '0' } catch { return true } })
  const toggleAuto = (v) => { setAutoOpen(v); try { localStorage.setItem('lifehigh:room:autoopen', v ? '1' : '0') } catch { /* sin storage */ } }

  const url = typeof window !== 'undefined' ? `${window.location.origin}/sala/${code}` : ''
  const waLink = `https://wa.me/?text=${encodeURIComponent(`Sumate a mi sala "${room.title}" en Life High: ${url}`)}`

  useEffect(() => {
    if (room.phase === 'scheduled' && started && !announced.current) {
      announced.current = true
      showToast({ icon: '🍿', title: '¡Es la hora!', text: autoOpen && room.item?.type === 'movie' ? 'Abrimos la película para que todos arranquen juntos.' : 'Dale play a la película.', ttl: 6000, tone: 'green' })
      if (autoOpen && room.item?.type === 'movie') watchHere()          // a la hora exacta todos abren el reproductor a la vez
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started, room.phase])

  const copy = async () => { try { await navigator.clipboard.writeText(url); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch { /* sin portapapeles */ } }
  const leave = async () => { await s.exit(); navigate('/salas') }
  const close = async () => { if (window.confirm('¿Cerrar la sala para todos?')) await rooms.close(code) }
  const saveWhen = async () => {
    const r = await rooms.update(code, { startsAt: when ? new Date(when).getTime() : null })
    if (r.ok) setEditing(false); else showToast({ icon: '⚠️', title: roomErrorText(r.error), ttl: 4000, tone: 'blue' })
  }
  const kick = async (handle) => { if (window.confirm(`¿Sacar a @${handle} de la sala?`)) await rooms.kick(code, handle) }

  // Ver la película acá: el reproductor se abre en esta misma pestaña y la barra de la sala queda por encima
  const watchHere = () => {
    const it = room.item
    if (!it) return
    if (it.type === 'tv') return navigate(`/tv/${it.id}`)
    dispatch(openPlayer({ movieId: it.id, title: it.title, mediaType: 'movie', item: { id: it.id, type: 'movie', title: it.title, poster: it.poster, date: it.year ? `${it.year}-01-01` : null } }))
  }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-24 pb-32">
      <div className="max-w-4xl mx-auto px-4 md:px-8 space-y-5">
        <header className="flex flex-wrap items-center gap-3">
          <Link to="/salas" aria-label="Volver a Salas" className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold"><ArrowLeft size={16} /></Link>
          <div className="mr-auto min-w-0">
            <h1 className="font-display font-extrabold text-xl sm:text-2xl text-chalk truncate">{room.title}</h1>
            <p className="text-muted text-xs">Anfitrión: @{room.host?.handle || '—'} · <Users size={11} className="inline -mt-0.5" /> {live.members.length}/{ROOM.maxMembers}</p>
          </div>
        </header>

        {/* Escenario: hora de arranque + película */}
        <section className="p-6 rounded-3xl bg-gradient-to-b from-card to-void border border-white/[0.06] text-center space-y-4">
          {closed ? (
            <p className="text-muted text-sm py-4">La sala terminó. ¡Gracias por venir!</p>
          ) : scheduled ? (
            <>
              <p className="text-muted text-xs uppercase tracking-widest font-semibold flex items-center justify-center gap-1.5"><Clock size={13} /> Arranca en</p>
              <p className="font-display font-extrabold text-6xl sm:text-7xl text-gold tabular-nums">{countdown}</p>
              <p className="text-muted text-xs">{phaseLabel(room)}</p>
            </>
          ) : (
            <p className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-400/30 text-emerald-300 text-xs font-semibold uppercase tracking-widest"><Play size={12} weight="fill" /> ¡Es la hora!</p>
          )}

          {room.item && (
            <div className="mx-auto max-w-sm flex items-center gap-3 p-3 rounded-2xl bg-surface border border-white/[0.06] text-left">
              <div className="w-14 h-[5.25rem] rounded-lg overflow-hidden bg-card flex-shrink-0">{room.item.poster && <img src={`${IMG_W342}${room.item.poster}`} alt="" className="w-full h-full object-cover" />}</div>
              <div className="min-w-0">
                <p className="text-chalk text-sm font-semibold leading-tight">{room.item.title}</p>
                <p className="text-muted text-xs font-mono">{room.item.year || ''}{room.item.type === 'tv' ? ' · Serie' : ''}</p>
                {!closed && <button onClick={watchHere} className="mt-2 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-gold text-void text-xs font-bold hover:bg-gold-hi transition-colors"><Play size={11} weight="fill" /> {room.item.type === 'tv' ? 'Elegir capítulo' : 'Ver la película acá'}</button>}
              </div>
            </div>
          )}
          {!closed && room.item?.type === 'movie' && (
            <label className="flex items-center justify-center gap-2 text-xs text-muted cursor-pointer">
              <input type="checkbox" checked={autoOpen} onChange={(e) => toggleAuto(e.target.checked)} className="accent-[#E8A020]" /> Abrir la película sola a la hora de arranque
            </label>
          )}
          {!closed && <p className="text-muted/70 text-xs max-w-md mx-auto">Mientras mirás, la barra de la sala queda abajo para hablar y reaccionar sin tapar la pantalla. Cada quien reproduce la película en su pantalla.</p>}
        </section>

        {/* Personas */}
        <section aria-label="Personas en la sala">
          <h2 className="font-display font-bold text-sm text-chalk mb-3">En la sala</h2>
          <ul className="flex flex-wrap gap-3">
            {s.members.map((m) => <Tile key={m.handle} m={m} canKick={room.isHost && !m.me && !closed} onKick={() => kick(m.handle)} />)}
            {live.status !== 'in' && <li className="text-muted text-sm">Entrando…</li>}
          </ul>
        </section>

        {room.isHost && !closed && (
          <section className="p-4 rounded-2xl bg-card border border-white/[0.06] space-y-2">
            <h2 className="font-display font-bold text-sm text-chalk">Anfitrión</h2>
            {editing ? (
              <div className="flex flex-wrap items-center gap-2">
                <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} aria-label="Nuevo horario" className="bg-surface border border-white/10 rounded-xl px-3 py-2 text-chalk text-sm" />
                <button onClick={saveWhen} className="px-4 py-1.5 rounded-full bg-gold text-void text-xs font-bold">Guardar</button>
                <button onClick={() => rooms.update(code, { startsAt: null }).then(() => setEditing(false))} className="px-4 py-1.5 rounded-full glass border border-white/10 text-muted text-xs">Sin horario</button>
                <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-muted text-xs">Cancelar</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="px-4 py-1.5 rounded-full glass border border-white/10 text-chalk text-xs hover:border-gold/40">Cambiar horario</button>
                <button onClick={close} className="px-4 py-1.5 rounded-full glass border border-white/10 text-red-300 text-xs hover:border-red-400/50">Cerrar sala</button>
              </div>
            )}
          </section>
        )}
      </div>

      {/* Barra de la sala (estilo llamada) */}
      <div className="fixed z-[130] left-1/2 -translate-x-1/2 bottom-4 max-w-[calc(100vw-1rem)]">
        <div className="flex items-center gap-1.5 px-2 py-2 rounded-full bg-card/95 backdrop-blur border border-white/10 shadow-2xl" role="toolbar" aria-label="Controles de la sala">
          <VoiceControls size={40} />
          <SyncControls size={40} />
          <div className="flex gap-0.5 px-1" role="group" aria-label="Reacciones">
            {EMOJIS.map((e) => <button key={e} onClick={() => !closed && live.react(e)} disabled={closed} aria-label={`Reaccionar ${e}`} className="w-9 h-9 rounded-full text-xl hover:scale-125 transition disabled:opacity-40">{e}</button>)}
          </div>
          <span className="w-px h-6 bg-white/10" aria-hidden="true" />
          <button onClick={() => s.setChatOpen(!s.chatOpen)} aria-pressed={s.chatOpen} aria-label={s.unread ? `Chat (${s.unread} sin leer)` : 'Chat'} className="relative w-10 h-10 rounded-full text-muted hover:text-gold hover:bg-white/5 flex items-center justify-center">
            <ChatCircleText size={20} />
            {s.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{s.unread > 9 ? '9+' : s.unread}</span>}
          </button>
          <button onClick={copy} aria-label="Copiar enlace de invitación" className="w-10 h-10 rounded-full text-muted hover:text-gold hover:bg-white/5 flex items-center justify-center">{copied ? <Check size={18} className="text-emerald-300" /> : <Copy size={18} />}</button>
          <a href={waLink} target="_blank" rel="noopener noreferrer" aria-label="Invitar por WhatsApp" className="w-10 h-10 rounded-full text-emerald-300 hover:bg-emerald-500/15 flex items-center justify-center"><WhatsappLogo size={20} weight="fill" /></a>
          <button onClick={leave} aria-label="Salir de la sala" className="w-10 h-10 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/30 flex items-center justify-center"><SignOut size={18} /></button>
        </div>
      </div>
    </motion.main>
  )
}
