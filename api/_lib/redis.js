// Cliente mínimo para Upstash Redis REST API.
// Funciona con env vars de Vercel KV (KV_REST_API_*) o de Upstash directo
// (UPSTASH_REDIS_REST_*). Lo que llegue primero gana.

const URL   = process.env.KV_REST_API_URL  || process.env.UPSTASH_REDIS_REST_URL  || ''
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN || ''

export const isRedisConfigured = () => !!(URL && TOKEN)

const call = async (cmd) => {
  if (!isRedisConfigured()) throw new Error('redis_not_configured')
  const res = await fetch(URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(cmd),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`redis_error_${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.result
}

// Pipeline para varios comandos atómicos
const pipeline = async (commands) => {
  if (!isRedisConfigured()) throw new Error('redis_not_configured')
  const res = await fetch(`${URL}/pipeline`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(commands),
  })
  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`redis_pipeline_error_${res.status}: ${txt.slice(0, 200)}`)
  }
  const data = await res.json()
  return data.map((d) => d.result)
}

export const redis = {
  hincrby:  (key, field, n)   => call(['HINCRBY', key, field, String(n)]),
  hset:     (key, obj)         => call(['HSET', key, ...Object.entries(obj).flatMap(([k, v]) => [k, String(v)])]),
  hgetall:  (key)              => call(['HGETALL', key]).then((arr) => {
    if (!arr) return null
    const o = {}
    for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1]
    return o
  }),
  sadd:     (key, value)       => call(['SADD', key, value]),
  smembers: (key)              => call(['SMEMBERS', key]).then((x) => x || []),
  scard:    (key)              => call(['SCARD', key]).then((n) => Number(n) || 0),
  incr:     (key)              => call(['INCR', key]).then((n) => Number(n) || 0),
  get:      (key)              => call(['GET', key]),
  expire:   (key, seconds)     => call(['EXPIRE', key, String(seconds)]),
  pipeline,
}
