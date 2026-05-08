import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { searchMulti } from '../../api/tmdb'

// Multi-search: devuelve películas + series + personas en un solo request
export const fetchSearch = createAsyncThunk('search/fetchSearch', async ({ query, page = 1 }) => {
  const res = await searchMulti(query, page)
  // Filtrar solo movies y tv (excluir personas y otros)
  const filtered = {
    ...res.data,
    results: res.data.results.filter((r) => r.media_type === 'movie' || r.media_type === 'tv'),
  }
  return { data: filtered, page, query }
})

const searchSlice = createSlice({
  name: 'search',
  initialState: {
    query: '', results: [], page: 0, totalPages: 0, loading: false, error: null,
  },
  reducers: {
    setQuery:    (state, action) => { state.query = action.payload },
    clearSearch: (state) => {
      state.query = ''; state.results = []; state.page = 0
      state.totalPages = 0; state.loading = false; state.error = null
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchSearch.pending,   (s) => { s.loading = true; s.error = null })
      .addCase(fetchSearch.fulfilled, (s, a) => {
        s.loading    = false
        s.query      = a.payload.query
        s.results    = a.payload.page === 1
          ? a.payload.data.results
          : [...s.results, ...a.payload.data.results]
        s.page       = a.payload.data.page
        s.totalPages = a.payload.data.total_pages
      })
      .addCase(fetchSearch.rejected,  (s, a) => { s.loading = false; s.error = a.error.message })
  },
})

export const { setQuery, clearSearch } = searchSlice.actions
export default searchSlice.reducer
