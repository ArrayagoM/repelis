import { useEffect, useMemo, useRef, useState } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MagnifyingGlass, ArrowLeft, Funnel, X, Clock, TrendUp, FilmSlate, Television, User,
  CaretDown, Sliders, Star, CalendarBlank, ArrowsDownUp,
} from '@phosphor-icons/react'
import {
  searchSmart, getHistory, addToHistory, removeFromHistory, clearHistory,
  getTitle, getYear, isPerson,
} from '../../lib/searchEngine'
import { useSEO } from '../../lib/useSEO'
import { IMG_W342 } from '../../api/tmdb'
import MovieCard, { MovieCardSkeleton } from '../../components/MovieCard'

const KIND_OPTIONS = [
  { id: 'all',    label: 'Todo',      Icon: MagnifyingGlass },
  { id: 'movie',  label: 'Películas', Icon: FilmSlate },
  { id: 'tv',     label: 'Series',    Icon: Television },
  { id: 'person', label: 'Personas',  Icon: User },
]
const SORT_OPTIONS = [
  { id: 'popularity', label: 'Popularidad' },
  { id: 'rating',     label: 'Mejor valoradas' },
  { id: 'year-desc',  label: 'Más recientes' },
  { id: 'year-asc',   label: 'Más antiguas' },
]
const LANG_OPTIONS = [
  { id: '',   label: 'Cualquier idioma' },
  { id: 'es', label: 'Español 🇲🇽' },
  { id: 'en', label: 'Inglés 🇺🇸' },
  { id: 'ja', label: 'Japonés 🇯🇵' },
  { id: 'ko', label: 'Coreano 🇰🇷' },
  { id: 'fr', label: 'Francés 🇫🇷' },
  { id: 'it', label: 'Italiano 🇮🇹' },
]
const CURRENT_YEAR = new Date().getFullYear()

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const debounceRef = useRef(null)

  const urlQuery = searchParams.get('q') || ''

  const [query,       setQuery]       = useState(urlQuery)
  const [kind,        setKind]        = useState('all')
  const [sort,        setSort]        = useState('popularity')
  const [language,    setLanguage]    = useState('')
  const [minRating,   setMinRating]   = useState(0)
  const [minYear,     setMinYear]     = useState('')
  const [maxYear,     setMaxYear]     = useState('')
  const [filtersOpen, setFiltersOpen] = useState(false)

  const [results,     setResults]     = useState([])
  const [page,        setPage]        = useState(1)
  const [totalPages,  setTotalPages]  = useState(0)
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)
  const [fromCache,   setFromCache]   = useState(false)

  const [history,     setHistory]     = useState(getHistory())

  useSEO({
    title: urlQuery ? `Buscar: ${urlQuery}` : 'Buscador',
    description: urlQuery
      ? `Resultados de búsqueda para "${urlQuery}" en Life High. Películas, series, anime y personas.`
      : 'Buscador completo de películas, series, anime, K-drama y personas. Filtros por tipo, idioma, año y rating.',
    keywords: urlQuery ? `buscar ${urlQuery}, ${urlQuery} online, ${urlQuery} ver` : 'buscar peliculas, buscar series, anime, kdrama',
  })

  // Sync URL → state
  useEffect(() => { setQuery(urlQuery) }, [urlQuery])

  // Atajo "/" enfoca el input
  useEffect(() => {
    const handler = (e) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  // Debounce search 300ms
  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setResults([]); setPage(0); setTotalPages(0); setLoading(false)
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await searchSmart(query, {
          kind, sort, language, minRating,
          minYear: minYear ? Number(minYear) : null,
          maxYear: maxYear ? Number(maxYear) : null,
          page: 1,
        })
        setResults(res.results)
        setPage(res.page)
        setTotalPages(res.totalPages)
        setFromCache(res.fromCache)
        setError(null)
      } catch (e) {
        setError(e.message || 'Error en la búsqueda')
      } finally {
        setLoading(false)
      }
    }, 300)
    return () => debounceRef.current && clearTimeout(debounceRef.current)
  }, [query, kind, sort, language, minRating, minYear, maxYear])

  // Sync state → URL (sólo cuando hay query)
  useEffect(() => {
    if (query && query !== urlQuery) {
      const next = new URLSearchParams(searchParams)
      next.set('q', query)
      setSearchParams(next, { replace: true })
    }
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  const onSubmit = (e) => {
    e.preventDefault()
    if (!query.trim()) return
    addToHistory(query)
    setHistory(getHistory())
    inputRef.current?.blur()
  }

  const onHistoryClick = (q) => { setQuery(q); inputRef.current?.focus() }
  const onHistoryRemove = (q, e) => { e.stopPropagation(); removeFromHistory(q); setHistory(getHistory()) }
  const onClearHistory = () => { clearHistory(); setHistory([]) }

  const loadMore = async () => {
    if (loading || page >= totalPages) return
    setLoading(true)
    try {
      const res = await searchSmart(query, {
        kind, sort, language, minRating,
        minYear: minYear ? Number(minYear) : null,
        maxYear: maxYear ? Number(maxYear) : null,
        page: page + 1,
      })
      setResults((prev) => [...prev, ...res.results])
      setPage(res.page)
      setTotalPages(res.totalPages)
    } catch (e) {
      setError(e.message || 'Error cargando más')
    } finally {
      setLoading(false)
    }
  }

  const resetFilters = () => {
    setKind('all'); setSort('popularity'); setLanguage(''); setMinRating(0)
    setMinYear(''); setMaxYear('')
  }

  const activeFilterCount = useMemo(() => {
    let n = 0
    if (kind !== 'all') n++
    if (sort !== 'popularity') n++
    if (language) n++
    if (minRating > 0) n++
    if (minYear) n++
    if (maxYear) n++
    return n
  }, [kind, sort, language, minRating, minYear, maxYear])

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      transition={{ duration: 0.35 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all"
            aria-label="Volver">
            <ArrowLeft size={16} />
          </button>
          <h1 className="font-display font-extrabold text-2xl text-chalk">Buscador</h1>
          {fromCache && (
            <span className="ml-auto text-[10px] font-mono text-emerald-400/60" title="Resultado servido desde cache">
              ⚡ cache
            </span>
          )}
        </div>

        {/* ── Input principal ── */}
        <form onSubmit={onSubmit} className="relative mb-4">
          <MagnifyingGlass size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gold pointer-events-none" />
          <input
            ref={inputRef}
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder='Películas, series, anime, actores...   (presioná "/" para enfocar)'
            className="w-full bg-surface border border-dim/60 rounded-2xl pl-14 pr-32 py-4 text-base text-chalk placeholder:text-muted/60 outline-none focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(232,160,32,0.15)] transition-all duration-300 font-display"
            autoComplete="off"
          />
          {query && (
            <button type="button" onClick={() => { setQuery(''); inputRef.current?.focus() }}
              className="absolute right-32 top-1/2 -translate-y-1/2 text-muted hover:text-chalk"
              aria-label="Limpiar">
              <X size={16} weight="bold" />
            </button>
          )}
          <button type="button" onClick={() => setFiltersOpen((v) => !v)}
            className={`absolute right-3 top-1/2 -translate-y-1/2 px-3 py-1.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5
              ${filtersOpen || activeFilterCount > 0
                ? 'bg-gold text-void'
                : 'bg-white/5 text-chalk hover:bg-white/10'}`}>
            <Sliders size={12} weight="bold" />
            Filtros
            {activeFilterCount > 0 && (
              <span className="ml-0.5 px-1.5 py-0.5 rounded-full bg-void/30 text-[9px] font-mono">{activeFilterCount}</span>
            )}
          </button>
        </form>

        {/* ── Filtros panel ── */}
        <AnimatePresence>
          {filtersOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden mb-6"
            >
              <div className="bg-surface/50 border border-white/5 rounded-2xl p-5 space-y-5">
                {/* Kind chips */}
                <div>
                  <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2">Tipo</p>
                  <div className="flex flex-wrap gap-2">
                    {KIND_OPTIONS.map((o) => {
                      const Icon = o.Icon
                      const active = kind === o.id
                      return (
                        <button key={o.id} onClick={() => setKind(o.id)}
                          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all
                            ${active ? 'bg-gold text-void' : 'bg-white/5 text-muted hover:text-chalk hover:bg-white/10'}`}>
                          <Icon size={12} weight={active ? 'fill' : 'regular'} />
                          {o.label}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* Sort + Lang en una fila */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                      <ArrowsDownUp size={11} /> Ordenar
                    </p>
                    <select value={sort} onChange={(e) => setSort(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:border-gold/30">
                      {SORT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2">Idioma original</p>
                    <select value={language} onChange={(e) => setLanguage(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:border-gold/30">
                      {LANG_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                    </select>
                  </div>
                </div>

                {/* Rating + Year range */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                      <Star size={11} weight="fill" className="text-gold" /> Rating mín: <span className="text-gold ml-1">{minRating}</span>
                    </p>
                    <input type="range" min="0" max="10" step="0.5" value={minRating}
                      onChange={(e) => setMinRating(Number(e.target.value))}
                      className="w-full accent-gold" />
                  </div>
                  <div>
                    <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                      <CalendarBlank size={11} /> Año desde
                    </p>
                    <input type="number" placeholder="1900" min="1900" max={CURRENT_YEAR}
                      value={minYear} onChange={(e) => setMinYear(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:border-gold/30" />
                  </div>
                  <div>
                    <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2 flex items-center gap-1.5">
                      <CalendarBlank size={11} /> Año hasta
                    </p>
                    <input type="number" placeholder={String(CURRENT_YEAR)} min="1900" max={CURRENT_YEAR}
                      value={maxYear} onChange={(e) => setMaxYear(e.target.value)}
                      className="w-full bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:border-gold/30" />
                  </div>
                </div>

                <div className="flex justify-end">
                  <button onClick={resetFilters} className="text-xs text-muted hover:text-gold transition-colors">
                    Resetear filtros
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Historial (sin query) ── */}
        {!query && history.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <p className="text-muted text-xs uppercase tracking-widest font-semibold flex items-center gap-1.5">
                <Clock size={12} /> Búsquedas recientes
              </p>
              <button onClick={onClearHistory} className="text-muted/50 hover:text-red-400 text-xs transition-colors">
                Limpiar
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {history.map((q) => (
                <button key={q} onClick={() => onHistoryClick(q)}
                  className="group flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface border border-white/5 text-muted text-sm hover:text-chalk hover:border-gold/20 transition-all">
                  {q}
                  <span onClick={(e) => onHistoryRemove(q, e)}
                    className="text-muted/30 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <X size={11} weight="bold" />
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Sugerencias (sin query, sin historial) ── */}
        {!query && history.length === 0 && (
          <div className="mb-8">
            <p className="text-muted text-xs uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
              <TrendUp size={12} /> Probá buscar
            </p>
            <div className="flex flex-wrap gap-2">
              {['Breaking Bad', 'Inception', 'Attack on Titan', 'The Office', 'Spirited Away', 'Avengers', 'Casa de Papel', 'Game of Thrones'].map((s) => (
                <button key={s} onClick={() => onHistoryClick(s)}
                  className="px-3 py-1.5 rounded-full bg-surface border border-white/5 text-muted text-sm hover:text-gold hover:border-gold/20 transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300 text-sm">
            {error}
          </div>
        )}

        {/* ── Personas (cuando hay) ── */}
        {results.some(isPerson) && (
          <section className="mb-8">
            <p className="text-muted text-xs uppercase tracking-widest font-semibold mb-3 flex items-center gap-1.5">
              <User size={12} weight="fill" /> Personas
            </p>
            <div className="flex flex-wrap gap-3">
              {results.filter(isPerson).slice(0, 10).map((p) => (
                <div key={p.id} className="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface border border-white/5">
                  {p.profile_path ? (
                    <img src={`${IMG_W342}${p.profile_path}`} alt={p.name}
                      className="w-8 h-8 rounded-full object-cover" loading="lazy" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center">
                      <User size={14} className="text-muted" />
                    </div>
                  )}
                  <span className="text-chalk text-sm">{p.name}</span>
                  {p.known_for_department && (
                    <span className="text-muted/50 text-[10px] font-mono">{p.known_for_department}</span>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Grid resultados ── */}
        {results.filter((r) => !isPerson(r)).length > 0 && (
          <section>
            <p className="text-muted text-xs mb-4 font-mono">
              {results.filter((r) => !isPerson(r)).length} resultado{results.length !== 1 ? 's' : ''}
              {totalPages > page && ' (hay más)'}
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
              {results.filter((r) => !isPerson(r)).map((item, i) => (
                <MovieCard key={`${item.id}-${i}`} movie={item} index={i % 12}
                  mediaType={item.media_type === 'tv' ? 'tv' : 'movie'} />
              ))}
            </div>

            {page < totalPages && (
              <div className="flex justify-center mt-10">
                <button onClick={loadMore} disabled={loading}
                  className="px-8 py-3 rounded-full glass border border-white/10 text-chalk font-medium hover:border-gold/30 hover:text-gold transition-all duration-200 disabled:opacity-50">
                  {loading ? 'Cargando…' : `Página ${page + 1}`}
                </button>
              </div>
            )}
          </section>
        )}

        {/* ── Loading inicial ── */}
        {loading && results.length === 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => <MovieCardSkeleton key={i} />)}
          </div>
        )}

        {/* ── Sin resultados ── */}
        {!loading && query.length >= 2 && results.length === 0 && !error && (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
            <Funnel size={32} className="text-muted" />
            <p className="text-chalk font-semibold">Sin resultados para "{query}"</p>
            <p className="text-muted text-sm max-w-md">
              Probá ajustar los filtros o buscar con otros términos. TMDB indexa títulos en su idioma original.
            </p>
          </div>
        )}
      </div>
    </motion.main>
  )
}
