import { memo, useState } from 'react'
import {
  ComposableMap, Geographies, Geography, Marker, ZoomableGroup,
} from 'react-simple-maps'
import { scaleSqrt } from 'd3-scale'
import { motion } from 'framer-motion'
import { Globe, MapPin } from '@phosphor-icons/react'

// TopoJSON liviano del mundo (110m de Natural Earth, ~100KB)
const GEO_URL = 'https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json'

/**
 * Mapa mundial con burbujas por ciudad.
 *
 * props.cities: Array<{ name: string, country: string, lat: number, lng: number, visits: number }>
 *
 * Cuando tengamos data real (Vercel Pro API o backend KV) pasamos el array
 * real. Mientras tanto se llama con MOCK_LATAM_CITIES de abajo.
 */
function WorldMap({ cities = [], height = 460, focus = 'latam', currentLocation = null }) {
  const [hovered, setHovered] = useState(null)

  const maxVisits = Math.max(1, ...cities.map((c) => c.visits))
  const radiusScale = scaleSqrt().domain([0, maxVisits]).range([4, 22])

  // Centro y zoom inicial según foco
  const centerLatam = [-65, -25]   // baja más a Argentina
  const centerWorld = [0, 20]
  const center = focus === 'latam' ? centerLatam : centerWorld
  const zoom    = focus === 'latam' ? 4 : 1   // 4 = se distingue Buenos Aires vs Córdoba

  return (
    <div className="relative rounded-2xl overflow-hidden bg-[#08080E] border border-white/10" style={{ height }}>
      <ComposableMap
        projection="geoMercator"
        projectionConfig={{ scale: 130 }}
        style={{ width: '100%', height: '100%', background: 'radial-gradient(circle at 50% 30%, #0E0E18 0%, #08080E 70%)' }}
      >
        <ZoomableGroup center={center} zoom={zoom} maxZoom={32} minZoom={1}>
          <Geographies geography={GEO_URL}>
            {({ geographies }) =>
              geographies.map((geo) => (
                <Geography
                  key={geo.rsmKey}
                  geography={geo}
                  fill="#1A1A2A"
                  stroke="#2A2A3E"
                  strokeWidth={0.4}
                  style={{
                    default: { outline: 'none' },
                    hover:   { fill: '#252535', outline: 'none' },
                    pressed: { outline: 'none' },
                  }}
                />
              ))
            }
          </Geographies>

          {/* Marker especial: tu ubicación actual (emerald, pulse) */}
          {currentLocation?.lat != null && currentLocation?.lng != null && (
            <Marker coordinates={[currentLocation.lng, currentLocation.lat]}>
              <circle r={18} fill="#10B981" fillOpacity={0.15}>
                <animate attributeName="r" from="14" to="26" dur="1.6s" repeatCount="indefinite" />
                <animate attributeName="fill-opacity" from="0.35" to="0" dur="1.6s" repeatCount="indefinite" />
              </circle>
              <circle r={7} fill="#10B981" stroke="#fff" strokeWidth={1.5} />
              <text
                textAnchor="middle"
                y={-14}
                style={{
                  fontFamily: 'JetBrains Mono, monospace',
                  fontSize: 10,
                  fontWeight: 700,
                  fill: '#10B981',
                  pointerEvents: 'none',
                  paintOrder: 'stroke',
                  stroke: '#08080E',
                  strokeWidth: 3,
                  strokeLinejoin: 'round',
                }}
              >
                Vos · {currentLocation.city || currentLocation.country}
              </text>
            </Marker>
          )}

          {cities.map((c) => {
            const r = radiusScale(c.visits)
            const isHovered = hovered === c.name
            return (
              <Marker key={c.name} coordinates={[c.lng, c.lat]}
                onMouseEnter={() => setHovered(c.name)}
                onMouseLeave={() => setHovered(null)}
                style={{ cursor: 'pointer' }}>
                {/* Halo animado */}
                <circle
                  r={r * 1.6}
                  fill="#E8A020"
                  fillOpacity={isHovered ? 0.25 : 0.12}
                  style={{ transition: 'fill-opacity 0.2s' }}
                />
                {/* Burbuja principal */}
                <circle
                  r={r}
                  fill="#E8A020"
                  fillOpacity={isHovered ? 1 : 0.85}
                  stroke="#FFD877"
                  strokeWidth={isHovered ? 1.5 : 0.5}
                  style={{ transition: 'all 0.2s' }}
                />
                {/* Label SIEMPRE visible para identificar cada ciudad */}
                <text
                  textAnchor="middle"
                  y={-r - 5}
                  style={{
                    fontFamily: 'JetBrains Mono, monospace',
                    fontSize: 9,
                    fontWeight: 700,
                    fill: isHovered ? '#FFD877' : '#F0EDE8',
                    pointerEvents: 'none',
                    paintOrder: 'stroke',
                    stroke: '#08080E',
                    strokeWidth: 3,
                    strokeLinejoin: 'round',
                    transition: 'fill 0.2s',
                  }}
                >
                  {c.name}{isHovered ? ` · ${c.visits.toLocaleString('es-AR')}` : ''}
                </text>
              </Marker>
            )
          })}
        </ZoomableGroup>
      </ComposableMap>

      {/* Leyenda inferior */}
      <div className="absolute bottom-3 left-3 right-3 flex items-end justify-between gap-3 pointer-events-none">
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-void/80 backdrop-blur-sm border border-white/10 text-[10px] text-muted font-mono">
          <Globe size={11} weight="fill" className="text-gold" />
          {cities.length} ciudades · {cities.reduce((a, c) => a + c.visits, 0).toLocaleString('es-AR')} visitas
        </div>
        <div className="flex items-center gap-2 text-[10px] text-muted/60 font-mono">
          <span>Tamaño burbuja = visitas</span>
        </div>
      </div>

      {/* Hint zoom */}
      <div className="absolute top-3 right-3 pointer-events-none text-muted/40 text-[10px] font-mono">
        Scroll / pinch para zoom
      </div>
    </div>
  )
}

export default memo(WorldMap)

// ─── Mock data realista (LATAM-first) ────────────────────────────────────
// Usar mientras no haya backend con datos reales. Coords lat/lng aprox.
export const MOCK_LATAM_CITIES = [
  // Argentina
  { name: 'Buenos Aires', country: 'AR', lat: -34.6037, lng: -58.3816, visits: 1247 },
  { name: 'Córdoba',      country: 'AR', lat: -31.4201, lng: -64.1888, visits: 384 },
  { name: 'Rosario',      country: 'AR', lat: -32.9442, lng: -60.6505, visits: 256 },
  { name: 'Mendoza',      country: 'AR', lat: -32.8895, lng: -68.8458, visits: 198 },
  // México
  { name: 'CDMX',         country: 'MX', lat:  19.4326, lng: -99.1332, visits: 982 },
  { name: 'Guadalajara',  country: 'MX', lat:  20.6597, lng: -103.3496, visits: 421 },
  { name: 'Monterrey',    country: 'MX', lat:  25.6866, lng: -100.3161, visits: 318 },
  // Colombia
  { name: 'Bogotá',       country: 'CO', lat:   4.7110, lng: -74.0721, visits: 547 },
  { name: 'Medellín',     country: 'CO', lat:   6.2442, lng: -75.5812, visits: 312 },
  // Chile
  { name: 'Santiago',     country: 'CL', lat: -33.4489, lng: -70.6693, visits: 489 },
  // Perú
  { name: 'Lima',         country: 'PE', lat: -12.0464, lng: -77.0428, visits: 376 },
  // Venezuela
  { name: 'Caracas',      country: 'VE', lat:  10.4806, lng: -66.9036, visits: 142 },
  // Uruguay
  { name: 'Montevideo',   country: 'UY', lat: -34.9011, lng: -56.1645, visits: 118 },
  // Ecuador
  { name: 'Quito',        country: 'EC', lat:  -0.1807, lng: -78.4678, visits: 87 },
  // España
  { name: 'Madrid',       country: 'ES', lat:  40.4168, lng:  -3.7038, visits: 234 },
  { name: 'Barcelona',    country: 'ES', lat:  41.3851, lng:   2.1734, visits: 167 },
  // USA (latinos en USA)
  { name: 'Miami',        country: 'US', lat:  25.7617, lng: -80.1918, visits: 196 },
  { name: 'Los Angeles',  country: 'US', lat:  34.0522, lng: -118.2437, visits: 174 },
]
