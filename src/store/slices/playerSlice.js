import { createSlice } from '@reduxjs/toolkit'

const playerSlice = createSlice({
  name: 'player',
  initialState: {
    isOpen:       false,
    movieId:      null,
    title:        '',
    mediaType:    'movie',
    season:       1,
    episode:      1,
    totalSeasons: 1,
  },
  reducers: {
    openPlayer(state, action) {
      state.isOpen       = true
      state.movieId      = action.payload.movieId
      state.title        = action.payload.title        || ''
      state.mediaType    = action.payload.mediaType    || 'movie'
      state.season       = action.payload.season       || 1
      state.episode      = action.payload.episode      || 1
      state.totalSeasons = action.payload.totalSeasons || 1
    },
    closePlayer(state) {
      state.isOpen       = false
      state.movieId      = null
      state.title        = ''
      state.mediaType    = 'movie'
      state.season       = 1
      state.episode      = 1
      state.totalSeasons = 1
    },
    setEpisode(state, action) {
      state.season  = action.payload.season
      state.episode = action.payload.episode
    },
  },
})

export const { openPlayer, closePlayer, setEpisode } = playerSlice.actions
export default playerSlice.reducer
