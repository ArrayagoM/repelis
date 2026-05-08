import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, FilmSlate, List, X, Television, Star } from '@phosphor-icons/react'
import { fetchSearch } from '../../store/slices/searchSlice'

export default function Navbar() {
  const [scrolled,    setScrolled]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const inputRef = useRef(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => { setMenuOpen(false); setSearchOpen(false) }, [location.pathname])

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); setSearchOpen(false) }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const handleSearch = (e) => {
    e.preventDefault()
    if (!searchQuery.trim()) return
    dispatch(fetchSearch({ query: searchQuery.trim() }))
    navigate(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
    setSearchOpen(false)
    setSearchQuery('')
  }

  const navLinks = [
    { label: 'Inicio',    path: '/',            icon: null },
    { label: 'Películas', path: '/populares',   icon: FilmSlate },
    { label: 'Series',    path: '/series',      icon: Television },
    { label: 'Anime',     path: '/anime',       icon: Star },
    { label: 'K-Drama',   path: '/kdrama',      icon: null },
    { label: 'Clásicos',  path: '/clasicos',    icon: null },
  ]

  const isActive = (path) => {
    if (path === '/') return location.pathname === '/'
    return location.pathname.startsWith(path)
  }

  return (
    <>
      {/* ── Floating Pill Navbar ── */}
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-5xl"
        style={{ willChange: 'transform' }}
      >
        <div
          className={`
            flex items-center justify-between px-5 py-3 rounded-full
            transition-all duration-500
            ${scrolled
              ? 'glass shadow-[0_8px_32px_rgba(0,0,0,0.6)]'
              : 'bg-transparent border border-white/0'
            }
          `}
        >
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center shadow-[0_0_12px_rgba(232,160,32,0.5)] group-hover:shadow-[0_0_20px_rgba(232,160,32,0.7)] transition-shadow duration-300">
              <FilmSlate size={16} weight="fill" className="text-void" />
            </div>
            <span className="font-display font-800 text-[1.1rem] tracking-tight text-chalk hidden sm:block">
              Repe<span className="text-gold">lis</span>
            </span>
          </Link>

          {/* Desktop Links */}
          <div className="hidden lg:flex items-center gap-0.5">
            {navLinks.map((link) => (
              <Link
                key={link.path}
                to={link.path}
                className={`
                  px-3.5 py-1.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                  ${isActive(link.path)
                    ? 'bg-gold/10 text-gold'
                    : 'text-muted hover:text-chalk hover:bg-white/5'
                  }
                `}
              >
                {link.label}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-gold hover:bg-gold/10 transition-all duration-300"
              aria-label="Buscar"
            >
              <MagnifyingGlass size={18} weight="bold" />
            </motion.button>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setMenuOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-gold hover:bg-gold/10 transition-all duration-300 lg:hidden"
              aria-label="Abrir menú"
            >
              <List size={20} weight="bold" />
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* ── Full-screen Mobile Menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-void/97 backdrop-blur-3xl flex flex-col px-8 pt-24 pb-12"
          >
            {/* Close */}
            <motion.button
              initial={{ opacity: 0, rotate: -90 }}
              animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-chalk transition-colors"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </motion.button>

            {/* Logo in menu */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              className="flex items-center gap-3 mb-6"
            >
              <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center shadow-[0_0_16px_rgba(232,160,32,0.5)]">
                <FilmSlate size={20} weight="fill" className="text-void" />
              </div>
              <span className="font-display font-800 text-2xl tracking-tight text-chalk">
                Repe<span className="text-gold">lis</span>
              </span>
            </motion.div>

            {/* Divider groups */}
            <div className="flex flex-col gap-1 mt-2">
              {/* Movies group */}
              <p className="text-muted/50 text-[10px] uppercase tracking-widest font-semibold px-1 mb-1 mt-2">
                Películas
              </p>
              {navLinks.filter(l => ['/', '/populares', '/clasicos'].includes(l.path)).map((link, i) => (
                <MobileLink key={link.path} link={link} index={i} isActive={isActive(link.path)} />
              ))}

              <p className="text-muted/50 text-[10px] uppercase tracking-widest font-semibold px-1 mb-1 mt-4">
                Series & Anime
              </p>
              {navLinks.filter(l => ['/series', '/anime', '/kdrama'].includes(l.path)).map((link, i) => (
                <MobileLink key={link.path} link={link} index={i + 4} isActive={isActive(link.path)} />
              ))}
            </div>

            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
              className="mt-auto text-muted text-sm font-mono"
            >
              © Repelis {new Date().getFullYear()}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Overlay ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="fixed inset-0 z-[70] bg-void/90 backdrop-blur-2xl flex items-start justify-center pt-32 px-6"
            onClick={(e) => { if (e.target === e.currentTarget) setSearchOpen(false) }}
          >
            <motion.div
              initial={{ y: -24, opacity: 0, scale: 0.97 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: -24, opacity: 0 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="w-full max-w-2xl"
            >
              <form onSubmit={handleSearch} className="relative">
                <MagnifyingGlass
                  size={22}
                  className="absolute left-5 top-1/2 -translate-y-1/2 text-gold pointer-events-none"
                />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Películas, series, anime, K-dramas..."
                  className="
                    w-full bg-surface border border-dim/60 rounded-2xl
                    pl-14 pr-6 py-5 text-lg text-chalk placeholder:text-muted
                    outline-none focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(232,160,32,0.15)]
                    transition-all duration-300 font-display
                  "
                />
                <button
                  type="submit"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-gold text-void font-semibold px-5 py-2 rounded-xl text-sm hover:bg-gold-hi transition-colors duration-200"
                >
                  Buscar
                </button>
              </form>
              {/* Quick links */}
              <div className="flex flex-wrap gap-2 mt-5 justify-center">
                {['Breaking Bad', 'Attack on Titan', 'Inception', 'The Office', 'Spirited Away'].map((s) => (
                  <button
                    key={s}
                    onClick={() => {
                      setSearchQuery(s)
                      dispatch(fetchSearch({ query: s }))
                      navigate(`/search?q=${encodeURIComponent(s)}`)
                      setSearchOpen(false)
                      setSearchQuery('')
                    }}
                    className="px-3 py-1.5 rounded-full bg-surface border border-dim/40 text-muted text-sm hover:text-gold hover:border-gold/30 transition-all duration-200"
                  >
                    {s}
                  </button>
                ))}
              </div>
              <p className="text-center text-muted text-sm mt-4">
                Presioná <kbd className="px-2 py-0.5 rounded bg-surface border border-dim/60 text-xs font-mono">ESC</kbd> para cerrar
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

function MobileLink({ link, index, isActive }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -32 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -32 }}
      transition={{ delay: 0.06 * index, duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
    >
      <Link
        to={link.path}
        className={`
          block text-2xl font-display font-semibold py-3 px-1 border-b border-white/5 transition-colors duration-200
          ${isActive ? 'text-gold' : 'text-chalk/80 hover:text-gold'}
        `}
      >
        {link.label}
      </Link>
    </motion.div>
  )
}
