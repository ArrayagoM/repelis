import { useEffect, useState } from 'react'
import PosterStrip from '../PosterStrip'
import { getLibrary, useLibrary } from '../../lib/library'
import { loadForYou, pickSeeds } from '../../lib/forYou'

/** "Recomendadas para vos": a partir de lo último que viste y guardaste. Sin seeds, no aparece. */
export default function ForYouRow() {
  const lib = useLibrary()
  const [recs, setRecs] = useState([])
  // Solo recalculamos si cambian las semillas (no con cada tick de progreso)
  const sig = pickSeeds(lib).map((s) => `${s.type}:${s.id}`).join(',')

  useEffect(() => {
    if (!sig) { setRecs([]); return undefined }
    let cancelled = false
    loadForYou(getLibrary()).then((r) => { if (!cancelled) setRecs(r) })
    return () => { cancelled = true }
  }, [sig])

  const items = recs.map((r) => ({
    key: `${r.media}:${r.id}`,
    poster: r.poster_path,
    title: r.title || r.name,
    sub: (r.release_date || r.first_air_date || '').slice(0, 4),
    chip: r.media === 'tv' ? 'Serie' : undefined,
    chipTone: 'blue',
    to: `/${r.media === 'tv' ? 'tv' : 'movie'}/${r.id}`,
  }))

  return <PosterStrip id="para-vos" title="Recomendadas para vos" badge="Según lo que viste" items={items} />
}
