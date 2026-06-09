import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, FilmSlate, Television, User, X, ArrowRight } from '@phosphor-icons/react'
import { searchSmart, addToHistory, getTitle, getYear, isPerson, isMovie } from '../../lib/searchEngine'
import { IMG_W342 } from '../../api/tmdb'

/**
 * Buscador inline para la navbar.
 * - Input siempre visible en desktop (lg+).
 * - Autocompletar con debounce 250ms.
 * - Dropdown con top 6 resultados.
 * - Enter o "Ver todos" → navega a /search.
 * - "/" enfoca el input desde cualquier parte.
 * - Esc lo cierra y desfocus.
 */
export default function NavSearch({ className = '' }) {
  const [q, setQ]               = useState('')
  const [open, setOpen]         = useState(false)
  const [loading, setLoading]   = useState(false)
  const [results, setResults]   = useState([])
  const [activeIdx, setActiveIdx] = useState(-1)
  const inputRef  = useRef(null)
  const debounceRef = useRef(null)
  const navigate  = useNavigate()

  // Atajo "/" enfoca el input
  useEffect(() => {
    const h = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT' && document.activeElement?.tagName !== 'TEXTAREA') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  // Debounce 250ms
  useEffect(() => {
    if (!open) return
    if (!q || q.trim().length < 2) {
      setResults([]); setLoading(false); return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchSmart(q, { page: 1 })
        // Top 6: priorizamos movies/tv sobre personas
        const sorted = [
          ...res.results.filter((r) => !isPerson(r)).slice(0, 5),
          ...res.results.filter(isPerson).slice(0, 1),
        ].slice(0, 6)
        setResults(sorted)
        setActiveIdx(-1)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 250)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [q, open])

  // Cerrar al click afuera
  useEffect(() => {
    const h = (e) => {
      if (!inputRef.current?.parentElement?.contains(e.target)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [open])

  const goSearch = (query = q) => {
    if (!query?.trim()) return
    addToHistory(query)
    navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    setOpen(false)
    inputRef.current?.blur()
  }

  const openItem = (item) => {
    if (isPerson(item)) {
      // No tenemos página de persona — buscamos por su nombre
      goSearch(item.name)
      return
    }
    addToHistory(q)
    const path = isMovie(item) || item.media_type === 'movie' ? `/movie/${item.id}` : `/tv/${item.id}`
    navigate(path)
    setOpen(false)
    setQ('')
    inputRef.current?.blur()
  }

  const onKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault()
      if (activeIdx >= 0 && results[activeIdx]) openItem(results[activeIdx])
      else goSearch()
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setActiveIdx((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setActiveIdx((i) => Math.max(i - 1, -1))
    } else if (e.key === 'Escape') {
      setOpen(false)
      inputRef.current?.blur()
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div className="relative">
        <MagnifyingGlass size={14} weight="bold"
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted/60 pointer-events-none" />
        <input
          ref={inputRef}
          type="search"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Buscar... (presioná /)"
          className="w-full bg-white/[0.04] hover:bg-white/[0.06] focus:bg-white/[0.07] border border-white/10 focus:border-gold/40 rounded-full pl-9 pr-9 py-1.5 text-sm text-chalk placeholder:text-muted/50 outline-none transition-all duration-200"
          autoComplete="off"
        />
        {q && (
          <button type="button" onClick={() => { setQ(''); inputRef.current?.focus() }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-muted/50 hover:text-chalk"
            aria-label="Limpiar">
            <X size={12} weight="bold" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {open && (q.trim().length >= 2 || results.length > 0) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.15 }}
            className="absolute top-full left-0 right-0 mt-2 bg-[#0E0E18] rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden z-[60]"
          >
            {loading && (
              <div className="px-4 py-3 flex items-center gap-2 text-muted text-xs">
                <div className="w-3 h-3 rounded-full border-2 border-gold/20 border-t-gold animate-spin" />
                Buscando…
              </div>
            )}

            {!loading && results.length === 0 && q.trim().length >= 2 && (
              <div className="px-4 py-6 text-center text-muted text-xs">
                Sin resultados para "{q}"
              </div>
            )}

            {!loading && results.length > 0 && (
              <>
                <ul className="py-1 max-h-[60vh] overflow-y-auto">
                  {results.map((item, i) => (
                    <li key={`${item.id}-${i}`}>
                      <button
                        type="button"
                        onClick={() => openItem(item)}
                        onMouseEnter={() => setActiveIdx(i)}
                        className={`w-full flex items-center gap-3 px-3 py-2 text-left transition-colors ${
                          activeIdx === i ? 'bg-gold/10' : 'hover:bg-white/[0.04]'
                        }`}
                      >
                        {/* Poster / avatar */}
                        <div className="w-10 h-14 rounded overflow-hidden bg-surface flex-shrink-0">
                          {item.poster_path ? (
                            <img src={`${IMG_W342}${item.poster_path}`} alt="" loading="lazy"
                              className="w-full h-full object-cover" />
                          ) : item.profile_path ? (
                            <img src={`${IMG_W342}${item.profile_path}`} alt="" loading="lazy"
                              className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-muted/30">
                              {isPerson(item) ? <User size={16} /> : <FilmSlate size={16} />}
                            </div>
                          )}
                        </div>

                        <div className="flex-1 min-w-0">
                          <p className="text-chalk text-sm font-medium truncate">{getTitle(item)}</p>
                          <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted/70 font-mono">
                            {isPerson(item) ? (
                              <span className="flex items-center gap-1"><User size={9} weight="fill" /> Persona</span>
                            ) : (
                              <>
                                <span className="flex items-center gap-1">
                                  {item.media_type === 'tv' ? <Television size={9} weight="fill" /> : <FilmSlate size={9} weight="fill" />}
                                  {item.media_type === 'tv' ? 'Serie' : 'Película'}
                                </span>
                                {getYear(item) && <span>{getYear(item)}</span>}
                                {item.vote_average > 0 && <span className="text-gold">★ {item.vote_average.toFixed(1)}</span>}
                              </>
                            )}
                          </div>
                        </div>
                        <ArrowRight size={12} weight="bold"
                          className={`flex-shrink-0 transition-opacity ${activeIdx === i ? 'opacity-100 text-gold' : 'opacity-0'}`} />
                      </button>
                    </li>
                  ))}
                </ul>

                <button
                  type="button"
                  onClick={() => goSearch()}
                  className="w-full px-4 py-2.5 border-t border-white/5 text-gold text-xs font-semibold hover:bg-gold/5 transition-colors flex items-center justify-center gap-1.5"
                >
                  Ver todos los resultados para "{q}"
                  <ArrowRight size={11} weight="bold" />
                </button>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
