import { createSlice, createAsyncThunk } from '@reduxjs/toolkit'
import { getGenres } from '../../api/tmdb'

export const fetchGenres = createAsyncThunk('genres/fetchGenres', async () => {
  const res = await getGenres()
  return res.data.genres
})

const genresSlice = createSlice({
  name: 'genres',
  initialState: {
    list:    [],
    loading: false,
    error:   null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchGenres.pending,   (s) => { s.loading = true })
      .addCase(fetchGenres.fulfilled, (s, a) => { s.loading = false; s.list = a.payload })
      .addCase(fetchGenres.rejected,  (s, a) => { s.loading = false; s.error = a.error.message })
  },
})

export default genresSlice.reducer
