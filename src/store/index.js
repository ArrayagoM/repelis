import { configureStore } from '@reduxjs/toolkit'
import moviesReducer from './slices/moviesSlice'
import searchReducer from './slices/searchSlice'
import genresReducer from './slices/genresSlice'
import playerReducer from './slices/playerSlice'

export const store = configureStore({
  reducer: {
    movies: moviesReducer,
    search: searchReducer,
    genres: genresReducer,
    player: playerReducer,
  },
})

export default store
