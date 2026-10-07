import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { UsersThree, Plus, Check } from '@phosphor-icons/react'
import { social, errorText, ensureAccount, refreshMe, useMe } from '../../lib/social'
import { showToast } from '../../lib/toast'

/**
 * "Agregar a una lista de la comunidad" desde la ficha de una película/serie.
 * `item` = toLibItem(...) ({ type, id, title, poster, date }).
 */
export default function AddToList({ item, className = '' }) {
  const navigate = useNavigate()
  const me = useMe()
  const [open, setOpen] = useState(false)
  const [busy, setBusy] = useState('')
  const box = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    const close = (e) => { if (box.current && !box.current.contains(e.target)) setOpen(false) }
    const esc = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('mousedown', close); document.removeEventListener('keydown', esc) }
  }, [open])

  if (!item?.id) return null
  const shaped = { type: item.type, id: item.id, title: item.title, poster: item.poster || null, year: (item.date || '').slice(0, 4) || null }

  const toggle = async () => {
    if (open) return setOpen(false)
    if (!(await ensureAccount(item.title))) return
    if (!me.loaded) await refreshMe()
    setOpen(true)
  }

  const lists = me.data?.lists || []

  const addTo = async (list) => {
    setBusy(list.id)
    const r = await social.addToList(list.id, shaped)
    setBusy('')
    if (r.ok) {
      await refreshMe()
      setOpen(false)
      showToast({ icon: '✅', title: `Agregada a «${list.title}»`, text: item.title, actionLabel: 'Ver lista', to: `/lista/${list.id}`, ttl: 4000, tone: 'green' })
    } else {
      showToast({ icon: '⚠️', title: errorText(r.error), ttl: 4500, tone: 'blue' })
    }
  }

  const createNew = () => { setOpen(false); navigate('/lista/nueva', { state: { item: shaped } }) }

  return (
    <div ref={box} className={`relative ${className}`}>
      <button onClick={toggle} aria-haspopup="menu" aria-expanded={open}
        className="flex items-center gap-2 px-5 py-3 rounded-full border text-sm font-medium transition-all duration-300 glass border-white/10 text-chalk hover:border-gold/30 hover:text-gold">
        <UsersThree size={16} weight="bold" /> Agregar a una lista
      </button>
      {open && (
        <div role="menu" className="absolute z-30 left-0 mt-2 w-72 max-h-80 overflow-auto rounded-2xl bg-card border border-white/10 shadow-2xl p-2">
          {(
            <>
              {lists.map((l) => {
                const already = !!busy && busy === l.id
                return (
                  <button key={l.id} role="menuitem" onClick={() => addTo(l)} disabled={!!busy}
                    className="w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-sm text-chalk hover:bg-white/5 disabled:opacity-50">
                    {already ? <Check size={14} className="text-gold" /> : <Plus size={14} className="text-gold" />}
                    <span className="truncate flex-1">{l.title}</span>
                    <span className="text-muted text-xs font-mono">{l.itemsCount}</span>
                  </button>
                )
              })}
              <button role="menuitem" onClick={createNew} className="w-full flex items-center gap-2 text-left px-3 py-2.5 rounded-xl text-sm text-gold hover:bg-gold/10">
                <Plus size={14} weight="bold" /> Nueva lista con este título
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
