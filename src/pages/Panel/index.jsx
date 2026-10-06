import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  ChartLineUp, Users, PlayCircle, Clock, Eye, UserPlus, ArrowClockwise, Television, FilmSlate, Heart, Funnel, Globe, UsersThree, Flag,
} from '@phosphor-icons/react'
import AreaChart from '../../components/charts/AreaChart'
import BarList from '../../components/charts/BarList'
import { useAuth } from '../../lib/auth'
import { useSEO } from '../../lib/useSEO'
import {
  fmtInt, fmtHours, fmtMinutes, fmtDelta, flagEmoji, countryName, ago, shortDay,
  PLATFORM_LABELS, DEVICE_LABELS, PAGE_LABELS,
} from '../../lib/panelFormat'

const RANGES = [[1, 'Hoy'], [7, '7 días'], [30, '30 días']]
const LIVE_EVERY_MS = 15_000
const DASH_EVERY_MS = 60_000

const getJson = async (path) => {
  try {
    const res = await fetch(path, { credentials: 'same-origin', cache: 'no-store' })
    let data = null
    try { data = await res.json() } catch { /* sin cuerpo */ }
    return { ok: res.ok, status: res.status, data }
  } catch { return { ok: false, status: 0, data: null } }
}

export default function Panel() {
  useSEO({ title: 'Panel', description: 'Panel interno', noindex: true })
  const { status, user } = useAuth()

  if (status === 'loading') {
    return <div className="min-h-screen bg-void flex items-center justify-center"><div className="w-10 h-10 rounded-full border-2 border-gold/15 border-t-gold animate-spin" /></div>
  }
  // Para cualquiera que no sea el fundador, la página "no existe" (el servidor igual rechaza los datos)
  if (!user?.root) {
    return (
      <main className="min-h-screen bg-void flex flex-col items-center justify-center gap-3 px-6 text-center">
        <p className="font-display font-extrabold text-6xl text-gold/80">404</p>
        <p className="text-muted text-sm">Esta página no existe.</p>
        <Link to="/" className="text-gold text-sm hover:underline">Volver al inicio</Link>
      </main>
    )
  }
  return <PanelBody />
}

const postJson = async (path, body) => {
  try {
    const res = await fetch(path, { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    return { ok: res.ok }
  } catch { return { ok: false } }
}

function PanelBody() {
  const [days, setDays] = useState(7)
  const [dash, setDash] = useState(null)
  const [live, setLive] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [, tick] = useState(0)
  const daysRef = useRef(days)
  daysRef.current = days

  const loadDash = useCallback(async () => {
    const r = await getJson(`/api/admin/dashboard?days=${daysRef.current}`)
    if (r.ok) { setDash(r.data); setError('') }
    else setError(r.status === 401 ? 'Tu sesión venció: volvé a ingresar.' : r.status === 503 ? 'El servicio de estadísticas no está disponible.' : 'No pudimos cargar las estadísticas.')
    setLoading(false)
  }, [])
  const loadLive = useCallback(async () => {
    const r = await getJson('/api/admin/realtime')
    if (r.ok) setLive(r.data)
  }, [])

  useEffect(() => { setLoading(true); loadDash() }, [days, loadDash])
  useEffect(() => {
    loadLive()
    const a = setInterval(() => { if (!document.hidden) loadLive() }, LIVE_EVERY_MS)
    const b = setInterval(() => { if (!document.hidden) loadDash() }, DASH_EVERY_MS)
    const c = setInterval(() => tick((n) => n + 1), 10_000)
    return () => { clearInterval(a); clearInterval(b); clearInterval(c) }
  }, [loadLive, loadDash])

  const refresh = () => { loadLive(); loadDash() }

  return (
    <motion.main initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="min-h-screen bg-void pt-24 pb-24">
      <div className="max-w-7xl mx-auto px-6 md:px-12 space-y-8">
        {/* Encabezado */}
        <header className="flex flex-wrap items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-emerald-500/15 border border-emerald-400/40 flex items-center justify-center">
            <ChartLineUp size={20} weight="bold" className="text-emerald-300" />
          </div>
          <div className="mr-auto">
            <h1 className="font-display font-extrabold text-2xl sm:text-3xl text-chalk leading-tight">Panel del fundador</h1>
            <p className="text-muted text-xs">
              Hora de Argentina · {dash ? `actualizado ${ago(dash.generatedAt)}` : 'cargando…'}
            </p>
          </div>
          <div className="flex gap-1.5" role="tablist" aria-label="Período">
            {RANGES.map(([n, label]) => (
              <button key={n} role="tab" aria-selected={days === n} onClick={() => setDays(n)}
                className={`px-3.5 py-1.5 rounded-full border text-sm font-medium transition-colors ${days === n ? 'bg-gold text-void border-gold' : 'glass border-white/10 text-muted hover:text-chalk'}`}>
                {label}
              </button>
            ))}
          </div>
          <button onClick={refresh} aria-label="Actualizar"
            className="w-9 h-9 rounded-full glass border border-white/10 flex items-center justify-center text-muted hover:text-gold transition-colors">
            <ArrowClockwise size={15} />
          </button>
        </header>

        {(dash?.demo || live?.demo) && (
          <p role="alert" className="p-4 rounded-2xl bg-red-600/20 border-2 border-red-500 text-red-100 text-sm font-bold text-center uppercase tracking-wide">
            ⚠ Datos de demostración inventados (solo desarrollo). No son tráfico real.
          </p>
        )}

        {error && <p role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/25 text-red-200 text-sm">{error}</p>}

        <LiveSection live={live} />

        {loading && !dash ? <SkeletonBlocks /> : dash && (
          <>
            <KpiGrid dash={dash} />

            <div className="grid lg:grid-cols-2 gap-5">
              <Card title="Visitantes y páginas vistas por día" Icon={Users}>
                <AreaChart data={dash.series} height={210} />
                <p className="text-muted/60 text-[11px] mt-2">Área: visitantes únicos del día · Línea: páginas vistas.</p>
              </Card>
              <Card title="Horas vistas por día" Icon={Clock}>
                <MiniBars data={dash.series} valueKey="watchHours" format={(v) => fmtHours(v)} accent="bg-emerald-400/70" />
                <p className="text-muted/60 text-[11px] mt-2">Tiempo total reproducido, medido por el servidor entre latidos.</p>
              </Card>
            </div>

            <div className="grid lg:grid-cols-2 gap-5">
              <Card title="Lo más visto por tiempo" Icon={PlayCircle}>
                <BarList accent="emerald" emptyLabel="Todavía no hay reproducciones en este período"
                  format={(m) => fmtMinutes(m)}
                  items={dash.topByTime.map((t) => ({ label: t.title, value: t.minutes, icon: t.type === 'tv' ? '📺' : '🎬', hint: `${t.plays} rep.` }))} />
                <p className="text-muted/60 text-[11px] mt-3">
                  Películas {fmtHours(dash.watchByType.movieHours)} · Series {fmtHours(dash.watchByType.tvHours)}
                </p>
              </Card>
              <Card title="Lo más reproducido (veces)" Icon={FilmSlate}>
                <BarList accent="gold" emptyLabel="Todavía no hay reproducciones en este período"
                  items={dash.topByPlays.map((t) => ({ label: t.title, value: t.plays, icon: t.type === 'tv' ? '📺' : '🎬', hint: fmtHours(t.hours) }))} />
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <Card title="Horas pico" Icon={Clock}>
                <MiniBars data={dash.hours} valueKey="value" labelKey="label" accent="bg-gold/70" compact format={(v) => `${fmtInt(v)} min activos`} />
                <p className="text-muted/60 text-[11px] mt-2">Actividad por hora del día (hora argentina).</p>
              </Card>
              <Card title="Países" Icon={Globe}>
                <BarList accent="sky" items={dash.audience.countries.map((c) => ({ label: countryName(c.label), value: c.value, icon: flagEmoji(c.label) }))} />
              </Card>
              <Card title="Dispositivos y plataformas" Icon={Television}>
                <BarList accent="purple" items={dash.audience.devices.map((d) => ({ label: DEVICE_LABELS[d.label] || d.label, value: d.value }))} />
                <div className="h-3" />
                <BarList accent="blue" items={dash.audience.platforms.map((p) => ({ label: PLATFORM_LABELS[p.label] || p.label, value: p.value }))} />
              </Card>
            </div>

            <div className="grid lg:grid-cols-3 gap-5">
              <Card title="Qué páginas visitan" Icon={Eye}>
                <BarList accent="gold" items={dash.audience.pages.map((p) => ({ label: PAGE_LABELS[p.label] || p.label, value: p.value }))} />
              </Card>
              <Card title="Miembros vs invitados" Icon={Users}>
                <SplitBar a={dash.audience.members} b={dash.audience.guests} aLabel="Con cuenta" bLabel="Sin cuenta" unit="visitantes" />
                <div className="h-4" />
                <SplitBar a={dash.audience.watchHoursMembers} b={dash.audience.watchHoursGuests} aLabel="Con cuenta" bLabel="Sin cuenta" unit="de visualización" hours />
              </Card>
              <Card title="Embudo de registro y apoyo" Icon={Funnel}>
                <Funnel_ funnel={dash.funnel} />
              </Card>
            </div>

            <AccountsSection users={dash.users} />
            <CommunitySection stats={dash.community} />
          </>
        )}

        <p className="text-muted/50 text-[11px] leading-relaxed max-w-3xl">
          Cómo leer esto: los números son <strong>indicativos</strong>. El tiempo de visualización lo calcula el servidor entre latidos de cada pestaña
          (cada 1–2 min), el id de visitante cambia todos los días (por eso "visitantes" se suma día por día) y tu propio tráfico como fundador no se cuenta.
          No se guarda IP, mail ni historial de nadie en estas estadísticas.
        </p>
      </div>
    </motion.main>
  )
}

// ─── En vivo ────────────────────────────────────────────────────────────
function LiveSection({ live }) {
  return (
    <section aria-label="En vivo" className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/10 via-transparent to-transparent border border-emerald-400/25">
      <div className="flex items-center gap-2 mb-4">
        <span className="relative flex w-2.5 h-2.5"><span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-60" /><span className="relative w-2.5 h-2.5 rounded-full bg-emerald-400" /></span>
        <h2 className="font-display font-bold text-lg text-chalk">En vivo</h2>
        <span className="text-muted text-xs ml-1">se actualiza solo cada 15 s</span>
      </div>
      {!live ? <div className="skeleton h-24 rounded-2xl" /> : (
        <div className="grid lg:grid-cols-[auto_1fr_1fr] gap-6 items-start">
          <div className="grid grid-cols-2 gap-3 min-w-[16rem]">
            <BigStat label="Conectados ahora" value={live.online} tone="text-emerald-300" />
            <BigStat label="Viendo algo" value={live.watching} tone="text-gold" />
            <BigStat label="Navegando" value={live.browsing} tone="text-sky-300" />
            <BigStat label="Con cuenta" value={live.members} sub={`${fmtInt(live.guests)} sin cuenta`} tone="text-purple-300" />
          </div>
          <div>
            <h3 className="text-muted text-[11px] font-mono uppercase tracking-wider mb-2">Viendo ahora</h3>
            <BarList accent="gold" emptyLabel="Nadie está reproduciendo en este momento"
              items={live.nowPlaying.map((t) => ({ label: t.title, value: t.viewers, icon: t.key.startsWith('tv:') ? '📺' : '🎬' }))} />
          </div>
          <div>
            <h3 className="text-muted text-[11px] font-mono uppercase tracking-wider mb-2">De dónde y con qué</h3>
            <BarList accent="sky" emptyLabel="Sin conectados"
              items={[
                ...live.byCountry.slice(0, 4).map((c) => ({ label: countryName(c.label), value: c.value, icon: flagEmoji(c.label) })),
                ...live.byPlatform.slice(0, 3).map((p) => ({ label: PLATFORM_LABELS[p.label] || p.label, value: p.value, icon: '📱' })),
              ]} />
          </div>
        </div>
      )}
    </section>
  )
}

const BigStat = ({ label, value, sub, tone = 'text-chalk' }) => (
  <div className="p-3 rounded-2xl bg-card border border-white/[0.06]">
    <p className="text-muted/70 text-[10px] uppercase tracking-widest font-semibold">{label}</p>
    <p className={`font-display font-extrabold text-3xl leading-tight ${tone}`}>{fmtInt(value)}</p>
    {sub && <p className="text-muted/60 text-[11px]">{sub}</p>}
  </div>
)

// ─── KPIs ───────────────────────────────────────────────────────────────
function KpiGrid({ dash }) {
  const t = dash.totals
  const d = dash.deltas
  const items = [
    { label: 'Visitantes', value: fmtInt(t.visitors), delta: d.visitors, Icon: Users },
    { label: 'Páginas vistas', value: fmtInt(t.pageviews), delta: d.pageviews, Icon: Eye },
    { label: 'Horas vistas', value: fmtHours(t.watchHours), delta: d.watchHours, Icon: Clock },
    { label: 'Reproducciones', value: fmtInt(t.plays), delta: d.plays, Icon: PlayCircle },
    { label: 'Por reproducción', value: fmtMinutes(t.avgWatchMinutesPerPlay), sub: 'tiempo medio mirando', Icon: PlayCircle },
    { label: 'En el sitio', value: fmtMinutes(t.avgSiteMinutesPerVisitor), sub: 'por visitante', Icon: Clock },
    { label: 'Mirando', value: fmtMinutes(t.watchMinutesPerVisitor), sub: 'por visitante', Icon: Television },
    { label: 'Registros nuevos', value: fmtInt(t.signups), delta: d.signups, Icon: UserPlus },
  ]
  return (
    <section aria-label="Resumen" className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {items.map(({ label, value, delta, sub, Icon }) => {
        const dl = delta !== undefined ? fmtDelta(delta) : null
        return (
          <div key={label} className="p-4 rounded-2xl bg-card border border-white/[0.06]">
            <p className="flex items-center gap-1.5 text-muted/70 text-[10px] uppercase tracking-widest font-semibold"><Icon size={12} /> {label}</p>
            <p className="font-display font-extrabold text-2xl text-chalk mt-1">{value}</p>
            {dl && <p className={`text-[11px] mt-0.5 font-mono ${dl.tone === 'up' ? 'text-emerald-300' : dl.tone === 'down' ? 'text-red-300' : 'text-muted/60'}`}>{dl.text}</p>}
            {sub && <p className="text-muted/60 text-[11px] mt-0.5">{sub}</p>}
          </div>
        )
      })}
    </section>
  )
}

// ─── Cuentas ────────────────────────────────────────────────────────────
function AccountsSection({ users }) {
  return (
    <section aria-label="Cuentas" className="space-y-4">
      <h2 className="font-display font-bold text-xl text-chalk flex items-center gap-2"><Heart size={18} weight="fill" className="text-gold" /> Cuentas</h2>
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {[
          ['Total', users.total], ['Últimas 24 h', users.last24h], ['Últimos 7 días', users.last7d],
          ['Con Google', users.google], ['Con mail y clave', users.withPassword], ['Supporters', users.supporters],
        ].map(([label, v]) => (
          <div key={label} className="p-3 rounded-2xl bg-card border border-white/[0.06]">
            <p className="text-muted/70 text-[10px] uppercase tracking-widest font-semibold">{label}</p>
            <p className="font-display font-extrabold text-2xl text-chalk">{fmtInt(v)}</p>
          </div>
        ))}
      </div>
      <div className="grid lg:grid-cols-2 gap-5">
        <Card title="Registros nuevos por día (30 días)" Icon={UserPlus}>
          <MiniBars data={users.newByDay} valueKey="count" format={(v) => `${v} nuevos`} accent="bg-purple-400/70" />
        </Card>
        <Card title="Últimos registros" Icon={Users}>
          {users.recent.length === 0 ? <p className="text-muted/50 text-xs py-4 text-center">Todavía no hay cuentas</p> : (
            <ul className="divide-y divide-white/5">
              {users.recent.map((u, i) => (
                <li key={i} className="flex items-center justify-between gap-3 py-2 text-sm">
                  <span className="text-chalk truncate">{u.email}{u.name ? <span className="text-muted"> · {u.name}</span> : null}</span>
                  <span className="text-muted/70 text-xs flex-shrink-0">{u.google ? 'Google' : 'Mail'} · {ago(u.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>
    </section>
  )
}

// ─── Piezas ─────────────────────────────────────────────────────────────
function Card({ title, Icon, children }) {
  return (
    <section className="p-5 rounded-2xl bg-card border border-white/[0.06]">
      <h3 className="flex items-center gap-2 text-chalk font-display font-bold text-base mb-4">{Icon && <Icon size={16} className="text-gold" />} {title}</h3>
      {children}
    </section>
  )
}

/** Barras verticales simples (una serie). */
export function MiniBars({ data = [], valueKey = 'value', labelKey = 'date', format = (v) => v, accent = 'bg-gold/70', compact = false }) {
  const max = Math.max(1e-9, ...data.map((d) => Number(d[valueKey]) || 0))
  const total = data.reduce((a, d) => a + (Number(d[valueKey]) || 0), 0)
  if (!data.length || total === 0) return <p className="text-muted/40 text-xs py-8 text-center">Sin datos en este período</p>
  return (
    <div>
      <div className="flex items-end gap-[3px] h-32" role="img" aria-label="Gráfico de barras">
        {data.map((d, i) => {
          const v = Number(d[valueKey]) || 0
          return (
            <div key={i} className="flex-1 min-w-0 flex flex-col justify-end h-full group relative" title={`${labelKey === 'date' ? shortDay(d[labelKey]) : d[labelKey]}: ${format(v)}`}>
              <div className={`${accent} rounded-t-sm group-hover:brightness-125 transition-all`} style={{ height: `${Math.max(v > 0 ? 3 : 0, (v / max) * 100)}%` }} />
            </div>
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-muted/50 font-mono mt-1.5">
        <span>{labelKey === 'date' ? shortDay(data[0][labelKey]) : String(data[0][labelKey]).slice(0, 2)}</span>
        {!compact && <span>{labelKey === 'date' ? shortDay(data[data.length - 1][labelKey]) : ''}</span>}
        {compact && <span>{String(data[data.length - 1][labelKey]).slice(0, 2)} h</span>}
      </div>
    </div>
  )
}

function SplitBar({ a, b, aLabel, bLabel, unit, hours = false }) {
  const total = a + b
  const pctA = total > 0 ? Math.round((a / total) * 100) : 0
  const show = (v) => (hours ? fmtHours(v) : fmtInt(v))
  return (
    <div>
      <div className="flex h-3 rounded-full overflow-hidden bg-white/5" role="img" aria-label={`${aLabel} ${pctA}%`}>
        <div className="bg-emerald-400/80" style={{ width: `${pctA}%` }} />
        <div className="bg-white/20 flex-1" />
      </div>
      <div className="flex justify-between text-xs mt-1.5">
        <span className="text-emerald-300">{aLabel}: <strong>{show(a)}</strong> ({pctA}%)</span>
        <span className="text-muted">{bLabel}: <strong>{show(b)}</strong></span>
      </div>
      <p className="text-muted/50 text-[11px]">{unit}</p>
    </div>
  )
}

function Funnel_({ funnel: f }) {
  const row = (label, value, hint) => (
    <div className="flex items-baseline justify-between gap-3 py-1.5">
      <span className="text-muted text-xs">{label}</span>
      <span className="text-right"><strong className="text-chalk font-mono">{value}</strong>{hint && <span className="text-muted/60 text-[11px] ml-1.5">{hint}</span>}</span>
    </div>
  )
  return (
    <div className="divide-y divide-white/5">
      {row('Vieron el aviso "creá tu cuenta"', fmtInt(f.gateShown), `${fmtInt(f.gateShownWatch)} al ver · ${fmtInt(f.gateShownList)} al guardar`)}
      {row('Se registraron desde ese aviso', fmtInt(f.signupsFromGate), f.conversionPct === null ? '' : `${f.conversionPct}% de conversión`)}
      {row('Otros registros', fmtInt(f.signupsOther))}
      {row('Ingresos (login)', fmtInt(f.logins))}
      {row('Pedidos de apoyo mostrados', fmtInt(f.donateShown))}
      {row('Tocaron "donar"', fmtInt(f.donateClicks), f.donateCtrPct === null ? '' : `${f.donateCtrPct}%`)}
    </div>
  )
}

const SkeletonBlocks = () => (
  <div className="space-y-5">
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">{Array.from({ length: 8 }).map((_, i) => <div key={i} className="skeleton h-24 rounded-2xl" />)}</div>
    <div className="skeleton h-64 rounded-2xl" />
  </div>
)

// ─── Comunidad: números y cola de moderación ────────────────────────────
function CommunitySection({ stats }) {
  const [reports, setReports] = useState(null)
  const [busy, setBusy] = useState('')

  const load = useCallback(async () => {
    const r = await getJson('/api/admin/reports')
    setReports(r.ok ? r.data.reports : [])
  }, [])
  useEffect(() => { load() }, [load])

  const decide = async (listId, decision) => {
    if (decision === 'delete' && !window.confirm('¿Borrar esta lista para siempre?')) return
    setBusy(listId)
    await postJson('/api/admin/moderate', { listId, decision })
    setBusy('')
    load()
  }

  if (!stats) return null
  const cells = [
    ['Perfiles', stats.profiles], ['Listas públicas', stats.lists], ['Listas privadas', stats.privateLists],
    ['Me gusta', stats.likes], ['Seguimientos', stats.follows], ['Ocultas', stats.hiddenLists],
  ]
  return (
    <section aria-label="Comunidad" className="space-y-4">
      <h2 className="font-display font-bold text-lg text-chalk flex items-center gap-2"><UsersThree size={18} className="text-gold" /> Comunidad</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {cells.map(([label, value]) => (
          <div key={label} className="p-4 rounded-2xl bg-card border border-white/[0.06]">
            <p className="text-muted text-xs">{label}</p>
            <p className="font-display font-extrabold text-2xl text-chalk mt-1">{fmtInt(value || 0)}</p>
          </div>
        ))}
      </div>

      <div className="p-5 rounded-2xl bg-card border border-white/[0.06]">
        <h3 className="font-display font-bold text-base text-chalk flex items-center gap-2 mb-3">
          <Flag size={16} className="text-amber-300" /> Reportes pendientes {reports?.length ? <span className="text-amber-300 font-mono text-sm">({reports.length})</span> : null}
        </h3>
        {reports === null ? <div className="skeleton h-16 rounded-xl" />
          : reports.length === 0 ? <p className="text-muted text-sm">Nada para revisar. Una lista se oculta sola a los 3 reportes de personas distintas.</p>
          : (
            <ul className="space-y-3">
              {reports.map((r) => (
                <li key={r.listId} className="p-4 rounded-xl bg-surface border border-white/[0.06] space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/lista/${r.listId}`} className="font-semibold text-chalk hover:text-gold mr-auto">{r.title}</Link>
                    <span className="text-xs text-muted font-mono">@{r.owner} · {r.itemsCount} títulos · {r.reports} reportes</span>
                    {r.hidden && <span className="px-2 py-0.5 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-200 text-[11px]">oculta</span>}
                  </div>
                  {r.description && <p className="text-muted text-xs">{r.description}</p>}
                  {r.sample.length > 0 && <p className="text-muted/70 text-xs">Incluye: {r.sample.join(', ')}</p>}
                  {r.reasons.length > 0 && <ul className="text-xs text-amber-200/90 list-disc pl-4">{r.reasons.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                  <div className="flex flex-wrap gap-2 pt-1">
                    <button disabled={busy === r.listId} onClick={() => decide(r.listId, 'dismiss')} className="px-3.5 py-1.5 rounded-full glass border border-white/10 text-chalk text-xs hover:border-emerald-400/40">Está bien (descartar)</button>
                    {!r.hidden && <button disabled={busy === r.listId} onClick={() => decide(r.listId, 'hide')} className="px-3.5 py-1.5 rounded-full glass border border-white/10 text-chalk text-xs hover:border-amber-400/40">Ocultar</button>}
                    <button disabled={busy === r.listId} onClick={() => decide(r.listId, 'delete')} className="px-3.5 py-1.5 rounded-full glass border border-white/10 text-red-300 text-xs hover:border-red-400/50">Borrar</button>
                  </div>
                </li>
              ))}
            </ul>
          )}
      </div>
    </section>
  )
}
