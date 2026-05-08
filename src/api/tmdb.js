import axios from 'axios'

const BASE_URL = 'https://api.themoviedb.org/3'

// Token desde env (.env / VITE_TMDB_TOKEN). Sin fallback hardcodeado:
// si falta el token, lo decimos fuerte en consola para no debuggar a ciegas.
const ACCESS_TOKEN = import.meta.env.VITE_TMDB_TOKEN
if (!ACCESS_TOKEN && typeof console !== 'undefined') {
  console.error('[Repelis] Falta VITE_TMDB_TOKEN en .env — la app no podrá pedir metadatos a TMDB.')
}

export const IMG_BASE     = 'https://image.tmdb.org/t/p'
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
})

// Movies
export const getTrending      = (page = 1) => api.get('/trending/movie/week',  { params: { page } })
export const getPopular       = (page = 1) => api.get('/movie/popular',        { params: { page } })
export const getTopRated      = (page = 1) => api.get('/movie/top_rated',      { params: { page } })
export const getNowPlaying    = (page = 1) => api.get('/movie/now_playing',    { params: { page } })
export const getUpcoming      = (page = 1) => api.get('/movie/upcoming',       { params: { page } })
export const getMovieDetail   = (id)       => api.get('/movie/' + id)
export const getMovieCredits  = (id)       => api.get('/movie/' + id + '/credits')
export const getMovieVideos   = (id)       => api.get('/movie/' + id + '/videos', { params: { language: 'en-US' } })
export const getSimilarMovies = (id, page = 1) => api.get('/movie/' + id + '/similar', { params: { page } })
export const getMoviesByGenre = (genreId, page = 1) =>
  api.get('/discover/movie', { params: { with_genres: genreId, sort_by: 'popularity.desc', page } })

// TV Shows
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

// Anime (Animation genre=16, origin JP)
export const getAnime = (page = 1) =>
  api.get('/discover/tv', {
    params: { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', page },
  })

export const getAnimeMovies = (page = 1) =>
  api.get('/discover/movie', {
    params: { with_genres: 16, with_origin_country: 'JP', sort_by: 'popularity.desc', page },
  })

// K-Drama
export const getKDrama = (page = 1) =>
  api.get('/discover/tv', {
    params: { with_origin_country: 'KR', sort_by: 'popularity.desc', page },
  })

// Classics (well-rated, pre-1995)
export const getClassics = (page = 1) =>
  api.get('/discover/movie', {
    params: {
      'vote_average.gte': 7.5,
      'vote_count.gte': 1000,
      'release_date.lte': '1994-12-31',
      sort_by: 'vote_average.desc',
      page,
    },
  })

// Genres
export const getGenres   = () => api.get('/genre/movie/list')
export const getTVGenres = () => api.get('/genre/tv/list')

// Search
export const searchMovies = (query, page = 1) =>
  api.get('/search/movie', { params: { query, page, include_adult: false } })

export const searchTV = (query, page = 1) =>
  api.get('/search/tv', { params: { query, page, include_adult: false } })

export const searchMulti = (query, page = 1) =>
  api.get('/search/multi', { params: { query, page, include_adult: false } })

export default api
