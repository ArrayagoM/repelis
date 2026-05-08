import { useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, FilmSlate, Television, ArrowLeft, Funnel } from '@phosphor-icons/react'
import { fetchSearch, setQuery, clearSearch } from '../../store/slices/searchSlice'
import MovieCard, { MovieCardSkeleton } from '../../components/MovieCard'

const FILTERS = [
  { id: 'all',   label: 'Todo' },
  { id: 'movie', label: 'Películas' },
  { id: 'tv',    label: 'Series' },
]

export default function Search() {
  const [searchParams, setSearchParams] = useSearchParams()
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const [activeFilter, setActiveFilter] = useState('all')

  const { results, loading, error, query: storedQuery, page, totalPages } = useSelector((s) => s.search)
  const urlQuery = searchParams.get('q') || ''

  useEffect(() => {
    if (urlQuery && urlQuery !== storedQuery) {
      dispatch(fetchSearch({ query: urlQuery }))
    }
    if (inputRef.current) inputRef.current.value = urlQuery
    setActiveFilter('all')
  }, [urlQuery])

  useEffect(() => {
    return () => dispatch(clearSearch())
  }, [])

  const handleSubmit = (e) => {
    e.preventDefault()
    const q = inputRef.current?.value.trim()
    if (!q) return
    setSearchParams({ q })
    dispatch(fetchSearch({ query: q }))
  }

  const loadMore = () => {
    if (page < totalPages) {
      dispatch(fetchSearch({ query: urlQuery, page: page + 1 }))
    }
  }

  // Filter results by media_type
  const filteredResults = activeFilter === 'all'
    ? results
    : results.filter((r) => r.media_type === activeFilter || (activeFilter === 'tv' && r.first_air_date !== undefined && !r.media_type) || (activeFilter === 'movie' && r.release_date !== undefined && !r.media_type))

  const movieCount = results.filter((r) => r.media_type === 'movie' || (r.release_date !== undefined && !r.first_air_date)).length
  const tvCount    = results.filter((r) => r.media_type === 'tv'    || (r.first_air_date !== undefined)).length

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void pt-28 pb-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-4 mb-8">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all duration-200"
            aria-label="Volver"
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <h1 className="font-display font-bold text-2xl text-chalk tracking-tight">
              {urlQuery ? `Resultados para "${urlQuery}"` : 'Buscar contenido'}
            </h1>
            {urlQuery && results.length > 0 && (
              <p className="text-muted text-sm mt-0.5">
                {results.length} resultados · {movieCount} películas · {tvCount} series
              </p>
            )}
          </div>
        </div>

        {/* ── Search bar ── */}
        <form onSubmit={handleSubmit} className="relative mb-8 max-w-2xl">
          <MagnifyingGlass size={20} className="absolute left-5 top-1/2 -translate-y-1/2 text-gold pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            defaultValue={urlQuery}
            placeholder="Películas, series, anime, k-dramas..."
            className="
              w-full bg-surface border border-dim/50 rounded-2xl
              pl-14 pr-32 py-4 text-chalk placeholder:text-muted
              outline-none focus:border-gold/40 focus:shadow-[0_0_0_3px_rgba(232,160,32,0.1)]
              transition-all duration-300 font-display text-base
            "
          />
          <button
            type="submit"
            className="absolute right-2 top-1/2 -translate-y-1/2 bg-gold text-void font-semibold px-5 py-2.5 rounded-xl text-sm hover:bg-gold-hi transition-colors duration-200"
          >
            Buscar
          </button>
        </form>

        {/* ── Filter tabs (shown only when there are results) ── */}
        <AnimatePresence>
          {results.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-center gap-2 mb-8"
            >
              <Funnel size={14} className="text-muted mr-1" />
              {FILTERS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setActiveFilter(f.id)}
                  className={`px-4 py-1.5 rounded-full text-sm font-medium border transition-all duration-200 ${
                    activeFilter === f.id
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'border-white/10 text-muted hover:text-chalk hover:border-white/20'
                  }`}
                >
                  {f.label}
                  {f.id === 'movie' && movieCount > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-60">({movieCount})</span>
                  )}
                  {f.id === 'tv' && tvCount > 0 && (
                    <span className="ml-1.5 text-[10px] opacity-60">({tvCount})</span>
                  )}
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Empty / No results states ── */}
        {!urlQuery && !results.length && <EmptySearch />}
        {urlQuery && !loading && !results.length && <NoResults query={urlQuery} />}
        {filteredResults.length === 0 && results.length > 0 && (
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="text-muted text-center py-16"
          >
            No hay {activeFilter === 'movie' ? 'películas' : 'series'} en estos resultados
          </motion.p>
        )}

        {/* ── Results grid ── */}
        <AnimatePresence>
          {filteredResults.length > 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5"
            >
              {filteredResults.map((item, i) => (
                <MovieCard
                  key={`${item.id}-${item.media_type}-${i}`}
                  movie={item}
                  index={i % 12}
                  mediaType={item.media_type}
                />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading skeletons */}
        {loading && !results.length && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
            {Array.from({ length: 12 }).map((_, i) => <MovieCardSkeleton key={i} />)}
          </div>
        )}

        {/* Load more */}
        {filteredResults.length > 0 && page < totalPages && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-center mt-12"
          >
            <button
              onClick={loadMore}
              disabled={loading}
              className="px-8 py-3 rounded-full glass border border-white/10 text-chalk font-medium hover:border-gold/30 hover:text-gold transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Cargando…' : 'Ver más resultados'}
            </button>
          </motion.div>
        )}
      </div>
    </motion.main>
  )
}

function EmptySearch() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 gap-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-surface border border-dim/50 flex items-center justify-center">
        <MagnifyingGlass size={32} className="text-gold/60" />
      </div>
      <p className="text-chalk font-display font-semibold text-xl">Buscá lo que quieras ver</p>
      <p className="text-muted text-sm max-w-[36ch]">
        Películas, series, anime, K-dramas — todo en un solo lugar
      </p>
      <div className="flex items-center gap-3 mt-2 text-xs text-muted/60">
        <span className="flex items-center gap-1"><FilmSlate size={12} /> Películas</span>
        <span className="w-1 h-1 rounded-full bg-muted/30" />
        <span className="flex items-center gap-1"><Television size={12} /> Series</span>
        <span className="w-1 h-1 rounded-full bg-muted/30" />
        <span>Anime · K-Drama</span>
      </div>
    </motion.div>
  )
}

function NoResults({ query }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-col items-center justify-center py-24 gap-4 text-center"
    >
      <div className="w-20 h-20 rounded-full bg-surface border border-dim/50 flex items-center justify-center">
        <FilmSlate size={32} className="text-dim" />
      </div>
      <p className="text-chalk font-display font-semibold text-xl">Sin resultados para "{query}"</p>
      <p className="text-muted text-sm max-w-[40ch]">
        Intentá con otro título, en inglés, o revisá la ortografía
      </p>
    </motion.div>
  )
}
