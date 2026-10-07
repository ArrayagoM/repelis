import { useCallback, useEffect, useState } from 'react'
import { Tray, PaperPlaneTilt, Trash, ArrowBendUpLeft, Paperclip, ArrowClockwise, ArrowLeft } from '@phosphor-icons/react'
import { ago } from '../../lib/panelFormat'

const getJson = async (path) => {
  try {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' })
    let data = null
    try { data = await res.json() } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data }
  } catch { return { ok: false, status: 0, data: null } }
}
const postJson = async (path, body) => {
  try { const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); return { ok: res.ok } } catch { return { ok: false } }
}

export const KIND_LABELS = {
  verificar: 'Confirmar mail', restablecer: 'Restablecer clave', bienvenida: 'Bienvenida', clave_cambiada: 'Aviso de seguridad',
  cuenta_eliminada: 'Cuenta eliminada', resumen: 'Resumen diario', otro: 'Otro',
}
const STATUS = {
  sent: ['Enviado', 'bg-white/10 text-muted'], delivered: ['Entregado', 'bg-emerald-500/15 text-emerald-300'],
  bounced: ['Rebotó', 'bg-red-500/15 text-red-300'], complained: ['Marcado spam', 'bg-red-500/15 text-red-300'],
  failed: ['Falló', 'bg-red-500/15 text-red-300'], delayed: ['Demorado', 'bg-amber-500/15 text-amber-200'],
}

/** Dirección "Nombre <correo>" → { name, address } (solo para mostrar). */
export const parseAddress = (raw) => {
  const m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(String(raw || ''))
  return m ? { name: m[1].trim(), address: m[2].trim() } : { name: '', address: String(raw || '').trim() }
}

// El HTML de un mail ajeno NUNCA se ejecuta: iframe aislado (sin scripts, sin enlaces activos, sin cargar nada de afuera).
const SAFE_HEAD = '<meta http-equiv="Content-Security-Policy" content="default-src \'none\'; img-src data:; style-src \'unsafe-inline\'"><base target="_blank"><style>body{font-family:Arial,sans-serif;font-size:14px;color:#222;margin:12px;word-wrap:break-word}img{max-width:100%}</style>'
export const safeSrcDoc = (html) => `<!doctype html><html><head>${SAFE_HEAD}</head><body>${html}</body></html>`

const Chip = ({ children, cls }) => <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase tracking-wide ${cls}`}>{children}</span>

export default function MailInbox({ onUnread }) {
  const [dir, setDir] = useState('in')
  const [state, setState] = useState({ loading: true, items: [], hasMore: false, error: '' })
  const [openId, setOpenId] = useState(null)
  const [item, setItem] = useState(null)
  const [html, setHtml] = useState(false)

  const load = useCallback(async ({ more = false } = {}) => {
    const before = more ? state.items.at(-1)?.at : undefined
    const r = await getJson(`/api/admin/mail?dir=${dir}&limit=30${before ? `&before=${before}` : ''}`)
    if (!r.ok) return setState((s) => ({ ...s, loading: false, error: r.status === 503 ? 'La bandeja no está disponible todavía.' : 'No pudimos cargar el correo.' }))
    onUnread?.(r.data.unread)
    setState((s) => ({ loading: false, error: '', hasMore: r.data.hasMore, items: more ? [...s.items, ...r.data.items] : r.data.items }))
  }, [dir]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { setState({ loading: true, items: [], hasMore: false, error: '' }); setOpenId(null); setItem(null); load() }, [dir]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { const id = setInterval(() => { if (!document.hidden && !openId) load() }, 60_000); return () => clearInterval(id) }, [load, openId])

  const open = async (id) => {
    setOpenId(id); setItem(null); setHtml(false)
    const r = await getJson(`/api/admin/mail-item?id=${encodeURIComponent(id)}`)
    if (r.ok) { setItem(r.data.item); setState((s) => ({ ...s, items: s.items.map((m) => (m.id === id ? { ...m, readAt: m.readAt || Date.now() } : m)) })); load() }
  }
  const remove = async () => {
    if (!item || !window.confirm('¿Borrar este mensaje de la bandeja?')) return
    await postJson('/api/admin/mail-delete', { id: item.id })
    setOpenId(null); setItem(null); load()
  }

  // ── Mensaje abierto ──
  if (openId) {
    const from = parseAddress(item?.from)
    return (
      <div className="space-y-4">
        <button onClick={() => { setOpenId(null); setItem(null) }} className="inline-flex items-center gap-2 text-sm text-muted hover:text-gold"><ArrowLeft size={14} /> Volver a la bandeja</button>
        {!item ? <div className="skeleton h-48 rounded-2xl" /> : (
          <article className="p-5 rounded-2xl bg-card border border-white/[0.06] space-y-4">
            <header className="space-y-1">
              <h2 className="font-display font-bold text-lg text-chalk break-words">{item.subject}</h2>
              {item.dir === 'in'
                ? <p className="text-sm text-muted">De <strong className="text-chalk">{from.name || from.address}</strong>{from.name && <span className="text-muted"> &lt;{from.address}&gt;</span>} · {new Date(item.at).toLocaleString('es-AR')}</p>
                : <p className="text-sm text-muted">Para <strong className="text-chalk">{item.to}</strong> · {KIND_LABELS[item.kind] || item.kind} · {new Date(item.at).toLocaleString('es-AR')}</p>}
              {item.dir === 'out' && (STATUS[item.status] ? <Chip cls={STATUS[item.status][1]}>{STATUS[item.status][0]}</Chip> : null)}
              {item.detail && <p className="text-xs text-red-300">{item.detail}</p>}
            </header>
            {item.dir === 'in' ? (
              <>
                {item.attachments?.length > 0 && (
                  <ul className="flex flex-wrap gap-2">{item.attachments.map((a, i) => <li key={i} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-white/10 text-xs text-muted"><Paperclip size={12} /> {a.name || 'archivo'}</li>)}</ul>
                )}
                {item.html && (
                  <div className="flex gap-2">
                    {[[false, 'Texto'], [true, 'Con formato']].map(([v, label]) => (
                      <button key={label} onClick={() => setHtml(v)} aria-pressed={html === v} className={`px-3 py-1 rounded-full border text-xs ${html === v ? 'bg-gold text-void border-gold font-semibold' : 'glass border-white/10 text-muted'}`}>{label}</button>
                    ))}
                  </div>
                )}
                {html && item.html
                  ? <iframe title="Contenido del mensaje" sandbox="" referrerPolicy="no-referrer" srcDoc={safeSrcDoc(item.html)} className="w-full h-[28rem] rounded-xl bg-white" />
                  : item.text
                    ? <pre className="whitespace-pre-wrap break-words font-sans text-sm text-chalk/90 leading-relaxed">{item.text}</pre>
                    : <p className="text-sm text-muted">El contenido no está disponible acá (la clave de Resend no permite leer mensajes recibidos). Abrilo desde el panel de Resend → Emails → Receiving.</p>}
                <div className="flex flex-wrap gap-2 pt-2">
                  <a href={`mailto:${from.address}?subject=${encodeURIComponent(`Re: ${item.subject}`)}`} className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold text-void text-sm font-bold hover:bg-gold-hi"><ArrowBendUpLeft size={14} weight="bold" /> Responder</a>
                  <button onClick={remove} className="inline-flex items-center gap-2 px-4 py-2 rounded-full glass border border-white/10 text-red-300 text-sm hover:border-red-400/50"><Trash size={14} /> Borrar</button>
                </div>
              </>
            ) : (
              <p className="text-sm text-muted">Por seguridad no se guarda el contenido de los mails enviados por la app (los de confirmación y restablecer llevan enlaces personales).</p>
            )}
          </article>
        )}
      </div>
    )
  }

  // ── Lista ──
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {[['in', 'Recibidos', Tray], ['out', 'Enviados', PaperPlaneTilt]].map(([k, label, Icon]) => (
          <button key={k} onClick={() => setDir(k)} aria-pressed={dir === k} className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full border text-sm ${dir === k ? 'bg-gold text-void border-gold font-semibold' : 'glass border-white/10 text-muted hover:text-chalk'}`}><Icon size={14} /> {label}</button>
        ))}
        <button onClick={() => load()} aria-label="Actualizar" className="ml-auto w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold"><ArrowClockwise size={14} /></button>
      </div>
      <p className="text-muted/70 text-xs">Correo de <strong className="text-chalk/80">info@lifehigh.site</strong>. {dir === 'in' ? 'Lo que te escriben llega acá.' : 'Todo lo que manda la app (confirmaciones, avisos, resúmenes).'}</p>

      {state.error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">{state.error}</p>}
      {state.loading ? <div className="skeleton h-40 rounded-2xl" />
        : state.items.length === 0 ? (
          <p className="p-6 rounded-2xl bg-card border border-white/[0.06] text-muted text-sm text-center leading-relaxed">
            {dir === 'in' ? 'Todavía no recibiste mensajes. Cuando alguien escriba a info@lifehigh.site (y esté activada la recepción en Resend) aparece acá.' : 'Todavía no se envió ningún mail desde que está activa la bandeja.'}
          </p>
        ) : (
          <ul className="rounded-2xl bg-card border border-white/[0.06] divide-y divide-white/[0.05] overflow-hidden">
            {state.items.map((m) => {
              const unread = m.dir === 'in' && !m.readAt
              const who = m.dir === 'in' ? (parseAddress(m.from).name || parseAddress(m.from).address) : m.to
              return (
                <li key={m.id}>
                  <button onClick={() => open(m.id)} className="w-full text-left px-4 py-3 hover:bg-white/[0.03] flex items-start gap-3">
                    <span className={`mt-1.5 w-2 h-2 rounded-full flex-shrink-0 ${unread ? 'bg-gold' : 'bg-transparent'}`} aria-label={unread ? 'Sin leer' : undefined} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2">
                        <span className={`truncate text-sm ${unread ? 'font-bold text-chalk' : 'text-chalk/80'}`}>{who}</span>
                        {m.dir === 'out' && <Chip cls="bg-white/10 text-muted">{KIND_LABELS[m.kind] || m.kind}</Chip>}
                        {m.dir === 'out' && STATUS[m.status] && <Chip cls={STATUS[m.status][1]}>{STATUS[m.status][0]}</Chip>}
                        {m.attachments?.length > 0 && <Paperclip size={12} className="text-muted flex-shrink-0" />}
                      </span>
                      <span className={`block truncate text-sm ${unread ? 'text-chalk' : 'text-muted'}`}>{m.subject}</span>
                      {m.preview && <span className="block truncate text-xs text-muted/70">{m.preview}</span>}
                    </span>
                    <span className="text-muted/70 text-[11px] flex-shrink-0 pt-0.5">{ago(m.at)}</span>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      {state.hasMore && <button onClick={() => load({ more: true })} className="px-5 py-2 rounded-full glass border border-white/10 text-muted text-sm hover:text-chalk">Ver más</button>}
    </div>
  )
}
