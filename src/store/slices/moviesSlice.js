import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import {
  getTrending, getPopular, getTopRated, getNowPlaying, getUpcoming,
  getMovieDetail, getMovieCredits, getMovieVideos, getSimilarMovies, getMoviesByGenre,
  getTrendingTV, getPopularTV, getTopRatedTV, getAiringTodayTV, getOnTheAirTV,
  getTVDetail, getTVCredits, getTVVideos, getSimilarTV, getTVSeason,
  getAnime, getAnimeMovies, getKDrama, getClassics,
} from '../../api/tmdb'

const emptyList = () => ({ results: [], page: 0, totalPages: 0, loading: false, error: null })

// ─── Movies thunks ─────────────────────────────────────────────────────────
export const fetchTrending     = createAsyncThunk('movies/fetchTrending',     async (page = 1) => (await getTrending(page)).data)
export const fetchPopular      = createAsyncThunk('movies/fetchPopular',      async (page = 1) => (await getPopular(page)).data)
export const fetchTopRated     = createAsyncThunk('movies/fetchTopRated',     async (page = 1) => (await getTopRated(page)).data)
export const fetchNowPlaying   = createAsyncThunk('movies/fetchNowPlaying',   async (page = 1) => (await getNowPlaying(page)).data)
export const fetchUpcoming     = createAsyncThunk('movies/fetchUpcoming',     async (page = 1) => (await getUpcoming(page)).data)
export const fetchClassics     = createAsyncThunk('movies/fetchClassics',     async (page = 1) => (await getClassics(page)).data)
export const fetchAnimeMovies  = createAsyncThunk('movies/fetchAnimeMovies',  async (page = 1) => (await getAnimeMovies(page)).data)

export const fetchMovieDetail = createAsyncThunk('movies/fetchMovieDetail', async (id) => {
  const [detail, credits, videos, similar] = await Promise.all([
    getMovieDetail(id), getMovieCredits(id), getMovieVideos(id), getSimilarMovies(id),
  ])
  return { detail: detail.data, credits: credits.data, videos: videos.data, similar: similar.data.results }
})

export const fetchMoviesByGenre = createAsyncThunk('movies/fetchMoviesByGenre', async ({ genreId, page = 1 }) => {
  const res = await getMoviesByGenre(genreId, page)
  return { genreId, data: res.data }
})

// ─── TV thunks ─────────────────────────────────────────────────────────────
export const fetchTrendingTV    = createAsyncThunk('movies/fetchTrendingTV',    async (page = 1) => (await getTrendingTV(page)).data)
export const fetchPopularTV     = createAsyncThunk('movies/fetchPopularTV',     async (page = 1) => (await getPopularTV(page)).data)
export const fetchTopRatedTV    = createAsyncThunk('movies/fetchTopRatedTV',    async (page = 1) => (await getTopRatedTV(page)).data)
export const fetchAiringTodayTV = createAsyncThunk('movies/fetchAiringTodayTV', async (page = 1) => (await getAiringTodayTV(page)).data)
export const fetchOnTheAirTV    = createAsyncThunk('movies/fetchOnTheAirTV',    async (page = 1) => (await getOnTheAirTV(page)).data)
export const fetchAnime         = createAsyncThunk('movies/fetchAnime',         async (page = 1) => (await getAnime(page)).data)
export const fetchKDrama        = createAsyncThunk('movies/fetchKDrama',        async (page = 1) => (await getKDrama(page)).data)

export const fetchTVDetail = createAsyncThunk('movies/fetchTVDetail', async (id) => {
  const [detail, credits, videos, similar] = await Promise.all([
    getTVDetail(id), getTVCredits(id), getTVVideos(id), getSimilarTV(id),
  ])
  return { detail: detail.data, credits: credits.data, videos: videos.data, similar: similar.data.results }
})

export const fetchTVSeason = createAsyncThunk('movies/fetchTVSeason', async ({ id, season }) => {
  const res = await getTVSeason(id, season)
  return { id, season, data: res.data }
})

// ─── Initial state ─────────────────────────────────────────────────────────
const initialState = {
  trending: emptyList(), popular: emptyList(), topRated: emptyList(),
  nowPlaying: emptyList(), upcoming: emptyList(), classics: emptyList(), animeMovies: emptyList(),
  byGenre: {},
  trendingTV: emptyList(), popularTV: emptyList(), topRatedTV: emptyList(),
  airingTodayTV: emptyList(), onTheAirTV: emptyList(), anime: emptyList(), kdrama: emptyList(),
  detail: { data: null, credits: null, videos: null, similar: [], loading: false, error: null, mediaType: 'movie' },
  seasons: {},
}

// ─── Helper ────────────────────────────────────────────────────────────────
const addListCases = (builder, thunk, key) => {
  builder
    .addCase(thunk.pending,   (s) => { s[key].loading = true; s[key].error = null })
    .addCase(thunk.fulfilled, (s, a) => {
      s[key].loading    = false
      s[key].results    = a.payload.page === 1 ? a.payload.results : [...s[key].results, ...a.payload.results]
      s[key].page       = a.payload.page
      s[key].totalPages = a.payload.total_pages
    })
    .addCase(thunk.rejected,  (s, a) => { s[key].loading = false; s[key].error = a.error.message })
}

const moviesSlice = createSlice({
  name: 'movies',
  initialState,
  reducers: {
    clearDetail(state) {
      state.detail = { data: null, credits: null, videos: null, similar: [], loading: false, error: null, mediaType: 'movie' }
    },
  },
  extraReducers: (builder) => {
    addListCases(builder, fetchTrending,     'trending')
    addListCases(builder, fetchPopular,      'popular')
    addListCases(builder, fetchTopRated,     'topRated')
    addListCases(builder, fetchNowPlaying,   'nowPlaying')
    addListCases(builder, fetchUpcoming,     'upcoming')
    addListCases(builder, fetchClassics,     'classics')
    addListCases(builder, fetchAnimeMovies,  'animeMovies')
    addListCases(builder, fetchTrendingTV,   'trendingTV')
    addListCases(builder, fetchPopularTV,    'popularTV')
    addListCases(builder, fetchTopRatedTV,   'topRatedTV')
    addListCases(builder, fetchAiringTodayTV,'airingTodayTV')
    addListCases(builder, fetchOnTheAirTV,   'onTheAirTV')
    addListCases(builder, fetchAnime,        'anime')
    addListCases(builder, fetchKDrama,       'kdrama')

    builder
      .addCase(fetchMovieDetail.pending,   (s) => { s.detail.loading = true; s.detail.error = null })
      .addCase(fetchMovieDetail.fulfilled, (s, a) => {
        s.detail.loading = false; s.detail.data = a.payload.detail
        s.detail.credits = a.payload.credits; s.detail.videos = a.payload.videos
        s.detail.similar = a.payload.similar; s.detail.mediaType = 'movie'
      })
      .addCase(fetchMovieDetail.rejected,  (s, a) => { s.detail.loading = false; s.detail.error = a.error.message })

    builder
      .addCase(fetchTVDetail.pending,   (s) => { s.detail.loading = true; s.detail.error = null })
      .addCase(fetchTVDetail.fulfilled, (s, a) => {
        s.detail.loading = false; s.detail.data = a.payload.detail
        s.detail.credits = a.payload.credits; s.detail.videos = a.payload.videos
        s.detail.similar = a.payload.similar; s.detail.mediaType = 'tv'
      })
      .addCase(fetchTVDetail.rejected,  (s, a) => { s.detail.loading = false; s.detail.error = a.error.message })

    builder
      .addCase(fetchTVSeason.pending,   (s, a) => {
        const k = `${a.meta.arg.id}_${a.meta.arg.season}`
        s.seasons[k] = { episodes: [], loading: true, error: null }
      })
      .addCase(fetchTVSeason.fulfilled, (s, a) => {
        const k = `${a.payload.id}_${a.payload.season}`
        s.seasons[k] = { episodes: a.payload.data.episodes || [], loading: false, error: null }
      })
      .addCase(fetchTVSeason.rejected,  (s, a) => {
        const k = `${a.meta.arg.id}_${a.meta.arg.season}`
        if (s.seasons[k]) s.seasons[k].loading = false
      })

    builder
      .addCase(fetchMoviesByGenre.pending,  (s, a) => {
        const gid = a.meta.arg.genreId
        if (!s.byGenre[gid]) s.byGenre[gid] = emptyList()
        s.byGenre[gid].loading = true
      })
      .addCase(fetchMoviesByGenre.fulfilled, (s, a) => {
        const { genreId, data } = a.payload
        s.byGenre[genreId] = {
          results: data.page === 1 ? data.results : [...(s.byGenre[genreId]?.results || []), ...data.results],
          page: data.page, totalPages: data.total_pages, loading: false, error: null,
        }
      })
      .addCase(fetchMoviesByGenre.rejected, (s, a) => {
        const gid = a.meta.arg.genreId
        if (s.byGenre[gid]) s.byGenre[gid].loading = false
      })
  },
})

export const { clearDetail } = moviesSlice.actions
export default moviesSlice.reducer
