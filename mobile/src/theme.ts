// Paleta idéntica a tailwind.config.js de la web.
export const colors = {
  void: '#08080E',
  deep: '#0E0E18',
  card: '#13131F',
  surface: '#1A1A2A',
  gold: '#E8A020',
  goldHi: '#F5B840',
  goldLo: '#A06A10',
  chalk: '#F0EDE8',
  muted: '#7A7488',
  dim: '#3A3650',
  emerald: '#34D399',
  red: '#F87171',
  blue: '#60A5FA',
  purple: '#C084FC',
  overlay: 'rgba(8,8,14,0.72)',
  border: 'rgba(255,255,255,0.08)',
} as const

export const radius = { sm: 8, md: 12, lg: 16, xl: 24, pill: 999 } as const

export const font = {
  display: { fontWeight: '800' as const },
  semibold: { fontWeight: '600' as const },
}
