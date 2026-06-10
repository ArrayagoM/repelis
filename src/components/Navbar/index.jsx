import { useState, useEffect, useRef } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useDispatch } from 'react-redux'
import { motion, AnimatePresence } from 'framer-motion'
import { MagnifyingGlass, FilmSlate, List, X, Coffee, CaretDown, SoccerBall } from '@phosphor-icons/react'
import { fetchSearch } from '../../store/slices/searchSlice'
import NavSearch from '../NavSearch'
import LanguageModeToggle from '../LanguageModeToggle'

// Mega-menú: agrupado para que el usuario encuentre lo que busca rápido
const MEGA_MENU = {
  'Películas': {
    'Principal': [
      ['Más populares',     '/populares'],
      ['Tendencias',        '/tendencias'],
      ['Tendencias de hoy', '/tendencias-hoy'],
      ['En cartelera',      '/estrenos'],
      ['Próximos estrenos', '/proximos'],
      ['Top valoradas',     '/top-valoradas'],
      ['Clásicos',          '/clasicos'],
    ],
    'Géneros': [
      ['Acción',           '/genero-accion'],
      ['Comedia',          '/genero-comedia'],
      ['Drama',            '/genero-drama'],
      ['Terror',           '/genero-terror'],
      ['Ciencia Ficción',  '/genero-sci-fi'],
      ['Romance',          '/genero-romance'],
      ['Thriller',         '/genero-thriller'],
      ['Aventura',         '/genero-aventura'],
      ['Animación',        '/genero-animacion'],
      ['Documentales',     '/genero-documental'],
      ['Fantasía',         '/genero-fantasia'],
      ['Familiar',         '/genero-familia'],
      ['Crimen',           '/genero-crimen'],
      ['Misterio',         '/genero-misterio'],
      ['Bélica',           '/genero-belica'],
      ['Western',          '/genero-western'],
      ['Música',           '/genero-musica'],
      ['Histórico',        '/genero-historia'],
    ],
    'Décadas': [
      ['2020s', '/decada-2020'],
      ['2010s', '/decada-2010'],
      ['2000s', '/decada-2000'],
      ['90s',   '/decada-1990'],
      ['80s',   '/decada-1980'],
      ['70s',   '/decada-1970'],
    ],
  },
  'Series': {
    'Principal': [
      ['Series populares',     '/series'],
      ['Series tendencia',     '/series-trending'],
      ['Series mejor valoradas','/series-top'],
      ['En emisión hoy',       '/en-emision'],
      ['En antena',            '/en-antena'],
    ],
    'Géneros TV': [
      ['Acción',     '/series-accion'],
      ['Comedia',    '/series-comedia'],
      ['Drama',      '/series-drama'],
      ['Crimen',     '/series-crimen'],
      ['Sci-Fi & Fantasía', '/series-sci-fi'],
      ['Misterio',   '/series-misterio'],
      ['Documental', '/series-documental'],
      ['Familia',    '/series-familia'],
      ['Reality',    '/series-reality'],
      ['Telenovela', '/series-telenovela'],
      ['Infantiles', '/series-kids'],
    ],
  },
  'Anime & K-Drama': {
    'Anime': [
      ['Anime (series)',       '/anime'],
      ['Películas de anime',   '/anime-peliculas'],
      ['Studio Ghibli',        '/ghibli'],
      ['Crunchyroll',          '/crunchyroll'],
    ],
    'Asia': [
      ['K-Drama',              '/kdrama'],
      ['Cine japonés',         '/pais-japon'],
      ['Cine coreano',         '/pais-corea'],
      ['Cine asiático',        '/pais-china'],
    ],
  },
  'Plataformas': {
    'Películas': [
      ['Netflix',     '/netflix'],
      ['Prime Video', '/prime'],
      ['Disney+',     '/disney'],
      ['HBO Max',     '/hbo'],
      ['Apple TV+',   '/apple-tv'],
      ['Paramount+',  '/paramount'],
    ],
    'Series': [
      ['Netflix',     '/netflix-series'],
      ['Prime Video', '/prime-series'],
      ['Disney+',     '/disney-series'],
      ['HBO Max',     '/hbo-series'],
      ['Apple TV+',   '/apple-tv-series'],
      ['Paramount+',  '/paramount-series'],
    ],
  },
  'Más': {
    'Franquicias': [
      ['Marvel (MCU)',         '/marvel'],
      ['DC',                   '/dc'],
      ['Pixar',                '/pixar'],
      ['Disney clásicos',      '/disney-clasicas'],
      ['Lucasfilm (Star Wars)','/lucasfilm'],
    ],
    'Por país': [
      ['Latinoamérica',  '/pais-latam'],
      ['España',         '/pais-espana'],
      ['USA',            '/pais-usa'],
      ['Francia',        '/pais-francia'],
      ['Italia',         '/pais-italia'],
      ['Reino Unido',    '/pais-uk'],
      ['Bollywood',      '/pais-india'],
    ],
    'Especiales': [
      ['Para los más chicos', '/infantil'],
    ],
  },
}

export default function Navbar({ onDonateClick }) {
  const [scrolled,    setScrolled]    = useState(false)
  const [menuOpen,    setMenuOpen]    = useState(false)
  const [searchOpen,  setSearchOpen]  = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [openMega,    setOpenMega]    = useState(null)
  const closeTimer = useRef(null)
  const inputRef = useRef(null)
  const dispatch = useDispatch()
  const navigate = useNavigate()
  const location = useLocation()

  // Mantener abierto: el cierre se retrasa 200ms y se cancela si el mouse
  // entra en el botón o en el dropdown. Esto soluciona el "se cierra al
  // bajar al menú" porque hay un gap visual entre el nav y el dropdown.
  const openMenu = (label) => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
    setOpenMega(label)
  }
  const scheduleClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current)
    closeTimer.current = setTimeout(() => setOpenMega(null), 200)
  }
  const cancelClose = () => {
    if (closeTimer.current) { clearTimeout(closeTimer.current); closeTimer.current = null }
  }

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    setMenuOpen(false); setSearchOpen(false); setOpenMega(null)
  }, [location.pathname])

  useEffect(() => {
    if (searchOpen && inputRef.current) inputRef.current.focus()
  }, [searchOpen])

  useEffect(() => {
    const handler = (e) => {
      if (e.key === 'Escape') { setMenuOpen(false); setSearchOpen(false); setOpenMega(null) }
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

  return (
    <>
      <motion.nav
        initial={{ y: -80, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
        className="fixed top-5 left-1/2 -translate-x-1/2 z-50 w-[calc(100%-2rem)] max-w-6xl"
        style={{ willChange: 'transform' }}
        onMouseLeave={scheduleClose}
        onMouseEnter={cancelClose}
      >
        <div className={`
          flex items-center justify-between px-5 py-3 rounded-full transition-all duration-500
          ${scrolled ? 'glass shadow-[0_8px_32px_rgba(0,0,0,0.6)]' : 'bg-transparent border border-white/0'}
        `}>
          {/* Logo */}
          <Link to="/" className="flex items-center gap-2.5 group flex-shrink-0">
            <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center shadow-[0_0_12px_rgba(232,160,32,0.5)]">
              <FilmSlate size={16} weight="fill" className="text-void" />
            </div>
            <span className="font-display font-800 text-[1.1rem] tracking-tight text-chalk hidden sm:block">
              Life<span className="text-gold"> High</span>
            </span>
          </Link>

          {/* Buscador inline (desktop) — entre el logo y los menús */}
          <NavSearch className="hidden lg:block w-56 xl:w-72 flex-shrink-0" />

          {/* Desktop Mega Menu Links */}
          <div className="hidden lg:flex items-center gap-0.5">
            <Link to="/"
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                ${location.pathname === '/' ? 'bg-gold/10 text-gold' : 'text-muted hover:text-chalk hover:bg-white/5'}`}>
              Inicio
            </Link>
            {Object.keys(MEGA_MENU).map((mainLabel) => (
              <div key={mainLabel} className="relative"
                onMouseEnter={() => openMenu(mainLabel)}>
                <button
                  onClick={() => openMega === mainLabel ? setOpenMega(null) : openMenu(mainLabel)}
                  className={`flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-300 whitespace-nowrap
                    ${openMega === mainLabel ? 'bg-gold/10 text-gold' : 'text-muted hover:text-chalk hover:bg-white/5'}`}
                  aria-expanded={openMega === mainLabel}
                  aria-haspopup="menu"
                >
                  {mainLabel}
                  <CaretDown size={10} weight="bold" className={`transition-transform ${openMega === mainLabel ? 'rotate-180' : ''}`} />
                </button>
              </div>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <Link to="/mundial"
              className="hidden md:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-300 text-xs font-bold uppercase tracking-wide hover:bg-emerald-500/25 transition-all whitespace-nowrap"
              title="Mundial 2026 en vivo">
              <SoccerBall size={12} weight="fill" />
              Mundial
            </Link>

            <div className="hidden md:block">
              <LanguageModeToggle variant="navbar" />
            </div>

            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={onDonateClick}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gold/10 border border-gold/20 text-gold text-xs font-semibold hover:bg-gold/20 transition-all duration-200"
              aria-label="Donar"
            >
              <Coffee size={12} weight="fill" />
              Café
            </motion.button>

            {/* Botón lupa solo en mobile/tablet — en desktop está el input inline */}
            <motion.button
              whileTap={{ scale: 0.92 }}
              onClick={() => setSearchOpen(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted hover:text-gold hover:bg-gold/10 transition-all duration-300 lg:hidden"
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

        {/* Mega-menú desplegable (desktop) */}
        <AnimatePresence>
          {openMega && (
            <motion.div
              key={openMega}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.2 }}
              className="hidden lg:block absolute top-full left-1/2 -translate-x-1/2 pt-3 w-full max-w-3xl"
              onMouseEnter={cancelClose}
              onMouseLeave={scheduleClose}
            >
              {/* Puente invisible que conecta el nav con el dropdown — sin esto
                  el mouse cae en el gap entre ambos y cierra el menú. */}
              <div aria-hidden="true" className="absolute -top-1 left-0 right-0 h-4" />

              <div className="bg-[#0E0E18] rounded-2xl border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.7)] overflow-hidden">
                <div className="grid grid-cols-3 gap-4 p-5">
                  {Object.entries(MEGA_MENU[openMega]).map(([groupTitle, items]) => (
                    <div key={groupTitle}>
                      <p className="text-muted/50 text-[10px] uppercase tracking-widest font-semibold mb-2 px-2">{groupTitle}</p>
                      <ul className="space-y-0.5">
                        {items.map(([label, path]) => (
                          <li key={path}>
                            <Link to={path}
                              className="block px-2 py-1.5 rounded-lg text-muted text-xs hover:text-gold hover:bg-gold/5 transition-colors">
                              {label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.nav>

      {/* ── Mobile Full-screen Menu ── */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-menu"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-[60] bg-void/97 backdrop-blur-3xl flex flex-col px-6 pt-20 pb-12 overflow-y-auto"
          >
            <motion.button
              initial={{ opacity: 0, rotate: -90 }} animate={{ opacity: 1, rotate: 0 }}
              transition={{ delay: 0.1, duration: 0.3 }}
              onClick={() => setMenuOpen(false)}
              className="absolute top-6 right-6 w-10 h-10 rounded-full glass flex items-center justify-center text-muted hover:text-chalk transition-colors z-10"
              aria-label="Cerrar menú"
            >
              <X size={20} />
            </motion.button>

            <Link to="/" onClick={() => setMenuOpen(false)} className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center shadow-[0_0_16px_rgba(232,160,32,0.5)]">
                <FilmSlate size={20} weight="fill" className="text-void" />
              </div>
              <span className="font-display font-800 text-2xl tracking-tight text-chalk">
                Life<span className="text-gold"> High</span>
              </span>
            </Link>

            {/* Toggle idioma + Donar móvil */}
            <div className="flex flex-wrap items-center gap-2 mb-6">
              <LanguageModeToggle variant="full" />
              <button onClick={() => { onDonateClick?.(); setMenuOpen(false) }}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gold/10 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/20 transition-all">
                <Coffee size={14} weight="fill" /> Café
              </button>
            </div>

            {/* Categorías */}
            <div className="space-y-6 pb-12">
              {Object.entries(MEGA_MENU).map(([mainLabel, groups]) => (
                <div key={mainLabel}>
                  <p className="text-gold/80 text-xs uppercase tracking-widest font-bold mb-3">{mainLabel}</p>
                  <div className="space-y-4 pl-1">
                    {Object.entries(groups).map(([groupTitle, items]) => (
                      <div key={groupTitle}>
                        <p className="text-muted/40 text-[10px] uppercase tracking-widest mb-1.5">{groupTitle}</p>
                        <ul className="space-y-0.5">
                          {items.map(([label, path]) => (
                            <li key={path}>
                              <Link to={path}
                                className="block py-3 text-chalk/85 text-base hover:text-gold transition-colors min-h-[44px] active:bg-white/5 rounded-lg px-2 -mx-2">
                                {label}
                              </Link>
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-auto pt-6 border-t border-white/[0.04] text-muted text-xs font-mono space-y-2">
              <div className="flex gap-3 text-muted/60">
                <Link to="/about"   className="hover:text-gold">Sobre</Link>
                <Link to="/terms"   className="hover:text-gold">Términos</Link>
                <Link to="/privacy" className="hover:text-gold">Privacidad</Link>
                <Link to="/dmca"    className="hover:text-gold">DMCA</Link>
              </div>
              <p className="text-muted/40">© Life High by TinTech {new Date().getFullYear()}</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Search Overlay ── */}
      <AnimatePresence>
        {searchOpen && (
          <motion.div
            key="search-overlay"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
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
                <MagnifyingGlass size={22} className="absolute left-5 top-1/2 -translate-y-1/2 text-gold pointer-events-none" />
                <input
                  ref={inputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Películas, series, anime, K-dramas..."
                  className="w-full bg-surface border border-dim/60 rounded-2xl pl-14 pr-6 py-5 text-lg text-chalk placeholder:text-muted outline-none focus:border-gold/50 focus:shadow-[0_0_0_3px_rgba(232,160,32,0.15)] transition-all duration-300 font-display"
                />
                <button type="submit"
                  className="absolute right-4 top-1/2 -translate-y-1/2 bg-gold text-void font-semibold px-5 py-2 rounded-xl text-sm hover:bg-gold-hi transition-colors duration-200">
                  Buscar
                </button>
              </form>
              <div className="flex flex-wrap gap-2 mt-5 justify-center">
                {['Breaking Bad', 'Attack on Titan', 'Inception', 'The Office', 'Spirited Away'].map((s) => (
                  <button key={s}
                    onClick={() => {
                      setSearchQuery(s); dispatch(fetchSearch({ query: s }))
                      navigate(`/search?q=${encodeURIComponent(s)}`)
                      setSearchOpen(false); setSearchQuery('')
                    }}
                    className="px-3 py-1.5 rounded-full bg-surface border border-dim/40 text-muted text-sm hover:text-gold hover:border-gold/30 transition-all duration-200">
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
