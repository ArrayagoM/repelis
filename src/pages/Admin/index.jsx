import { useEffect, useState, useCallback } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ArrowLeft, ShieldCheck, ChartBar, Pulse, Bug, Database, Cloud,
  Terminal, ArrowClockwise, CheckCircle, XCircle, ArrowSquareOut,
  Lock, TrashSimple, MapTrifold, Globe, DeviceMobile, Users, Info, Warning,
} from '@phosphor-icons/react'
import WorldMap from '../../components/WorldMap'
import { getCachedGeo, getClientGeo } from '../../lib/clientGeo'
import { fetchVisits, getSavedBackendPin } from '../../lib/visitsClient'
import { getSessionPin } from '../../lib/adminAuth'
import {
  adminConfigured, adminIsAuthed, adminLogin, adminLogout,
} from '../../lib/adminAuth'
import { getErrors, subscribe as subscribeErrors, clearErrors } from '../../lib/errorMonitor'
import { pingAll, getServerHistory, clearServerHistory } from '../../lib/serverHealth'
import { SOURCES } from '../../lib/playerSources'

const TABS = [
  { id: 'overview',  label: 'Resumen',    Icon: ChartBar },
  { id: 'analytics', label: 'Analytics',  Icon: MapTrifold },
  { id: 'servers',   label: 'Servidores', Icon: Pulse },
  { id: 'errors',    label: 'Errores',    Icon: Bug },
  { id: 'storage',   label: 'Storage',    Icon: Database },
  { id: 'cache',     label: 'Cache SW',   Icon: Cloud },
  { id: 'console',   label: 'Consola',    Icon: Terminal },
]

export default function Admin() {
  const navigate = useNavigate()
  const [authed, setAuthed]   = useState(adminIsAuthed())
  const [tab,    setTab]      = useState('overview')

  if (!authed) return <PinGate onSuccess={() => setAuthed(true)} />

  return (
    <motion.main
      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
      className="min-h-screen bg-void pt-24 pb-24"
    >
      <div className="max-w-7xl mx-auto px-6 md:px-12">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => navigate('/')}
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold">
            <ArrowLeft size={16} />
          </button>
          <div className="flex items-center gap-2">
            <ShieldCheck size={20} className="text-gold" weight="fill" />
            <h1 className="font-display font-extrabold text-2xl text-chalk">Admin Dashboard</h1>
          </div>
          <button onClick={() => { adminLogout(); setAuthed(false) }}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-muted text-xs hover:text-red-400 transition-colors">
            <Lock size={11} /> Cerrar sesión
          </button>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map(({ id, label, Icon }) => (
            <button key={id} onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-all
                ${tab === id ? 'bg-gold/10 text-gold border border-gold/20' : 'text-muted hover:text-chalk border border-transparent'}`}>
              <Icon size={14} weight={tab === id ? 'fill' : 'regular'} />
              {label}
            </button>
          ))}
        </div>

        {tab === 'overview'  && <OverviewTab />}
        {tab === 'analytics' && <AnalyticsTab />}
        {tab === 'servers'   && <ServersTab />}
        {tab === 'errors'   && <ErrorsTab />}
        {tab === 'storage'  && <StorageTab />}
        {tab === 'cache'    && <CacheTab />}
        {tab === 'console'  && <ConsoleTab />}
      </div>
    </motion.main>
  )
}

// ─── PIN gate ─────────────────────────────────────────────────────────────
function PinGate({ onSuccess }) {
  const [pin, setPin]     = useState('')
  const [error, setError] = useState('')

  const submit = (e) => {
    e.preventDefault()
    if (adminLogin(pin)) { onSuccess() }
    else { setError('PIN incorrecto'); setPin('') }
  }

  return (
    <main className="min-h-screen bg-void flex items-center justify-center p-6">
      <form onSubmit={submit} className="w-full max-w-sm space-y-4 bg-surface border border-white/10 rounded-2xl p-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-gold flex items-center justify-center">
            <Lock size={18} weight="fill" className="text-void" />
          </div>
          <div>
            <p className="font-display font-bold text-chalk">Acceso restringido</p>
            <p className="text-muted text-xs">Solo TinTech</p>
          </div>
        </div>

        {!adminConfigured() && (
          <p className="text-amber-300 text-xs bg-amber-500/10 border border-amber-500/20 rounded-lg p-3">
            <strong>Tip:</strong> seteá <code className="font-mono">VITE_ADMIN_PIN</code> en Vercel para proteger este panel.
          </p>
        )}

        <input
          type="password"
          autoFocus
          value={pin}
          onChange={(e) => { setPin(e.target.value); setError('') }}
          placeholder="PIN"
          className="w-full bg-void border border-white/10 rounded-lg px-4 py-3 text-chalk text-base font-mono focus:outline-none focus:border-gold/40"
        />

        {error && <p className="text-red-400 text-xs">{error}</p>}

        <button type="submit"
          className="w-full px-4 py-3 rounded-lg bg-gold text-void font-bold text-sm hover:bg-gold-hi transition-colors">
          Entrar
        </button>

        <Link to="/" className="block text-center text-muted text-xs hover:text-chalk transition-colors">
          ← Volver al sitio
        </Link>
      </form>
    </main>
  )
}

// ─── Overview ─────────────────────────────────────────────────────────────
function OverviewTab() {
  const [stats, setStats] = useState(null)

  useEffect(() => {
    const update = () => {
      const errors = getErrors()
      const history = getServerHistory()
      const srvOk = Object.values(history).filter((s) => s.okPct >= 50).length
      const srvTotal = Object.values(history).length
      const avgLatency = Math.round(
        Object.values(history).filter((s) => s.avgMs > 0)
          .reduce((a, s) => a + s.avgMs, 0) / Math.max(1, srvOk),
      )
      setStats({
        errors24h: errors.filter((e) => Date.now() - e.ts < 24*3600*1000).length,
        errorsTotal: errors.length,
        srvOk, srvTotal, avgLatency,
        samples: Object.values(history).reduce((a, s) => a + s.samples, 0),
        lastSrc: localStorage.getItem('repelis:lastSource:v1'),
      })
    }
    update()
    const t = setInterval(update, 5000)
    return () => clearInterval(t)
  }, [])

  if (!stats) return <p className="text-muted">Cargando…</p>

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Kpi label="Servidores OK"    value={`${stats.srvOk}/${SOURCES.length}`} color="emerald" />
      <Kpi label="Latencia prom."   value={`${stats.avgLatency || '–'} ms`}    color="gold" />
      <Kpi label="Errores 24h"      value={stats.errors24h}                    color={stats.errors24h > 0 ? 'red' : 'emerald'} />
      <Kpi label="Mediciones hechas" value={stats.samples}                     color="blue" />
      <Kpi label="Último servidor usado" value={stats.lastSrc || '—'}          color="purple" wide />
      <Kpi label="Pagos / Ingresos"  value="—"  color="amber" wide
           sub="No implementado por política — ver respuesta del CTO" />
    </div>
  )
}

function Kpi({ label, value, color = 'gold', wide = false, sub = null }) {
  const colors = {
    emerald: 'border-emerald-500/20 text-emerald-300',
    gold:    'border-gold/20 text-gold',
    red:     'border-red-500/20 text-red-300',
    blue:    'border-sky-500/20 text-sky-300',
    purple:  'border-purple-500/20 text-purple-300',
    amber:   'border-amber-500/20 text-amber-300',
  }
  return (
    <div className={`${wide ? 'col-span-2' : ''} p-4 rounded-2xl bg-surface border ${colors[color]}`}>
      <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold">{label}</p>
      <p className={`mt-1 text-2xl font-display font-extrabold ${colors[color].split(' ')[1]}`}>{value}</p>
      {sub && <p className="text-muted/50 text-[11px] mt-1">{sub}</p>}
    </div>
  )
}

// ─── Servidores ───────────────────────────────────────────────────────────
function ServersTab() {
  const [stats,    setStats]    = useState(getServerHistory())
  const [pinging,  setPinging]  = useState(false)
  const [liveData, setLiveData] = useState({})

  const refresh = useCallback(async () => {
    setPinging(true)
    try {
      const results = await pingAll()
      const live = {}
      for (const r of results) live[r.id] = r
      setLiveData(live)
      setStats(getServerHistory())
    } finally {
      setPinging(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={refresh} disabled={pinging}
          className="flex items-center gap-2 px-4 py-2 rounded-full bg-gold text-void text-sm font-semibold hover:bg-gold-hi disabled:opacity-50 transition-colors">
          <ArrowClockwise size={14} weight="bold" className={pinging ? 'animate-spin' : ''} />
          {pinging ? 'Midiendo...' : 'Hacer ping ahora'}
        </button>
        <button onClick={() => { clearServerHistory(); setStats(getServerHistory()) }}
          className="flex items-center gap-2 px-3 py-2 rounded-full bg-white/5 text-muted text-xs hover:text-red-400 transition-colors">
          <TrashSimple size={12} /> Limpiar historial
        </button>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-white/5">
        <table className="w-full text-sm">
          <thead className="bg-surface text-muted/60 text-[10px] uppercase tracking-widest">
            <tr>
              <th className="text-left px-4 py-3">Servidor</th>
              <th className="text-left px-4 py-3">Tipo</th>
              <th className="text-right px-4 py-3">Estado</th>
              <th className="text-right px-4 py-3">Ping (ms)</th>
              <th className="text-right px-4 py-3">Uptime</th>
              <th className="text-right px-4 py-3">Muestras</th>
            </tr>
          </thead>
          <tbody>
            {Object.entries(stats).map(([id, s]) => {
              const live = liveData[id]
              const status = live?.ok != null ? live.ok : s.lastSample?.ok
              return (
                <tr key={id} className="border-t border-white/5 hover:bg-white/[0.02]">
                  <td className="px-4 py-3 text-chalk font-medium">{s.label}</td>
                  <td className="px-4 py-3">
                    {s.esLat
                      ? <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-[10px] font-mono">🇲🇽 LATAM</span>
                      : <span className="text-muted/40 text-[10px] font-mono">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {status == null
                      ? <span className="text-muted/40 text-xs">sin datos</span>
                      : status
                        ? <span className="inline-flex items-center gap-1 text-emerald-400 text-xs"><CheckCircle size={12} weight="fill" /> Activo</span>
                        : <span className="inline-flex items-center gap-1 text-red-400 text-xs"><XCircle size={12} weight="fill" /> Caído</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {live?.ms != null ? `${live.ms}` : s.avgMs || '–'}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs">
                    {s.samples > 0
                      ? <span className={s.okPct >= 80 ? 'text-emerald-400' : s.okPct >= 50 ? 'text-amber-400' : 'text-red-400'}>{s.okPct}%</span>
                      : <span className="text-muted/40">–</span>}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-xs text-muted">{s.samples}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Errores ──────────────────────────────────────────────────────────────
function ErrorsTab() {
  const [errors, setErrors] = useState(getErrors())
  const [filter, setFilter] = useState('')

  useEffect(() => subscribeErrors(setErrors), [])

  const filtered = errors.filter((e) =>
    !filter || e.scope.includes(filter) || e.message.toLowerCase().includes(filter.toLowerCase())
  )

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Filtrar por scope o mensaje..."
          className="flex-1 bg-surface border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk focus:outline-none focus:border-gold/30" />
        <button onClick={() => { clearErrors() }}
          className="flex items-center gap-2 px-3 py-2 rounded-lg bg-white/5 text-muted text-xs hover:text-red-400 transition-colors">
          <TrashSimple size={12} /> Limpiar
        </button>
      </div>

      {filtered.length === 0 && (
        <p className="text-muted text-center py-12">Sin errores registrados — ¡vamos bien!</p>
      )}

      <div className="space-y-2">
        {filtered.map((e, i) => (
          <div key={i} className="p-3 rounded-xl bg-surface border border-red-500/10">
            <div className="flex items-center justify-between">
              <span className="text-red-300 text-xs font-mono font-bold">[{e.scope}]</span>
              <span className="text-muted/50 text-[10px] font-mono">{new Date(e.ts).toLocaleString()}</span>
            </div>
            <p className="text-chalk text-sm mt-1 break-words">{e.message}</p>
            {e.meta && Object.keys(e.meta).length > 0 && (
              <pre className="mt-2 text-[10px] font-mono text-muted/70 overflow-x-auto">{JSON.stringify(e.meta, null, 2)}</pre>
            )}
            {e.stack && (
              <details className="mt-2">
                <summary className="text-muted/50 text-[10px] cursor-pointer hover:text-chalk">stack</summary>
                <pre className="mt-1 text-[10px] font-mono text-muted/60 overflow-x-auto whitespace-pre-wrap">{e.stack}</pre>
              </details>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Storage ──────────────────────────────────────────────────────────────
function StorageTab() {
  const [items, setItems] = useState([])

  const refresh = () => {
    const list = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k?.startsWith('repelis:')) continue
      const v = localStorage.getItem(k)
      list.push({ key: k, value: v, size: new Blob([v]).size })
    }
    setItems(list)
  }
  useEffect(refresh, [])

  return (
    <div className="space-y-2">
      <button onClick={refresh} className="text-xs text-muted hover:text-chalk">↻ Refrescar</button>
      {items.map((it) => (
        <div key={it.key} className="p-3 rounded-xl bg-surface border border-white/5">
          <div className="flex items-center justify-between">
            <code className="text-gold font-mono text-xs">{it.key}</code>
            <div className="flex items-center gap-2">
              <span className="text-muted/50 text-[10px] font-mono">{it.size} B</span>
              <button onClick={() => { localStorage.removeItem(it.key); refresh() }}
                className="text-muted/40 hover:text-red-400">
                <TrashSimple size={12} />
              </button>
            </div>
          </div>
          <pre className="mt-2 text-[10px] font-mono text-muted overflow-x-auto whitespace-pre-wrap max-h-32 overflow-y-auto">
            {it.value?.length > 1000 ? it.value.slice(0, 1000) + '…' : it.value}
          </pre>
        </div>
      ))}
    </div>
  )
}

// ─── Cache SW ─────────────────────────────────────────────────────────────
function CacheTab() {
  const [caches_, setCaches] = useState([])

  const refresh = async () => {
    if (!('caches' in window)) { setCaches([]); return }
    const names = await caches.keys()
    const out = await Promise.all(names.map(async (n) => {
      const c = await caches.open(n)
      const keys = await c.keys()
      return { name: n, count: keys.length }
    }))
    setCaches(out)
  }

  useEffect(() => { refresh() }, [])

  const clearAll = async () => {
    if (!('caches' in window)) return
    const names = await caches.keys()
    await Promise.all(names.map((n) => caches.delete(n)))
    refresh()
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <button onClick={refresh} className="text-xs text-muted hover:text-chalk">↻ Refrescar</button>
        <button onClick={clearAll} className="text-xs text-red-400 hover:text-red-300">Limpiar TODOS</button>
      </div>
      {caches_.map((c) => (
        <div key={c.name} className="flex items-center justify-between p-3 rounded-xl bg-surface border border-white/5">
          <code className="text-gold font-mono text-xs">{c.name}</code>
          <span className="text-chalk text-sm font-mono">{c.count} entradas</span>
        </div>
      ))}
      {caches_.length === 0 && <p className="text-muted text-sm">Service Worker no activo o sin caches.</p>}
    </div>
  )
}

// ─── Analytics ────────────────────────────────────────────────────────────
function AnalyticsTab() {
  const VERCEL_PROJECT = 'repelis'
  const VERCEL_USER    = 'arrayagom'
  const ANALYTICS_URL = `https://vercel.com/${VERCEL_USER}/${VERCEL_PROJECT}/analytics`
  const SPEED_URL     = `https://vercel.com/${VERCEL_USER}/${VERCEL_PROJECT}/speed-insights`

  // Geo del admin (client-side puro, vía ipapi.co)
  const [myGeo, setMyGeo] = useState(getCachedGeo())
  useEffect(() => {
    if (!myGeo) {
      getClientGeo().then((g) => g && setMyGeo(g))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Visitas reales del backend (Upstash Redis via /api/visits) — auto-load.
  const [visitsData, setVisitsData] = useState(null)
  const [loadingVisits, setLoadingVisits] = useState(false)
  const [manualPin, setManualPin]   = useState('')

  const reloadVisits = async (pinOverride) => {
    setLoadingVisits(true)
    try {
      // Orden de PIN: el que se pasó manual → el que ya funcionó → el de sesión.
      const pin = pinOverride || getSavedBackendPin() || getSessionPin()
      const data = await fetchVisits(pin)
      setVisitsData(data)
    } finally {
      setLoadingVisits(false)
    }
  }
  // Auto-load al montar la tab + auto-refresh cada 30s
  useEffect(() => {
    reloadVisits()
    const t = setInterval(() => reloadVisits(), 30_000)
    return () => clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submitManualPin = async (e) => {
    e?.preventDefault()
    if (!manualPin.trim()) return
    await reloadVisits(manualPin.trim())
  }

  const citiesForMap = visitsData?.cities || []
  const hasRealData = !!(visitsData?.ok && visitsData?.cities?.length > 0)
  const kvNotConfigured = visitsData?.kvConfigured === false
  const needsPin = visitsData?.unauthorized || visitsData?.noPin
  const fetchError = visitsData?.error

  return (
    <div className="space-y-5">
      {/* Hero — info honesta de qué tenés */}
      <div className="p-5 rounded-2xl bg-gradient-to-br from-sky-500/10 to-emerald-500/10 border border-sky-500/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center flex-shrink-0">
            <MapTrifold size={20} weight="fill" className="text-sky-300" />
          </div>
          <div className="flex-1">
            <p className="text-chalk font-display font-bold text-base">Analytics activado</p>
            <p className="text-muted text-xs mt-1 leading-relaxed">
              Vercel Analytics está corriendo en el sitio. Cada visita se cuenta automáticamente
              sin cookies y sin pedir consentimiento (cumple GDPR y Ley 25.326 argentina).
              El dashboard completo con mapas, ciudades, dispositivos y top pages vive en vercel.com.
            </p>
          </div>
        </div>
      </div>

      {/* Stats reales del backend (cuando hay datos) */}
      {visitsData?.ok && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi label="Visitas hoy"        value={visitsData.stats.today}        color="gold" />
          <Kpi label="Visitas 7 días"     value={visitsData.stats.last7Days}    color="blue" />
          <Kpi label="Usuarios únicos hoy" value={visitsData.stats.uniquesToday} color="emerald" />
          <Kpi label="Ciudades total"     value={visitsData.stats.totalCities}  color="purple" />
        </div>
      )}

      {/* Diagnóstico: PIN incorrecto o faltante (por qué no ves las visitas) */}
      {needsPin && (
        <div className="p-4 rounded-2xl bg-red-500/8 border border-red-500/25 space-y-3">
          <p className="text-red-200 text-sm font-bold flex items-center gap-2">
            <Lock size={14} weight="fill" />
            {visitsData?.unauthorized
              ? 'El PIN no coincide con el backend'
              : 'Falta el PIN del backend'}
          </p>
          <p className="text-muted/85 text-xs leading-relaxed">
            El backend (variable <code className="text-red-200">ADMIN_PIN</code> en Vercel) y el
            frontend (<code className="text-red-200">VITE_ADMIN_PIN</code>) deben tener el
            <strong className="text-chalk/90"> mismo valor</strong>.
            {visitsData?.unauthorized
              ? ' Ahora mismo NO coinciden (o falta redeploy después de cambiar VITE_ADMIN_PIN).'
              : ' No hay PIN configurado en el frontend.'}
            {' '}Ingresá abajo el valor exacto de <code className="text-red-200">ADMIN_PIN</code> para ver las visitas ya mismo:
          </p>
          <form onSubmit={submitManualPin} className="flex items-center gap-2">
            <input
              type="password"
              value={manualPin}
              onChange={(e) => setManualPin(e.target.value)}
              placeholder="ADMIN_PIN del backend"
              className="flex-1 bg-void border border-white/10 rounded-lg px-3 py-2 text-sm text-chalk font-mono focus:outline-none focus:border-red-400/40"
            />
            <button type="submit" disabled={loadingVisits || !manualPin.trim()}
              className="px-4 py-2 rounded-lg bg-red-500/20 border border-red-500/40 text-red-200 text-sm font-bold hover:bg-red-500/30 disabled:opacity-50 transition-colors">
              Ver visitas
            </button>
          </form>
        </div>
      )}

      {/* Diagnóstico: error de red / server */}
      {fetchError && (
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-xs">
          <p className="text-amber-200 font-semibold flex items-center gap-1.5">
            <Warning size={12} weight="fill" /> Error al leer visitas
          </p>
          <p className="text-muted/80 font-mono mt-1">{fetchError}</p>
        </div>
      )}

      {/* Mapa mundial con burbujas por ciudad */}
      <div className="space-y-2">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-muted/70 text-[10px] uppercase tracking-widest font-semibold flex items-center gap-1.5">
            <MapTrifold size={11} weight="fill" /> Mapa de visitas por ciudad
          </p>
          <div className="flex items-center gap-2">
            {hasRealData && (
              <span className="text-emerald-400 text-[10px] font-mono flex items-center gap-1">
                <CheckCircle size={11} weight="fill" /> Datos REALES · auto-refresh 30s
              </span>
            )}
            {kvNotConfigured && (
              <span className="text-amber-300 text-[10px] font-mono flex items-center gap-1">
                <Info size={10} weight="fill" /> KV no configurado en Vercel
              </span>
            )}
            <button onClick={reloadVisits} disabled={loadingVisits}
              className="px-2.5 py-1 rounded-full bg-gold/10 border border-gold/30 text-gold text-[10px] font-bold hover:bg-gold/20 disabled:opacity-50 transition-colors flex items-center gap-1">
              <ArrowClockwise size={10} weight="bold" className={loadingVisits ? 'animate-spin' : ''} />
              {loadingVisits ? 'Cargando…' : 'Refrescar'}
            </button>
          </div>
        </div>

        {/* Banner de setup cuando el backend no está configurado — NO reemplaza el mapa */}
        {kvNotConfigured && (
          <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs leading-relaxed">
            <p className="text-amber-200 font-semibold mb-1 flex items-center gap-1.5">
              <Info size={12} weight="fill" /> Para ver visitas de TODOS los usuarios, configurá el storage (1 min)
            </p>
            <span className="text-muted/80">
              Creá DB Redis en <a href="https://console.upstash.com" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline">Upstash</a> →
              pegá <code className="text-amber-200">UPSTASH_REDIS_REST_URL</code>, <code className="text-amber-200">UPSTASH_REDIS_REST_TOKEN</code> y <code className="text-amber-200">ADMIN_PIN</code> en
              <a href="https://vercel.com/arrayagom/repelis/settings/environment-variables" target="_blank" rel="noopener noreferrer" className="text-amber-200 underline"> Vercel</a> → Redeploy.
              Mientras tanto el mapa muestra tu ubicación.
            </span>
          </div>
        )}

        {/* El mapa SIEMPRE se muestra: tu ubicación + ciudades reales si las hay */}
        <WorldMap cities={citiesForMap} height={520} focus="latam" currentLocation={myGeo} />

        <div className="flex items-center justify-between gap-3 flex-wrap">
          <p className="text-muted/50 text-[10px] leading-relaxed">
            Burbuja dorada = ciudad con visitas. Tamaño = cantidad. <strong className="text-emerald-400/80">Punto verde = vos</strong>.
            <strong> Scroll = zoom (hasta x32), drag = mover.</strong>
          </p>
          {myGeo?.city ? (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-[10px] font-mono">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Vos: <strong>{myGeo.city}, {myGeo.country}</strong>
            </div>
          ) : (
            <span className="text-muted/40 text-[10px] font-mono">Detectando tu ubicación…</span>
          )}
        </div>
      </div>

      {/* Botones a los dashboards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a href={ANALYTICS_URL} target="_blank" rel="noopener noreferrer"
          className="group p-5 rounded-2xl bg-surface border border-white/10 hover:border-sky-500/40 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-sky-500/15 flex items-center justify-center">
              <Users size={18} weight="fill" className="text-sky-300" />
            </div>
            <p className="text-chalk font-bold text-sm flex items-center gap-1.5">
              Visitas & Audiencia
              <ArrowSquareOut size={11} className="text-muted/40 group-hover:text-sky-300 transition-colors" />
            </p>
          </div>
          <p className="text-muted/70 text-xs leading-relaxed">
            Visitas, vistas únicas, países, <strong className="text-chalk/80">ciudades</strong>,
            top pages, referrers, dispositivos (mobile / desktop / tablet), navegadores y sistemas operativos.
          </p>
          <p className="text-sky-400/60 text-[10px] mt-3 font-mono break-all">
            {ANALYTICS_URL}
          </p>
        </a>

        <a href={SPEED_URL} target="_blank" rel="noopener noreferrer"
          className="group p-5 rounded-2xl bg-surface border border-white/10 hover:border-emerald-500/40 transition-all">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 flex items-center justify-center">
              <Pulse size={18} weight="fill" className="text-emerald-300" />
            </div>
            <p className="text-chalk font-bold text-sm flex items-center gap-1.5">
              Performance Real (Core Web Vitals)
              <ArrowSquareOut size={11} className="text-muted/40 group-hover:text-emerald-300 transition-colors" />
            </p>
          </div>
          <p className="text-muted/70 text-xs leading-relaxed">
            Tiempos reales que ven los usuarios — <strong className="text-chalk/80">LCP, FID, CLS, TTFB</strong> por país y dispositivo.
            Te dice si la app se ve rápida desde Argentina o si hay que optimizar para mobile.
          </p>
          <p className="text-emerald-400/60 text-[10px] mt-3 font-mono break-all">
            {SPEED_URL}
          </p>
        </a>
      </div>

      {/* Qué ves en el dashboard externo */}
      <div className="p-4 rounded-2xl bg-surface border border-white/[0.06]">
        <p className="text-muted/70 text-[10px] uppercase tracking-widest font-semibold mb-3">
          Lo que vas a encontrar en vercel.com/analytics
        </p>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-xs">
          {[
            { Icon: Users, label: 'Visitantes únicos' },
            { Icon: Globe, label: 'Países (top 10)' },
            { Icon: MapTrifold, label: 'Ciudades (top 20)' },
            { Icon: DeviceMobile, label: 'Mobile / Desktop / Tablet' },
            { Icon: ChartBar, label: 'Páginas más visitadas' },
            { Icon: ArrowSquareOut, label: 'Referrers (de dónde vienen)' },
          ].map(({ Icon, label }) => (
            <div key={label} className="flex items-center gap-2 p-2 rounded-lg bg-white/[0.02] border border-white/5">
              <Icon size={14} weight="fill" className="text-gold flex-shrink-0" />
              <span className="text-chalk/80">{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Activar la feature en Vercel */}
      <div className="p-4 rounded-2xl bg-amber-500/5 border border-amber-500/20">
        <p className="text-amber-300 text-sm font-bold mb-2 flex items-center gap-2">
          <CheckCircle size={14} weight="fill" /> Una vez: activar la feature en Vercel
        </p>
        <ol className="text-muted/80 text-xs leading-relaxed list-decimal list-inside space-y-1 marker:text-amber-400/70">
          <li>Andá a <a href={`https://vercel.com/${VERCEL_USER}/${VERCEL_PROJECT}/analytics`} target="_blank" rel="noopener noreferrer" className="text-amber-200 underline">tu proyecto en vercel.com</a></li>
          <li>Tab <strong>Analytics</strong> → click en <strong>"Enable Analytics"</strong> (gratis hasta 100k visitas/mes)</li>
          <li>Tab <strong>Speed Insights</strong> → idem (gratis hasta 10k data points/mes)</li>
          <li>Esperá 5-10 min y vas a ver los primeros datos llegar</li>
        </ol>
      </div>

      {/* Honestidad sobre embed propio */}
      <div className="p-4 rounded-2xl bg-white/[0.02] border border-white/5">
        <p className="text-muted/60 text-[10px] uppercase tracking-widest font-semibold mb-2">
          ¿Por qué los gráficos no están acá adentro?
        </p>
        <p className="text-muted text-xs leading-relaxed">
          La API de Vercel Analytics para consumir los datos desde tu propia app
          requiere <strong className="text-chalk/80">plan Pro (USD $20/mes)</strong>. En el plan
          Hobby (gratis) solo se ve desde el dashboard de Vercel. Si querés gráficos embebidos
          acá adentro tenemos 2 caminos:
        </p>
        <ul className="text-muted/70 text-xs leading-relaxed mt-2 list-disc list-inside space-y-0.5 marker:text-gold/50">
          <li>Pagar Vercel Pro (USD $20/mes) y embebemos via API oficial</li>
          <li>O armar mini-backend propio con Vercel KV (gratis) + edge function que cuenta visitas. Tiempo: 2-3 horas. Decime si querés.</li>
        </ul>
      </div>
    </div>
  )
}

// ─── Consola ──────────────────────────────────────────────────────────────
function ConsoleTab() {
  const [logs, setLogs] = useState([])

  useEffect(() => {
    const orig = { log: console.log, warn: console.warn, error: console.error }
    const capture = (level) => (...args) => {
      orig[level](...args)
      setLogs((prev) => [{ ts: Date.now(), level, msg: args.map(String).join(' ') }, ...prev].slice(0, 100))
    }
    console.log = capture('log')
    console.warn = capture('warn')
    console.error = capture('error')
    return () => { Object.assign(console, orig) }
  }, [])

  return (
    <div className="bg-[#0a0a14] border border-white/5 rounded-2xl p-4 font-mono text-xs max-h-[60vh] overflow-y-auto">
      {logs.length === 0 && <p className="text-muted/50">Esperando logs... (esta consola captura desde que abriste la pestaña)</p>}
      {logs.map((l, i) => (
        <div key={i} className={`py-1 border-b border-white/[0.02] ${
          l.level === 'error' ? 'text-red-300' : l.level === 'warn' ? 'text-amber-300' : 'text-muted'
        }`}>
          <span className="text-muted/40">{new Date(l.ts).toLocaleTimeString()}</span>
          <span className="ml-2 uppercase text-[9px]">[{l.level}]</span>
          <span className="ml-2 break-words">{l.msg}</span>
        </div>
      ))}
    </div>
  )
}
