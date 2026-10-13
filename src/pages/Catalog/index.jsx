import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDispatch, useSelector } from 'react-redux'
import { motion } from 'framer-motion'
import { ArrowLeft } from '@phosphor-icons/react'
import * as TMDB from '../../api/tmdb'
import { getDeviceCaps } from '../../lib/deviceCaps'

const _LOW_END = typeof window !== 'undefined' && getDeviceCaps().lowEnd
const SKELETON_COUNT = _LOW_END ? 6 : 18
import {
  fetchPopular, fetchTopRated, fetchNowPlaying, fetchUpcoming, fetchTrending, fetchTrendingDay,
  fetchClassics, fetchAnimeMovies,
  fetchTrendingTV, fetchPopularTV, fetchTopRatedTV, fetchAiringTodayTV, fetchOnTheAirTV,
  fetchAnime, fetchKDrama, fetchCategory,
} from '../../store/slices/moviesSlice'
import MovieCard, { MovieCardSkeleton } from '../../components/MovieCard'
import { useLanguageFilter, useCurrentLanguageMode } from '../../lib/useLanguageFilter'
import { MODE_LABELS } from '../../lib/languageMode'
import { isOut } from '../../lib/releaseStatus'
import { useSEO } from '../../lib/useSEO'
import { tt } from '../../lib/i18n'

// ─── Categorías "clásicas" con su propio slot en el state ────────────────
const LEGACY_CONFIG = {
  populares:       { title: tt("Más Populares"),         badge: 'Popular',       color: 'gold',   key: 'popular',       fetcher: fetchPopular,       mediaType: 'movie', onlyReleased: true },
  'top-valoradas': { title: tt("Top Valoradas"),         badge: 'Top IMDb',      color: 'gold',   key: 'topRated',      fetcher: fetchTopRated,      mediaType: 'movie' },
  estrenos:        { title: tt("En Cartelera"),          badge: 'Ahora',         color: 'green',  key: 'nowPlaying',    fetcher: fetchNowPlaying,    mediaType: 'movie' },
  proximos:        { title: tt("Próximos Estrenos"),     badge: tt("Próximamente"),  color: 'blue',   key: 'upcoming',      fetcher: fetchUpcoming,      mediaType: 'movie' },
  tendencias:      { title: 'Tendencias',            badge: 'Trending',      color: 'red',    key: 'trending',      fetcher: fetchTrending,      mediaType: 'movie', onlyReleased: true },
  'tendencias-hoy':{ title: tt("Tendencias de Hoy"),     badge: 'Hoy',           color: 'red',    key: 'trending',      fetcher: fetchTrendingDay,   mediaType: 'movie', onlyReleased: true },
  clasicos:        { title: tt("Clásicos del Cine"),     badge: tt("Clásico"),       color: 'amber',  key: 'classics',      fetcher: fetchClassics,      mediaType: 'movie' },
  series:          { title: tt("Series Populares"),      badge: 'Series',        color: 'blue',   key: 'popularTV',     fetcher: fetchPopularTV,     mediaType: 'tv', onlyReleased: true },
  'series-trending':{title: tt("Series en Tendencia"),   badge: 'Trending',      color: 'red',    key: 'trendingTV',    fetcher: fetchTrendingTV,    mediaType: 'tv', onlyReleased: true },
  'series-top':    { title: tt("Series Mejor Valoradas"),badge: tt("Top Series"),    color: 'gold',   key: 'topRatedTV',    fetcher: fetchTopRatedTV,    mediaType: 'tv' },
  'en-emision':    { title: tt("En Emisión Hoy"),        badge: tt("En Vivo"),       color: 'green',  key: 'airingTodayTV', fetcher: fetchAiringTodayTV, mediaType: 'tv' },
  'en-antena':     { title: tt("En Antena"),             badge: tt("En Antena"),     color: 'blue',   key: 'onTheAirTV',    fetcher: fetchOnTheAirTV,    mediaType: 'tv' },
  anime:           { title: 'Anime',                 badge: 'Anime',         color: 'purple', key: 'anime',         fetcher: fetchAnime,         mediaType: 'tv' },
  'anime-peliculas':{title: tt("Películas de Anime"),    badge: tt("Anime Film"),    color: 'purple', key: 'animeMovies',   fetcher: fetchAnimeMovies,   mediaType: 'movie' },
  kdrama:          { title: 'K-Dramas',              badge: 'K-Drama',       color: 'pink',   key: 'kdrama',        fetcher: fetchKDrama,        mediaType: 'tv' },
}

// ─── Categorías nuevas que usan el slot genérico byCategory ──────────────
// shape: [tmdbFetcher, mediaType, title, badge, color]
const DYNAMIC_CONFIG = {
  // GÉNEROS - PELÍCULAS
  'series-proximas':     [TMDB.getUpcomingTV,  'tv',    tt("Series que se vienen"), tt("Próximamente"), 'blue'],
  'genero-accion':       [TMDB.getAction,      'movie', tt("Acción"),           tt("Acción"),    'red'],
  'genero-aventura':     [TMDB.getAdventure,   'movie', 'Aventura',         'Aventura',  'amber'],
  'genero-animacion':    [TMDB.getAnimation,   'movie', tt("Animación"),        tt("Animación"), 'purple'],
  'genero-comedia':      [TMDB.getComedy,      'movie', 'Comedia',          'Comedia',   'amber'],
  'genero-crimen':       [TMDB.getCrime,       'movie', 'Crimen',           'Crimen',    'red'],
  'genero-documental':   [TMDB.getDocumentary, 'movie', 'Documentales',     'Doc',       'blue'],
  'genero-drama':        [TMDB.getDrama,       'movie', 'Drama',            'Drama',     'gold'],
  'genero-familia':      [TMDB.getFamily,      'movie', 'Familiar',         'Familia',   'green'],
  'genero-fantasia':     [TMDB.getFantasy,     'movie', tt("Fantasía"),         tt("Fantasía"),  'purple'],
  'genero-historia':     [TMDB.getHistory,     'movie', tt("Histórico"),        'Historia',  'amber'],
  'genero-terror':       [TMDB.getHorror,      'movie', 'Terror',           'Terror',    'red'],
  'genero-musica':       [TMDB.getMusic,       'movie', tt("Música"),           tt("Música"),    'pink'],
  'genero-misterio':     [TMDB.getMystery,     'movie', 'Misterio',         'Misterio',  'purple'],
  'genero-romance':      [TMDB.getRomance,     'movie', 'Romance',          'Romance',   'pink'],
  'genero-sci-fi':       [TMDB.getSciFi,       'movie', tt("Ciencia Ficción"),  'Sci-Fi',    'blue'],
  'genero-thriller':     [TMDB.getThriller,    'movie', 'Thriller',         'Thriller',  'red'],
  'genero-belica':       [TMDB.getWar,         'movie', tt("Bélica"),           tt("Bélica"),    'amber'],
  'genero-western':      [TMDB.getWestern,     'movie', 'Western',          'Western',   'amber'],

  // GÉNEROS - SERIES
  'series-accion':       [TMDB.getTVAction,    'tv', tt("Series de Acción"),     tt("Acción"),    'red'],
  'series-comedia':      [TMDB.getTVComedy,    'tv', tt("Series de Comedia"),    'Comedia',   'amber'],
  'series-crimen':       [TMDB.getTVCrime,     'tv', tt("Series de Crimen"),     'Crimen',    'red'],
  'series-documental':   [TMDB.getTVDocumentary,'tv',tt("Documentales TV"),      tt("Doc TV"),    'blue'],
  'series-drama':        [TMDB.getTVDrama,     'tv', tt("Series Drama"),         'Drama',     'gold'],
  'series-familia':      [TMDB.getTVFamily,    'tv', tt("Series Familiares"),    'Familia',   'green'],
  'series-kids':         [TMDB.getTVKids,      'tv', tt("Series Infantiles"),    'Kids',      'green'],
  'series-misterio':     [TMDB.getTVMystery,   'tv', tt("Series de Misterio"),   'Misterio',  'purple'],
  'series-reality':      [TMDB.getTVReality,   'tv', tt("Reality Shows"),        'Reality',   'pink'],
  'series-sci-fi':       [TMDB.getTVSciFi,     'tv', tt("Series Sci-Fi & Fantasía"),'Sci-Fi', 'blue'],
  'series-telenovela':   [TMDB.getTVSoap,      'tv', 'Telenovelas',          'Telenovela','pink'],

  // DÉCADAS
  'decada-2020':         [TMDB.get2020s,       'movie', tt("Lo mejor de los 2020s"), "2020s",  'gold'],
  'decada-2010':         [TMDB.get2010s,       'movie', tt("Lo mejor de los 2010s"), "2010s",  'gold'],
  'decada-2000':         [TMDB.get2000s,       'movie', tt("Lo mejor de los 2000s"), "2000s",  'gold'],
  'decada-1990':         [TMDB.get1990s,       'movie', tt("Lo mejor de los 90"),    "90s",    'gold'],
  'decada-1980':         [TMDB.get1980s,       'movie', tt("Lo mejor de los 80"),    "80s",    'gold'],
  'decada-1970':         [TMDB.get1970s,       'movie', tt("Lo mejor de los 70"),    "70s",    'gold'],

  // POR PAÍS
  'pais-latam':          [TMDB.getMoviesLatam, 'movie', tt("Cine Latinoamericano"), 'LATAM',     'green'],
  'pais-espana':         [TMDB.getMoviesSpain, 'movie', tt("Cine Español"),         tt("España"),    'red'],
  'pais-usa':            [TMDB.getMoviesUS,    'movie', tt("Cine de USA"),          'USA',       'blue'],
  'pais-francia':        [TMDB.getMoviesFrance,'movie', tt("Cine Francés"),         'Francia',   'blue'],
  'pais-italia':         [TMDB.getMoviesItaly, 'movie', tt("Cine Italiano"),        'Italia',    'green'],
  'pais-uk':             [TMDB.getMoviesUK,    'movie', tt("Cine Británico"),       'UK',        'blue'],
  'pais-india':          [TMDB.getMoviesIndia, 'movie', 'Bollywood',            'India',     'amber'],
  'pais-japon':          [TMDB.getMoviesJapan, 'movie', tt("Cine Japonés"),         tt("Japón"),     'red'],
  'pais-corea':          [TMDB.getMoviesKorea, 'movie', tt("Cine Coreano"),         'Corea',     'pink'],
  'pais-china':          [TMDB.getMoviesChina, 'movie', tt("Cine Asiático"),        tt("China/HK"),  'red'],

  // PROVEEDORES (películas)
  'netflix':             [TMDB.getNetflixMovies,'movie',tt("Películas de Netflix"), 'Netflix',   'red'],
  'prime':               [TMDB.getPrimeMovies,  'movie',tt("Películas de Prime"),   'Prime',     'blue'],
  'disney':              [TMDB.getDisneyMovies, 'movie',tt("Películas de Disney+"), 'Disney+',   'blue'],
  'hbo':                 [TMDB.getHBOMovies,    'movie',tt("Películas de HBO Max"), 'HBO',       'purple'],
  'apple-tv':            [TMDB.getAppleTVMovies,'movie',tt("Películas de Apple TV+"),'Apple TV+','gold'],
  'paramount':           [TMDB.getParamountMovies,'movie',tt("Películas Paramount+"),'Paramount','blue'],

  // PROVEEDORES (series)
  'netflix-series':      [TMDB.getNetflixTV,   'tv', tt("Series de Netflix"),    'Netflix',   'red'],
  'prime-series':        [TMDB.getPrimeTV,     'tv', tt("Series de Prime"),      'Prime',     'blue'],
  'disney-series':       [TMDB.getDisneyTV,    'tv', tt("Series de Disney+"),    'Disney+',   'blue'],
  'hbo-series':          [TMDB.getHBOTV,       'tv', tt("Series de HBO Max"),    'HBO',       'purple'],
  'apple-tv-series':     [TMDB.getAppleTVShows,'tv', tt("Series de Apple TV+"),  'Apple TV+', 'gold'],
  'paramount-series':    [TMDB.getParamountTV, 'tv', tt("Series de Paramount+"), 'Paramount', 'blue'],
  'crunchyroll':         [TMDB.getCrunchyroll, 'tv', tt("Anime de Crunchyroll"), 'Crunchy',   'amber'],

  // ESTUDIOS / FRANQUICIAS
  'marvel':              [TMDB.getMarvel,        'movie', tt("Universo Marvel (MCU)"), 'Marvel',  'red'],
  'dc':                  [TMDB.getDC,            'movie', tt("Universo DC"),           'DC',      'blue'],
  'pixar':               [TMDB.getPixar,         'movie', tt("Películas de Pixar"),    'Pixar',   'blue'],
  'ghibli':              [TMDB.getGhibli,        'movie', 'Studio Ghibli',         'Ghibli',  'purple'],
  'disney-clasicas':     [TMDB.getDisneyClassic, 'movie', tt("Clásicos Disney"),       'Disney',  'blue'],
  'lucasfilm':           [TMDB.getLucasfilm,     'movie', 'Lucasfilm (Star Wars)', 'SW',      'amber'],

  // INFANTIL
  'infantil':            [TMDB.getKidsMovies,  'movie', tt("Para los más chicos"), 'Kids',      'green'],

  // KEYWORDS (franquicias muy puntuales)
  'mcu':                 [TMDB.getMCU,         'movie', tt("Marvel Cinematic Universe"), 'MCU',     'red'],
  'distopia':            [TMDB.getDystopia,    'movie', tt("Distopías"),            tt("Distopía"),    'purple'],
  'superhero':           [TMDB.getSuperhero,   'movie', tt("Superhéroes"),          'Hero',        'gold'],
  'espacio':             [TMDB.getSpace,       'movie', tt("Aventura espacial"),    'Espacio',     'blue'],
  'aliens':              [TMDB.getAlien,       'movie', tt("Aliens y extraterrestres"),'Aliens',   'green'],
  'viajes-tiempo':       [TMDB.getTimeTravel,  'movie', tt("Viajes en el tiempo"),  tt("Time Travel"), 'purple'],
  'zombies':             [TMDB.getZombies,     'movie', 'Zombies',              'Zombies',     'red'],
  'vampiros':            [TMDB.getVampires,    'movie', 'Vampiros',             'Vampiros',    'red'],
  'artes-marciales':     [TMDB.getMartialArts, 'movie', tt("Artes marciales"),      tt("Kung Fu"),     'amber'],
  'espias':              [TMDB.getSpy,         'movie', tt("Espías"),               'Spy',         'blue'],
  'heists':              [TMDB.getHeist,       'movie', tt("Robos y atracos"),      'Heist',       'amber'],
  'apocalipsis':         [TMDB.getApocalypse,  'movie', tt("Post-apocalíptico"),    'Apocalipsis', 'red'],

  // NETWORKS
  'hbo-originals':       [TMDB.getHBOOriginals,'tv', tt("HBO Originals"),         'HBO',         'purple'],
  'bbc':                 [TMDB.getBBCShows,    'tv', 'BBC',                   'BBC',         'blue'],
  'fx':                  [TMDB.getFXShows,     'tv', tt("FX Networks"),           'FX',          'red'],
  'amc':                 [TMDB.getAMCShows,    'tv', 'AMC',                   'AMC',         'amber'],
  'cartoon-network':     [TMDB.getCartoonNetwork,'tv',tt("Cartoon Network"),       'CN',          'amber'],
  'disney-channel':      [TMDB.getDisneyChannel,'tv',tt("Disney Channel"),         tt("Disney TV"),   'blue'],
  'nickelodeon':         [TMDB.getNickelodeon, 'tv', 'Nickelodeon',           'Nick',        'amber'],
  'discovery':           [TMDB.getDiscoveryShows,'tv','Discovery',            'Discovery',   'blue'],
  'showtime':            [TMDB.getShowtimeShows,'tv','Showtime',              'Showtime',    'red'],
  'hulu':                [TMDB.getHuluShows,   'tv', tt("Hulu Originals"),        'Hulu',        'green'],
}

const BADGE_COLORS = {
  gold:   'bg-gold/10 border-gold/20 text-gold',
  green:  'bg-emerald-500/10 border-emerald-500/20 text-emerald-400',
  blue:   'bg-sky-500/10 border-sky-500/20 text-sky-400',
  red:    'bg-rose-500/10 border-rose-500/20 text-rose-400',
  amber:  'bg-amber-500/10 border-amber-500/20 text-amber-400',
  purple: 'bg-purple-500/10 border-purple-500/20 text-purple-400',
  pink:   'bg-pink-500/10 border-pink-500/20 text-pink-400',
}

export default function Catalog({ type }) {
  const dispatch = useDispatch()
  const navigate = useNavigate()

  const legacy = LEGACY_CONFIG[type]
  const dynamic = !legacy && DYNAMIC_CONFIG[type]

  const data = useSelector((s) => {
    if (legacy) return s.movies[legacy.key]
    if (dynamic) return s.movies.byCategory[type]
    return s.movies.popular
  }) || { results: [], page: 0, totalPages: 0, loading: false, error: null }

  const config = legacy || (dynamic && {
    title: dynamic[2], badge: dynamic[3], color: dynamic[4], mediaType: dynamic[1],
  }) || LEGACY_CONFIG.populares

  useEffect(() => {
    if (data.results.length) {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    if (legacy) {
      dispatch(legacy.fetcher(1))
    } else if (dynamic) {
      dispatch(fetchCategory({ key: type, fetcher: dynamic[0], page: 1 }))
    }
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type])

  const loadMore = () => {
    if (data.page >= data.totalPages || data.loading) return
    if (legacy) {
      dispatch(legacy.fetcher(data.page + 1))
    } else if (dynamic) {
      dispatch(fetchCategory({ key: type, fetcher: dynamic[0], page: data.page + 1 }))
    }
  }

  const badgeClass = BADGE_COLORS[config.color] || BADGE_COLORS.gold
  const languageResults = useLanguageFilter(data.results)
  // Rankings (tendencias / populares): no mostramos estrenos futuros
  const filteredResults = config.onlyReleased ? languageResults.filter(isOut) : languageResults
  const langMode = useCurrentLanguageMode()

  useSEO({
    title: tt("{title} — Catálogo", { title: config.title }),
    description: tt("{title}: el listado completo en Life High. Películas y series con metadatos verificados. Encontrá dónde ver cada título.", { title: config.title }),
    keywords: tt("{title}, {badge}, ver online, catálogo Life High, {v3}", { title: config.title, badge: config.badge, v3: config.mediaType === 'tv' ? 'series' : 'peliculas' }),
  })

  return (
    <motion.main
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.4 }}
      className="min-h-screen bg-void pt-28 pb-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center gap-4 mb-10">
          <button
            onClick={() => navigate(-1)}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold hover:border-gold/30 transition-all duration-200"
            aria-label={tt("Volver")}
          >
            <ArrowLeft size={16} />
          </button>
          <div>
            <span className={`inline-block px-2.5 py-0.5 rounded-full border text-[10px] uppercase tracking-widest font-semibold ${badgeClass}`}>
              {config.badge}
            </span>
            <h1 className="font-display font-extrabold text-3xl sm:text-4xl text-chalk tracking-tight mt-1">
              {config.title}
            </h1>
            {data.totalPages > 0 && (
              <p className="text-muted text-sm mt-1">
                {tt("Página")} {data.page} {tt("de")} {data.totalPages}
              </p>
            )}
          </div>
        </div>

        {/* Indicador del filtro activo */}
        {langMode !== 'all' && data.results.length > 0 && (
          <div className="mb-5 flex items-center gap-2 text-xs">
            <span className="px-2.5 py-1 rounded-full bg-gold/10 border border-gold/20 text-gold font-semibold uppercase tracking-wide">
              {tt("Filtro:")} {MODE_LABELS[langMode]}
            </span>
            <span className="text-muted/60 font-mono">
              {filteredResults.length} {tt("de")} {data.results.length} {tt("resultados")}
            </span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5">
          {filteredResults.map((item, i) => (
            <MovieCard
              key={`${item.id}-${i}`}
              movie={item}
              index={i % 12}
              mediaType={config.mediaType}
            />
          ))}
          {data.loading && !data.results.length &&
            Array.from({ length: SKELETON_COUNT }).map((_, i) => <MovieCardSkeleton key={i} />)
          }
        </div>

        {/* Mensaje cuando el filtro corta todo */}
        {!data.loading && data.results.length > 0 && filteredResults.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 gap-3 text-center">
            <p className="text-chalk font-display font-semibold text-lg">
              {tt("Sin resultados con el filtro \"")}{MODE_LABELS[langMode]}"
            </p>
            <p className="text-muted text-sm max-w-md">
              {tt("Esta categoría no tiene contenido en español. Cambiá el filtro de idioma desde la navbar para verla.")}
            </p>
          </div>
        )}

        {data.loading && data.results.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-5 mt-5">
            {Array.from({ length: 6 }).map((_, i) => <MovieCardSkeleton key={`more-${i}`} />)}
          </div>
        )}

        {data.results.length > 0 && data.page < data.totalPages && (
          <div className="flex justify-center mt-12">
            <button
              onClick={loadMore}
              disabled={data.loading}
              className="px-8 py-3 rounded-full glass border border-white/10 text-chalk font-medium hover:border-gold/30 hover:text-gold transition-all duration-200 disabled:opacity-50"
            >
              {data.loading ? tt("Cargando…") : tt("Cargar más")}
            </button>
          </div>
        )}

        {!data.loading && data.results.length === 0 && data.error && (
          <div className="flex flex-col items-center justify-center py-24 gap-3 text-center">
            <p className="text-chalk font-display font-semibold text-xl">{tt("No se pudo cargar")}</p>
            <p className="text-muted text-sm">{data.error}</p>
          </div>
        )}

        {!data.loading && data.results.length === 0 && !data.error && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <p className="text-chalk font-display font-semibold text-xl">{tt("Cargando contenido…")}</p>
            <p className="text-muted text-sm">{tt("Esto puede tomar unos segundos")}</p>
          </div>
        )}
      </div>
    </motion.main>
  )
}

// Exportamos las keys para que Navbar pueda armar el mega-menú
export const ALL_CATEGORIES = Object.keys({ ...LEGACY_CONFIG, ...DYNAMIC_CONFIG })
