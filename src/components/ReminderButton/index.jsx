import { Bell, BellRinging, CalendarPlus } from '@phosphor-icons/react'
import { useLibrary, toggleReminder, isReminded } from '../../lib/library'
import { buildIcs, downloadIcs } from '../../lib/ics'
import { dateLabel, notificationsSupported } from '../../lib/reminders'
import { showToast } from '../../lib/toast'

const slug = (s) => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

export const addToCalendar = (item) => {
  if (!item?.date) return
  const url = typeof window !== 'undefined' ? `${window.location.origin}/${item.type === 'tv' ? 'tv' : 'movie'}/${item.id}` : ''
  downloadIcs(`estreno-${slug(item.title)}`, buildIcs({
    uid: `${item.type}-${item.id}`,
    title: `Estreno: ${item.title}`,
    description: 'Estreno recordado desde Life High.',
    url,
    date: item.date,
  }))
}

/**
 * "Avisame cuando salga" — para títulos que todavía no se estrenaron.
 * variant 'full'    → botones "Avisame" + "Agregar al calendario"
 * variant 'compact' → campana sobre el póster
 */
export default function ReminderButton({ item, variant = 'full' }) {
  const lib = useLibrary()
  if (!item?.id || !item.date) return null
  const on = isReminded(lib, item.type, item.id)

  const toggle = async (e) => {
    e.stopPropagation()
    const added = toggleReminder(item)
    if (!added) return
    // Pedimos permiso de notificaciones SOLO en este gesto del usuario
    if (notificationsSupported() && Notification.permission === 'default') {
      try { await Notification.requestPermission() } catch { /* ignorado */ }
    }
    showToast({
      icon: '🔔',
      title: `Te avisamos cuando se estrene`,
      text: `${item.title} · ${dateLabel(item.date)}. El aviso aparece cuando abras Life High; para que suene en tu celu, sumalo al calendario.`,
      actionLabel: 'Agregar al calendario',
      onAction: () => addToCalendar(item),
      ttl: 11000,
      tone: 'blue',
    })
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={toggle}
        aria-pressed={on}
        aria-label={on ? `No avisarme de ${item.title}` : `Avisarme cuando salga ${item.title}`}
        title={on ? 'Quitar aviso' : 'Avisame cuando salga'}
        className={`w-8 h-8 rounded-full backdrop-blur-sm border flex items-center justify-center transition-all duration-200
          ${on ? 'bg-blue-500 text-white border-blue-400' : 'bg-void/70 text-chalk border-white/20 hover:border-blue-400/60 hover:text-blue-300'}`}
      >
        {on ? <BellRinging size={14} weight="fill" /> : <Bell size={14} weight="bold" />}
      </button>
    )
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={toggle}
        aria-pressed={on}
        className={`flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-semibold transition-all duration-300
          ${on ? 'bg-blue-500/20 border-blue-400/50 text-blue-200' : 'bg-blue-500/10 border-blue-400/30 text-blue-200 hover:bg-blue-500/20'}`}
      >
        {on ? <BellRinging size={16} weight="fill" /> : <Bell size={16} weight="bold" />}
        {on ? 'Te vamos a avisar' : 'Avisame cuando salga'}
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); addToCalendar(item) }}
        className="flex items-center gap-2 px-5 py-3 rounded-full glass border border-white/10 text-chalk text-sm font-medium hover:border-gold/30 hover:text-gold transition-all duration-300"
      >
        <CalendarPlus size={16} weight="bold" />
        Agregar al calendario
      </button>
    </div>
  )
}
