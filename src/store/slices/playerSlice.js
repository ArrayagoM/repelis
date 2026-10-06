import { createSlice } from '@reduxjs/toolkit'
import { requiresAccount } from '../../lib/access'

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
    item:         null,   // título normalizado (toLibItem) para Continuar viendo
    runtimeMin:   0,
    locked:       false,  // el título pide cuenta para reproducirse (ver lib/access.js)
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
      state.item         = action.payload.item         || null
      state.runtimeMin   = action.payload.runtimeMin   || 0
      state.locked       = requiresAccount(action.payload.item)
    },
    closePlayer(state) {
      state.isOpen       = false
      state.movieId      = null
      state.title        = ''
      state.mediaType    = 'movie'
      state.season       = 1
      state.episode      = 1
      state.totalSeasons = 1
      state.item         = null
      state.runtimeMin   = 0
      state.locked       = false
    },
    setEpisode(state, action) {
      state.season  = action.payload.season
      state.episode = action.payload.episode
      if (action.payload.runtimeMin) state.runtimeMin = action.payload.runtimeMin
    },
  },
})

export const { openPlayer, closePlayer, setEpisode } = playerSlice.actions
export default playerSlice.reducer
