// Reglas puras del reproductor (se prueban sin navegador): cuándo cerrar, cuándo saltar de servidor.

/** Tras salir de pantalla completa con ESC, el navegador a veces reenvía esa tecla a la página: la ignoramos un instante. */
export const ESC_GRACE_MS = 800

/**
 * ¿La tecla ESC debe cerrar el reproductor?
 * No si está en pantalla completa (ESC solo la cierra) ni si acaba de salir de ella.
 */
export const escShouldClose = ({ fullscreenActive, lastFullscreenChangeAt = 0, now = Date.now() }) => {
  if (fullscreenActive) return false
  if (lastFullscreenChangeAt && now - lastFullscreenChangeAt < ESC_GRACE_MS) return false
  return true
}

/** Siguiente servidor (en orden circular) que todavía no se probó; -1 si ya se probaron todos. */
export const nextUntried = (tried, current, total) => {
  if (!total) return -1
  for (let step = 1; step <= total; step += 1) {
    const idx = (current + step) % total
    if (!tried.has(idx)) return idx
  }
  return -1
}

/** Servidores que avisan por postMessage lo que pasa en el video (PLAYER_EVENT): con ellos se puede comprobar que arrancó de verdad. */
export const EVENT_SOURCE_IDS = new Set(['vidlink', 'vidfast'])
export const emitsEvents = (source) => !!source && EVENT_SOURCE_IDS.has(source.id)

/** ¿Este mensaje del iframe prueba que el reproductor está vivo? */
export const isPlayerSignal = (d) => {
  if (!d || typeof d !== 'object') return false
  const evt = d.event || d.type
  return evt === 'play' || evt === 'playing' || evt === 'started' || evt === 'timeupdate' || evt === 'PLAYER_EVENT'
}

/** Espera máxima (ms) según la calidad de la conexión. */
export const loadTimeoutMs = (quality) => (quality === 'slow' ? 25000 : quality === 'moderate' ? 18000 : 12000)
export const silentTimeoutMs = (quality) => (quality === 'slow' ? 45000 : quality === 'moderate' ? 35000 : 25000)
