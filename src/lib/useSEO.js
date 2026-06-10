import { useEffect } from 'react'
import { setPageSEO, setMovieSchema, setTVSchema, setOrgSchema } from './seo'

export const useSEO = (config) => {
  useEffect(() => {
    setPageSEO(config)
  }, [config?.title, config?.description, config?.image, config?.url])
}

export const useMovieSchema = (movie) => {
  useEffect(() => {
    if (movie) setMovieSchema(movie)
    return () => {
      const el = document.head.querySelector('script[type="application/ld+json"][data-seo="page"]')
      if (el) el.remove()
    }
  }, [movie])
}

export const useTVSchema = (show) => {
  useEffect(() => {
    if (show) setTVSchema(show)
    return () => {
      const el = document.head.querySelector('script[type="application/ld+json"][data-seo="page"]')
      if (el) el.remove()
    }
  }, [show])
}

export const useOrgSchema = () => {
  useEffect(() => { setOrgSchema() }, [])
}
