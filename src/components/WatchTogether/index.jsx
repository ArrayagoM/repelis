import { useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UsersThree, X, WhatsappLogo, TelegramLogo, Copy, Check, CalendarPlus } from '@phosphor-icons/react'
import { dayOptions, defaultDay, parseWhen, buildInviteMessage } from '../../lib/watchTogether'
import { buildIcs, downloadIcs } from '../../lib/ics'

/**
 * "Ver juntos": elegís día y hora, y armamos el mensaje + el evento de calendario para invitar.
 * Cada uno mira en su propio dispositivo (NO hay reproducción sincronizada).
 */
export default function WatchTogether({ title, type = 'movie', id, runtimeMin = 0 }) {
  const [open, setOpen] = useState(false)
  const [day, setDay] = useState(defaultDay)
  const [time, setTime] = useState('21:00')
  const [copied, setCopied] = useState(false)

  const days = useMemo(() => dayOptions(), [])
  const url = typeof window !== 'undefined' ? `${window.location.origin}/${type === 'tv' ? 'tv' : 'movie'}/${id}` : ''
  const when = parseWhen(day, time)
  const message = when ? buildInviteMessage({ title, when, url }) : ''

  const copy = async () => {
    try { await navigator.clipboard.writeText(message) } catch {
      const ta = document.createElement('textarea'); ta.value = message; document.body.appendChild(ta); ta.select()
      try { document.execCommand('copy') } catch { /* sin portapapeles */ }
      document.body.removeChild(ta)
    }
    setCopied(true); setTimeout(() => setCopied(false), 2000)
  }

  const addToCalendar = () => {
    if (!when) return
    downloadIcs(`ver-juntos-${id}`, buildIcs({
      uid: `together-${type}-${id}-${when.getTime()}`,
      title: `Ver "${title}" juntos`,
      description: 'Cada uno mira desde su dispositivo y le da play a la misma hora.',
      url,
      start: when,
      durationMin: runtimeMin || 120,
      alarmMinBefore: 15,
    }))
  }

  const enc = encodeURIComponent
  const actions = [
    { id: 'wa', label: 'WhatsApp', Icon: WhatsappLogo, href: `https://wa.me/?text=${enc(message)}`, cls: 'hover:text-green-400 hover:border-green-400/40' },
    { id: 'tg', label: 'Telegram', Icon: TelegramLogo, href: `https://t.me/share/url?url=${enc(url)}&text=${enc(message.replace(url, '').trim())}`, cls: 'hover:text-sky-400 hover:border-sky-400/40' },
  ]

  return (
    <>
      <button onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-muted text-sm hover:text-gold hover:border-gold/30 transition-all duration-200">
        <UsersThree size={14} weight="bold" />
        Ver juntos
      </button>

      <AnimatePresence>
        {open && (
          <motion.div key="wt" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[115] flex items-center justify-center bg-black/80 backdrop-blur-md p-4"
            onClick={(e) => { if (e.target === e.currentTarget) setOpen(false) }}>
            <motion.div initial={{ scale: 0.95, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.95, opacity: 0 }}
              role="dialog" aria-label="Ver juntos"
              className="w-full max-w-md rounded-2xl bg-[#0E0E18] border border-white/10 shadow-[0_48px_120px_rgba(0,0,0,1)] overflow-hidden">
              <div className="relative p-5 bg-gradient-to-br from-gold/15 to-transparent border-b border-white/5">
                <button onClick={() => setOpen(false)} aria-label="Cerrar"
                  className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full text-muted hover:text-chalk hover:bg-white/5">
                  <X size={14} weight="bold" />
                </button>
                <p className="font-display font-bold text-chalk text-lg flex items-center gap-2"><UsersThree size={20} weight="fill" className="text-gold" /> Ver juntos</p>
                <p className="text-muted text-sm mt-1 leading-relaxed">Elegí cuándo y mandales la invitación. Cada uno mira desde su dispositivo y le dan play a la misma hora.</p>
              </div>

              <div className="p-5 space-y-4">
                <div className="grid grid-cols-[1fr_auto] gap-3">
                  <label className="block text-xs text-muted font-mono uppercase tracking-wider">
                    Día
                    <select value={day} onChange={(e) => setDay(e.target.value)}
                      className="mt-1 w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-chalk text-sm normal-case tracking-normal font-sans focus:outline-none focus:border-gold/40">
                      {days.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                    </select>
                  </label>
                  <label className="block text-xs text-muted font-mono uppercase tracking-wider">
                    Hora
                    <input type="time" value={time} onChange={(e) => setTime(e.target.value)}
                      className="mt-1 w-full bg-surface border border-white/10 rounded-xl px-3 py-2.5 text-chalk text-sm font-sans focus:outline-none focus:border-gold/40" />
                  </label>
                </div>

                <p className="p-3 rounded-xl bg-surface border border-white/5 text-chalk/85 text-sm leading-relaxed">
                  {message || 'Elegí un día y una hora válidos.'}
                </p>

                <div className="grid grid-cols-2 gap-2">
                  {actions.map(({ id: aid, label, Icon, href, cls }) => (
                    <a key={aid} href={message ? href : undefined} target="_blank" rel="noopener noreferrer"
                      aria-disabled={!message}
                      className={`flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 text-muted text-sm font-medium transition-all ${cls} ${message ? '' : 'opacity-40 pointer-events-none'}`}>
                      <Icon size={16} weight="fill" /> {label}
                    </a>
                  ))}
                  <button onClick={copy} disabled={!message}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 text-muted text-sm font-medium hover:text-gold hover:border-gold/40 transition-all disabled:opacity-40">
                    {copied ? <Check size={16} weight="bold" className="text-emerald-400" /> : <Copy size={16} weight="bold" />}
                    {copied ? '¡Copiado!' : 'Copiar mensaje'}
                  </button>
                  <button onClick={addToCalendar} disabled={!message}
                    className="flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 text-muted text-sm font-medium hover:text-gold hover:border-gold/40 transition-all disabled:opacity-40">
                    <CalendarPlus size={16} weight="bold" /> Calendario
                  </button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
