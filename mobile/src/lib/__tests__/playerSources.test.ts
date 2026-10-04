import { LATAM_PRIORITY_IDS, SOURCES, buildEmbedHtml, buildUrl, getOrderedSources } from '@/lib/playerSources'

describe('playerSources', () => {
  it('ids únicos y urls https con el id', () => {
    const ids = SOURCES.map((s) => s.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const s of SOURCES) {
      expect(s.movieUrl(12345)).toMatch(/^https:\/\/.*12345/)
      const tv = s.tvUrl(999, 3, 7)
      expect(tv).toContain('999')
      expect(tv).toMatch(/3/)
      expect(tv).toMatch(/7/)
    }
  })

  it('VidLink fuerza audio latino por URL', () => {
    const vidlink = SOURCES.find((s) => s.id === 'vidlink')!
    expect(vidlink.movieUrl(27205)).toContain('dub=es-LA')
    expect(vidlink.tvUrl(1399, 1, 1)).toContain('dub=es-LA')
  })

  it('los 3 servidores latinos van siempre primero y en orden fijo, incluso con uno recordado', () => {
    expect(getOrderedSources().slice(0, 3).map((s) => s.id)).toEqual(LATAM_PRIORITY_IDS)
    expect(getOrderedSources('2embed-skin').slice(0, 3).map((s) => s.id)).toEqual(LATAM_PRIORITY_IDS)
  })

  it('el servidor recordado fuera del grupo prioritario encabeza el resto', () => {
    const rest = getOrderedSources('2embed-skin').filter((s) => !LATAM_PRIORITY_IDS.includes(s.id))
    expect(rest[0].id).toBe('2embed-skin')
  })

  it('no duplica ni pierde servidores; un recordado desconocido se ignora', () => {
    const ordered = getOrderedSources('no-existe')
    expect(ordered).toHaveLength(SOURCES.length)
    expect(new Set(ordered.map((s) => s.id)).size).toBe(SOURCES.length)
  })

  it('buildUrl distingue película y serie', () => {
    const s = SOURCES[0]
    expect(buildUrl(s, { mediaType: 'movie', id: 1 })).toBe(s.movieUrl(1))
    expect(buildUrl(s, { mediaType: 'tv', id: 1, season: 2, episode: 5 })).toBe(s.tvUrl(1, 2, 5))
  })

  it('buildEmbedHtml escapa la URL y arma el iframe sin referrer', () => {
    const html = buildEmbedHtml('https://x.test/a?b=1&c="2"')
    expect(html).toContain('src="https://x.test/a?b=1&amp;c=&quot;2&quot;"')
    expect(html).toContain('referrerpolicy="no-referrer"')
    expect(html).toContain('allowfullscreen')
    expect(html).toContain('ReactNativeWebView.postMessage')
  })
})
