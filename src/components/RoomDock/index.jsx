import { useEffect, useRef, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { useSelector } from 'react-redux'
import { Popcorn, ChatCircleText, X, PaperPlaneRight, SignOut, Users, Smiley } from '@phosphor-icons/react'
import { useRoomSession } from '../../lib/roomSession'
import { EMOJIS, ROOM } from '../../lib/roomRules'
import { roomErrorText } from '../../lib/rooms'
import { FloatingReactions, useCountdown } from '../RoomBits'
import VoiceControls from '../VoiceControls'
import SyncControls from '../SyncControls'

const timeOf = (ms) => new Date(ms).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })

/** Cajón de chat: cerrado por defecto para no tapar la película. Se abre desde la barra de la sala. */
export function RoomChatDrawer() {
  const s = useRoomSession()
  const [text, setText] = useState('')
  const [err, setErr] = useState('')
  const [sending, setSending] = useState(false)
  const box = useRef(null)
  const stick = useRef(true)
  const messages = s?.live.messages || []

  useEffect(() => { const el = box.current; if (el && stick.current) el.scrollTop = el.scrollHeight }, [messages.length, s?.chatOpen])
  if (!s?.code || !s.chatOpen) return null
  const closed = s.live.room?.phase === 'closed' || s.live.room?.phase === 'expired'

  const send = async (e) => {
    e.preventDefault()
    const t = text.trim()
    if (!t || sending || closed) return
    setSending(true); setErr('')
    const r = await s.live.say(t)
    setSending(false)
    if (r.ok) { setText(''); stick.current = true } else setErr(roomErrorText(r.error))
  }

  return (
    <aside aria-label="Chat de la sala" className="fixed z-[140] right-3 bottom-20 top-20 w-[min(22rem,calc(100vw-1.5rem))] flex flex-col rounded-3xl bg-card/95 backdrop-blur border border-white/10 shadow-2xl">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <ChatCircleText size={16} className="text-gold" />
        <h2 className="font-display font-bold text-sm text-chalk mr-auto">Chat de la sala</h2>
        <button onClick={() => s.setChatOpen(false)} aria-label="Cerrar el chat" className="w-7 h-7 rounded-full text-muted hover:text-chalk hover:bg-white/5 flex items-center justify-center"><X size={14} /></button>
      </div>
      <div ref={box} onScroll={() => { const el = box.current; if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < 60 }}
        className="flex-1 overflow-y-auto p-3 space-y-2" role="log" aria-live="polite">
        {messages.length === 0 && <p className="text-muted text-xs text-center py-6">Todavía no hay mensajes.</p>}
        {messages.map((m) => m.kind === 'sys' ? (
          <p key={m.seq} className="text-center text-muted/70 text-[11px]">{m.text}</p>
        ) : (
          <div key={m.seq} className={`flex ${m.mine ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[88%] rounded-2xl px-3 py-1.5 ${m.mine ? 'bg-gold/15 border border-gold/25' : 'bg-surface border border-white/[0.06]'}`}>
              {!m.mine && <p className="text-gold text-[10px] font-semibold">@{m.handle}</p>}
              <p className="text-chalk text-sm leading-snug break-words whitespace-pre-line">{m.text}</p>
              <p className="text-muted/60 text-[10px] text-right">{timeOf(m.at)}</p>
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} className="p-3 border-t border-white/[0.06] space-y-1.5">
        {err && <p role="alert" className="text-red-300 text-xs">{err}</p>}
        <div className="flex gap-2">
          <input value={text} onChange={(e) => setText(e.target.value)} maxLength={ROOM.textMax} disabled={closed} aria-label="Escribí un mensaje"
            placeholder={closed ? 'La sala terminó' : 'Escribí un mensaje…'}
            className="flex-1 min-w-0 bg-surface border border-white/10 rounded-full px-4 py-2 text-chalk text-sm placeholder:text-muted/50 focus:outline-none focus:border-gold/50" />
          <button disabled={sending || !text.trim() || closed} aria-label="Enviar" className="w-10 h-10 rounded-full bg-gold text-void flex items-center justify-center disabled:opacity-40"><PaperPlaneRight size={16} weight="fill" /></button>
        </div>
      </form>
    </aside>
  )
}

/**
 * Barra flotante de la sala ("llamada"): aparece cuando estás en una sala y no estás mirando la pantalla de la sala,
 * o mientras se reproduce una película (por encima del reproductor). Compacta para no tapar el video.
 */
export default function RoomDock() {
  const s = useRoomSession()
  const { pathname } = useLocation()
  const playing = useSelector((st) => st.player.isOpen)
  const [emojis, setEmojis] = useState(false)
  const room = s?.live.room
  const { text: countdown, started } = useCountdown(room?.phase === 'scheduled' ? room.startsAt : null, s?.live.offset || 0)

  if (!s?.code || s.live.status !== 'in' || !room) return null
  const onRoomPage = pathname === `/sala/${s.code}`
  if (onRoomPage && !playing) return <FloatingReactions items={s.live.fx} onDone={s.live.consumeFx} />

  const scheduled = room.phase === 'scheduled' && !started
  const count = s.live.members.length

  return (
    <>
      <FloatingReactions items={s.live.fx} onDone={s.live.consumeFx} />
      <div role="region" aria-label="Sala en curso" className="fixed z-[130] left-1/2 -translate-x-1/2 bottom-3 max-w-[calc(100vw-1rem)]">
        {emojis && (
          <div className="mb-2 flex justify-center gap-1.5 p-1.5 rounded-full bg-card/95 backdrop-blur border border-white/10" role="group" aria-label="Reacciones">
            {EMOJIS.map((e) => <button key={e} onClick={() => s.live.react(e)} aria-label={`Reaccionar ${e}`} className="w-9 h-9 rounded-full text-xl hover:scale-125 transition">{e}</button>)}
          </div>
        )}
        <div className="flex items-center gap-1.5 pl-3 pr-1.5 py-1.5 rounded-full bg-card/95 backdrop-blur border border-white/10 shadow-2xl">
          <Link to={`/sala/${s.code}`} className="flex items-center gap-2 min-w-0 pr-1 hover:text-gold transition-colors text-chalk" title="Volver a la sala">
            <Popcorn size={16} weight="fill" className="text-gold flex-shrink-0" />
            <span className="text-xs font-semibold truncate max-w-[9rem] sm:max-w-[14rem]">{room.title}</span>
            {scheduled && <span className="text-gold text-xs font-mono tabular-nums">{countdown}</span>}
            <span className="hidden sm:inline-flex items-center gap-1 text-muted text-[11px]"><Users size={11} /> {count}</span>
          </Link>
          <VoiceControls size={36} />
          <SyncControls size={36} compact />
          <button onClick={() => setEmojis((v) => !v)} aria-label="Reacciones" aria-expanded={emojis} className="w-9 h-9 rounded-full text-muted hover:text-gold hover:bg-white/5 flex items-center justify-center"><Smiley size={18} /></button>
          <button onClick={() => s.setChatOpen(!s.chatOpen)} aria-label={s.unread ? `Chat (${s.unread} sin leer)` : 'Chat'} aria-pressed={s.chatOpen} className="relative w-9 h-9 rounded-full text-muted hover:text-gold hover:bg-white/5 flex items-center justify-center">
            <ChatCircleText size={18} />
            {s.unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center">{s.unread > 9 ? '9+' : s.unread}</span>}
          </button>
          <button onClick={s.exit} aria-label="Salir de la sala" className="w-9 h-9 rounded-full bg-red-500/15 text-red-300 hover:bg-red-500/30 flex items-center justify-center"><SignOut size={16} /></button>
        </div>
      </div>
    </>
  )
}
