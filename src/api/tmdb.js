import axios from 'axios'
import { track } from '../lib/errorMonitor'
import { getDiscoverParamsForMode } from '../lib/languageMode'

const BASE_URL = 'https://api.themoviedb.org/3'

// Token desde env (.env / VITE_TMDB_TOKEN). Sin fallback hardcodeado:
// si falta el token, lo decimos fuerte en consola para no debuggar a ciegas.
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_TOKEN
if (!ACCESS_TOKEN && typeof console !== 'undefined') {
  console.error('[Repelis] Falta VITE_TMDB_TOKEN en .env — la app no podrá pedir metadatos a TMDB.')
}

export const IMG_BASE     = 'https://image.tmdb.org/t/p'
export const IMG_W342     = IMG_BASE + '/w342'   // poster más liviano para red lenta
export const IMG_W500     = IMG_BASE + '/w500'
export const IMG_W780     = IMG_BASE + '/w780'
export const IMG_ORIGINAL = IMG_BASE + '/original'

const api = axios.create({
  baseURL: BASE_URL,
  headers: {
    Authorization: 'Bearer ' + ACCESS_TOKEN,
    'Content-Type': 'application/json',
  },
  params: { language: 'es-MX' },
  timeout: 8000,
})

// ─── Retry con backoff exponencial ──────────────────────────────────────
const MAX_RETRIES = 3
const BASE_DELAY  = 500

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const cfg = error.config || {}
    cfg.__retryCount = cfg.__retryCount || 0

    const status = error.response?.status
    const isNetwork = !error.response
    const is5xx = status >= 500 && status < 600
    const should = (isNetwork || is5xx) && cfg.__retryCount < MAX_RETRIES

    if (!should) {
      track('tmdb', error, { url: cfg.url, status })
      return Promise.reject(error)
    }

    cfg.__retryCount += 1
    await sleep(BASE_DELAY * Math.pow(2, cfg.__retryCount - 1))
    return api(cfg)
  },
)

// ════════════════════════════════════════════════════════════════════════
//  MOVIES — endpoints clásicos
// ════════════════════════════════════════════════════════════════════════
export const getTrending      = (page = 1) => api.get('/trending/movie/week',  { params: { page } })
export const getTrendingDay   = (page = 1) => api.get('/trending/movie/day',   { params: { page } })
export const getPopular       = (page = 1) => api.get('/movie/popular',        { params: { page } })
export const getTopRated      = (page = 1) => api.get('/movie/top_rated',      { params: { page } })
export const getNowPlaying    = (page = 1) => api.get('/movie/now_playing',    { params: { page } })
export const getUpcoming      = (page = 1) => api.get('/movie/upcoming',       { params: { page } })
export const getMovieDetail   = (id)       => api.get('/movie/' + id)
export const getMovieCredits  = (id)       => api.get('/movie/' + id + '/credits')
export const getMovieVideos   = (id)       => api.get('/movie/' + id + '/videos', { params: { language: 'en-US' } })
export const getSimilarMovies = (id, page = 1) => api.get('/movie/' + id + '/similar', { params: { page } })

// Endpoints nuevos para info de doblaje y catálogo extendido
export const getMovieReleaseDates = (id) => api.get('/movie/' + id + '/release_dates')
export const getMovieTranslations = (id) => api.get('/movie/' + id + '/translations')
export const getMovieKeywords     = (id) => api.get('/movie/' + id + '/keywords')
export const getMovieExternalIds  = (id) => api.get('/movie/' + id + '/external_ids')
export const getMovieRecommendations = (id, page = 1) =>
  api.get('/movie/' + id + '/recommendations', { params: { page } })

// Trending mezclado (películas + series)
export const getTrendingAll = (page = 1) => api.get('/trending/all/week', { params: { page } })

// Por keyword (Marvel, Star Wars, MCU, Saw, James Bond, etc.)
export const getMoviesByKeyword = (keywordId, page = 1) =>
  api.get('/discover/movie', { params: { with_keywords: keywordId, sort_by: 'popularity.desc', page } })
export const getTVByKeyword = (keywordId, page = 1) =>
  api.get('/discover/tv', { params: { with_keywords: keywordId, sort_by: 'popularity.desc', page } })

// Por network de TV (Cartoon Network, FX, AMC, HBO original, etc.)
export const getTVByNetwork = (networkId, page = 1) =>
  api.get('/discover/tv', { params: { with_networks: networkId, sort_by: 'popularity.desc', page } })

// Watch providers: dónde ver la peli/serie legalmente por país.
// Devuelve flatrate (suscripción), rent (alquiler), buy (compra) por país.
export const getMovieWatchProviders = (id) => api.get('/movie/' + id + '/watch/providers')
export const getTVWatchProviders    = (id) => api.get('/tv/' + id + '/watch/providers')
export const getMoviesByGenre = (genreId, page = 1) =>
  api.get('/discover/movie', { params: { with_genres: genreId, sort_by: 'popularity.desc', page } })

// ════════════════════════════════════════════════════════════════════════
//  TV — endpoints clásicos
// ════════════════════════════════════════════════════════════════════════
export const getTrendingTV    = (page = 1) => api.get('/trending/tv/week',   { params: { page } })
export const getPopularTV     = (page = 1) => api.get('/tv/popular',         { params: { page } })
export const getTopRatedTV    = (page = 1) => api.get('/tv/top_rated',       { params: { page } })
export const getAiringTodayTV = (page = 1) => api.get('/tv/airing_today',    { params: { page } })
export const getOnTheAirTV    = (page = 1) => api.get('/tv/on_the_air',      { params: { page } })
export const getTVDetail      = (id)       => api.get('/tv/' + id)
export const getTVCredits     = (id)       => api.get('/tv/' + id + '/credits')
export const getTVVideos      = (id)       => api.get('/tv/' + id + '/videos', { params: { language: 'en-US' } })
export const getSimilarTV     = (id, page = 1) => api.get('/tv/' + id + '/similar', { params: { page } })
export const getTVSeason      = (id, season)   => api.get('/tv/' + id + '/season/' + season)

// ════════════════════════════════════════════════════════════════════════
//  ANIME / K-DRAMA / CLÁSICOS
// ════════════════════════════════════════════════════════════════════════
export const getAnime = (page = 1) =>
  api.get('/discover/tv', { params: { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', page } })
export const getAnimeMovies = (page = 1) =>
  api.get('/discover/movie', { params: { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', page } })
export const getKDrama = (page = 1) =>
  api.get('/discover/tv', { params: { with_origin_country: 'KR', sort_by: 'popularity.desc', page } })
export const getClassics = (page = 1) =>
  api.get('/discover/movie', {
    params: { 'vote_average.gte': 7.5, 'vote_count.gte': 1000, 'release_date.lte': '1994-12-31', sort_by: 'vote_average.desc', page },
  })

// ════════════════════════════════════════════════════════════════════════
//  MOVIES — por género (IDs oficiales de TMDB)
// ════════════════════════════════════════════════════════════════════════
const movieByGenre = (genreId) => (page = 1) =>
  api.get('/discover/movie', { params: { with_genres: genreId, sort_by: 'popularity.desc', page, 'vote_count.gte': 50 } })

export const getAction       = movieByGenre(28)
export const getAdventure    = movieByGenre(12)
export const getAnimation    = movieByGenre(16)
export const getComedy       = movieByGenre(35)
export const getCrime        = movieByGenre(80)
export const getDocumentary  = movieByGenre(99)
export const getDrama        = movieByGenre(18)
export const getFamily       = movieByGenre(10751)
export const getFantasy      = movieByGenre(14)
export const getHistory      = movieByGenre(36)
export const getHorror       = movieByGenre(27)
export const getMusic        = movieByGenre(10402)
export const getMystery      = movieByGenre(9648)
export const getRomance      = movieByGenre(10749)
export const getSciFi        = movieByGenre(878)
export const getThriller     = movieByGenre(53)
export const getWar          = movieByGenre(10752)
export const getWestern      = movieByGenre(37)

// ════════════════════════════════════════════════════════════════════════
//  TV — por género
// ════════════════════════════════════════════════════════════════════════
const tvByGenre = (genreId) => (page = 1) =>
  api.get('/discover/tv', { params: { with_genres: genreId, sort_by: 'popularity.desc', page, 'vote_count.gte': 20 } })

export const getTVAction      = tvByGenre(10759)   // Action & Adventure
export const getTVComedy      = tvByGenre(35)
export const getTVCrime       = tvByGenre(80)
export const getTVDocumentary = tvByGenre(99)
export const getTVDrama       = tvByGenre(18)
export const getTVFamily      = tvByGenre(10751)
export const getTVKids        = tvByGenre(10762)
export const getTVMystery     = tvByGenre(9648)
export const getTVReality     = tvByGenre(10764)
export const getTVSciFi       = tvByGenre(10765)   // Sci-Fi & Fantasy
export const getTVSoap        = tvByGenre(10766)   // Telenovela
export const getTVTalk        = tvByGenre(10767)
export const getTVWar         = tvByGenre(10768)
export const getTVWestern     = tvByGenre(37)

// ════════════════════════════════════════════════════════════════════════
//  POR AÑO / DÉCADA
// ════════════════════════════════════════════════════════════════════════
const currentYear = new Date().getFullYear()

export const getYear = (year) => (page = 1) =>
  api.get('/discover/movie', { params: { primary_release_year: year, sort_by: 'popularity.desc', page } })

export const getThisYear     = getYear(currentYear)
export const getLastYear     = getYear(currentYear - 1)

export const getDecade = (fromYear, toYear) => (page = 1) =>
  api.get('/discover/movie', {
    params: {
      'primary_release_date.gte': `${fromYear}-01-01`,
      'primary_release_date.lte': `${toYear}-12-31`,
      'vote_count.gte': 100,
      sort_by: 'vote_average.desc',
      page,
    },
  })

export const get2020s = getDecade(2020, 2029)
export const get2010s = getDecade(2010, 2019)
export const get2000s = getDecade(2000, 2009)
export const get1990s = getDecade(1990, 1999)
export const get1980s = getDecade(1980, 1989)
export const get1970s = getDecade(1970, 1979)

// ════════════════════════════════════════════════════════════════════════
//  POR PAÍS / REGIÓN
// ════════════════════════════════════════════════════════════════════════
const movieByCountry = (countries) => (page = 1) =>
  api.get('/discover/movie', { params: { with_origin_country: countries, sort_by: 'popularity.desc', page } })

export const getMoviesLatam      = movieByCountry('MX|AR|CO|CL|PE|VE|UY|EC|BO|PY')
export const getMoviesSpain      = movieByCountry('ES')
export const getMoviesUS         = movieByCountry('US')
export const getMoviesFrance     = movieByCountry('FR')
export const getMoviesItaly      = movieByCountry('IT')
export const getMoviesUK         = movieByCountry('GB')
export const getMoviesIndia      = movieByCountry('IN')   // Bollywood
export const getMoviesJapan      = movieByCountry('JP')
export const getMoviesKorea      = movieByCountry('KR')
export const getMoviesChina      = movieByCountry('CN|HK|TW')

// ════════════════════════════════════════════════════════════════════════
//  POR PROVEEDOR DE STREAMING (en región MX)
//  IDs oficiales de TMDB: 8=Netflix, 9=Prime, 337=Disney+, 384=HBO Max,
//  350=Apple TV+, 531=Paramount+, 283=Crunchyroll
// ════════════════════════════════════════════════════════════════════════
const byProvider = (providerId, kind = 'movie') => (page = 1) =>
  api.get(`/discover/${kind}`, {
    params: {
      with_watch_providers: providerId,
      watch_region: 'MX',
      sort_by: 'popularity.desc',
      page,
    },
  })

export const getNetflixMovies = byProvider(8, 'movie')
export const getNetflixTV     = byProvider(8, 'tv')
export const getPrimeMovies   = byProvider(9, 'movie')
export const getPrimeTV       = byProvider(9, 'tv')
export const getDisneyMovies  = byProvider(337, 'movie')
export const getDisneyTV      = byProvider(337, 'tv')
export const getHBOMovies     = byProvider(384, 'movie')
export const getHBOTV         = byProvider(384, 'tv')
export const getAppleTVMovies = byProvider(350, 'movie')
export const getAppleTVShows  = byProvider(350, 'tv')
export const getParamountMovies = byProvider(531, 'movie')
export const getParamountTV   = byProvider(531, 'tv')
export const getCrunchyroll   = byProvider(283, 'tv')

// ════════════════════════════════════════════════════════════════════════
//  POR ESTUDIO / COMPAÑÍA (with_companies)
//  IDs: 2=Disney, 3=Pixar, 33=Universal, 174=WB, 25=20th Century,
//  420=Marvel, 9993=DC, 10342=Studio Ghibli, 11=Lucasfilm, 21=Metro-Goldwyn
// ════════════════════════════════════════════════════════════════════════
const byCompany = (companyId) => (page = 1) =>
  api.get('/discover/movie', { params: { with_companies: companyId, sort_by: 'popularity.desc', page } })

export const getMarvel    = byCompany(420)
export const getDC        = byCompany(9993)
export const getPixar     = byCompany(3)
export const getGhibli    = byCompany(10342)
export const getDisneyClassic = byCompany(2)
export const getLucasfilm = byCompany(11)

// ════════════════════════════════════════════════════════════════════════
//  POR KEYWORD (franquicias muy puntuales)
//  Keywords TMDB: 180547=MCU, 4565=Distopía, 9714=Superhero, 9748=Revenge,
//  9882=Space, 9951=Alien, 10617=Time travel, 1721=Fight,
//  9826=Friendship, 2964=Future, 9799=Romantic comedy, 4376=Sequel,
//  6953=Anime (filter), 10683=Magic, 14544=Robot, 161176=Spy
// ════════════════════════════════════════════════════════════════════════
const movieByKeyword = (kwId) => (page = 1) =>
  api.get('/discover/movie', { params: { with_keywords: kwId, sort_by: 'popularity.desc', page, 'vote_count.gte': 30 } })

export const getMCU            = movieByKeyword(180547)
export const getDystopia       = movieByKeyword(4565)
export const getSuperhero      = movieByKeyword(9714)
export const getSpace          = movieByKeyword(9882)
export const getAlien          = movieByKeyword(9951)
export const getTimeTravel     = movieByKeyword(10617)
export const getZombies        = movieByKeyword(12377)
export const getVampires       = movieByKeyword(3133)
export const getMartialArts    = movieByKeyword(9748)
export const getSpy            = movieByKeyword(161176)
export const getHeist          = movieByKeyword(10051)
export const getApocalypse     = movieByKeyword(4458)

// ════════════════════════════════════════════════════════════════════════
//  POR NETWORK (canales de TV)
//  IDs TMDB: 213=Netflix, 1024=Prime, 2739=Disney+, 49=HBO, 4=BBC,
//  88=FX, 16=CBS, 6=NBC, 19=Fox, 174=AMC, 56=Cartoon Network,
//  44=Disney Channel, 209=Nickelodeon, 64=Discovery, 67=Showtime,
//  453=Hulu, 2552=AppleTV+, 4330=Paramount+
// ════════════════════════════════════════════════════════════════════════
const tvByNetwork = (netId) => (page = 1) =>
  api.get('/discover/tv', { params: { with_networks: netId, sort_by: 'popularity.desc', page } })

export const getHBOOriginals   = tvByNetwork(49)
export const getBBCShows       = tvByNetwork(4)
export const getFXShows        = tvByNetwork(88)
export const getAMCShows       = tvByNetwork(174)
export const getCartoonNetwork = tvByNetwork(56)
export const getDisneyChannel  = tvByNetwork(44)
export const getNickelodeon    = tvByNetwork(209)
export const getDiscoveryShows = tvByNetwork(64)
export const getShowtimeShows  = tvByNetwork(67)
export const getHuluShows      = tvByNetwork(453)

// ════════════════════════════════════════════════════════════════════════
//  KIDS / FAMILIAR (rating estricto)
// ════════════════════════════════════════════════════════════════════════
export const getKidsMovies = (page = 1) =>
  api.get('/discover/movie', {
    params: {
      with_genres: '10751,16',          // Familia + Animación
      certification_country: 'US',
      'certification.lte': 'PG',
      sort_by: 'popularity.desc',
      page,
    },
  })

// ════════════════════════════════════════════════════════════════════════
//  GENRES (metadata)
// ════════════════════════════════════════════════════════════════════════
export const getGenres   = () => api.get('/genre/movie/list')
export const getTVGenres = () => api.get('/genre/tv/list')

// ════════════════════════════════════════════════════════════════════════
//  SEARCH
// ════════════════════════════════════════════════════════════════════════
export const searchMovies = (query, page = 1) =>
  api.get('/search/movie', { params: { query, page, include_adult: false } })
export const searchTV = (query, page = 1) =>
  api.get('/search/tv', { params: { query, page, include_adult: false } })
export const searchMulti = (query, page = 1) =>
  api.get('/search/multi', { params: { query, page, include_adult: false } })

export default api
