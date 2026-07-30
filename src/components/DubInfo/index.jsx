import { CheckCircle, SpeakerHigh, Warning } from '@phosphor-icons/react'

// Nombre + bandera del idioma original (ISO 639-1)
const LANG = {
  en: { name: 'Inglés',    flag: '🇺🇸' },
  es: { name: 'Español',   flag: '🇲🇽' },
  ja: { name: 'Japonés',   flag: '🇯🇵' },
  ko: { name: 'Coreano',   flag: '🇰🇷' },
  fr: { name: 'Francés',   flag: '🇫🇷' },
  it: { name: 'Italiano',  flag: '🇮🇹' },
  de: { name: 'Alemán',    flag: '🇩🇪' },
  pt: { name: 'Portugués', flag: '🇧🇷' },
  zh: { name: 'Chino',     flag: '🇨🇳' },
  hi: { name: 'Hindi',     flag: '🇮🇳' },
  ru: { name: 'Ruso',      flag: '🇷🇺' },
}

/**
 * Panel de audio HONESTO y PRECISO.
 *
 * No prometemos doblaje que no podemos verificar. Solo afirmamos lo que TMDB
 * sí sabe con certeza: el idioma ORIGINAL de la obra. El doblaje al español
 * depende 100% del servidor de reproducción — y lo decimos claramente.
 */
export default function DubInfo({ originalLanguage }) {
  const isSpanish = originalLanguage === 'es'
  const lang = LANG[originalLanguage] || { name: originalLanguage || 'desconocido', flag: '🌐' }

  if (isSpanish) {
    return (
      <div className="flex items-start gap-2.5 p-3 rounded-xl bg-emerald-500/8 border border-emerald-500/20 max-w-xl">
        <CheckCircle size={16} weight="fill" className="text-emerald-400 flex-shrink-0 mt-0.5" />
        <p className="text-emerald-100/90 text-xs leading-relaxed">
          <strong className="text-emerald-200">Audio original en español 🇲🇽</strong> — esta producción
          se hizo en español, así que la escuchás en tu idioma sin depender de doblaje.
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 max-w-xl">
      <SpeakerHigh size={16} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed space-y-1.5">
        <p className="text-chalk/90">
          Idioma original: <strong className="text-amber-200">{lang.flag} {lang.name}</strong>.
        </p>
        <p className="text-muted/85">
          El <strong className="text-chalk/85">doblaje al español NO está garantizado</strong> —
          depende de qué pista tenga cada servidor. Para escucharla en español:
        </p>
        <ol className="text-muted/80 list-decimal list-inside space-y-0.5 marker:text-amber-400/70">
          <li>Elegí un servidor marcado <span className="text-emerald-300 font-semibold">🇲🇽</span> (más probable que tenga latino).</li>
          <li>Dentro del player, abrí <strong className="text-amber-200">🔊 Audio</strong> o <strong className="text-amber-200">CC</strong> y elegí "Español"/"Latino".</li>
          <li>Si no aparece la opción, probá otro servidor. Si ninguno la tiene, <span className="text-muted">no está disponible doblada</span>.</li>
        </ol>
      </div>
    </div>
  )
}
