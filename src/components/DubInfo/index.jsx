import { CheckCircle, SpeakerHigh, Warning } from '@phosphor-icons/react'
import { tt } from '../../lib/i18n'

// Nombre + bandera del idioma original (ISO 639-1)
const LANG = {
  en: { name: tt("Inglés"),    flag: '🇺🇸' },
  es: { name: tt("Español"),   flag: '🇲🇽' },
  ja: { name: tt("Japonés"),   flag: '🇯🇵' },
  ko: { name: 'Coreano',   flag: '🇰🇷' },
  fr: { name: tt("Francés"),   flag: '🇫🇷' },
  it: { name: 'Italiano',  flag: '🇮🇹' },
  de: { name: tt("Alemán"),    flag: '🇩🇪' },
  pt: { name: tt("Portugués"), flag: '🇧🇷' },
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
          <strong className="text-emerald-200">{tt("Audio original en español 🇲🇽")}</strong> {tt("— esta producción se hizo en español, así que la escuchás en tu idioma sin depender de doblaje.")}
        </p>
      </div>
    )
  }

  return (
    <div className="flex items-start gap-2.5 p-3 rounded-xl bg-amber-500/[0.07] border border-amber-500/20 max-w-xl">
      <SpeakerHigh size={16} weight="fill" className="text-amber-400 flex-shrink-0 mt-0.5" />
      <div className="text-xs leading-relaxed space-y-1.5">
        <p className="text-chalk/90">
          {tt("Idioma original:")} <strong className="text-amber-200">{lang.flag} {lang.name}</strong>.
        </p>
        <p className="text-muted/85">
          {tt("El")} <strong className="text-chalk/85">{tt("doblaje al español NO está garantizado")}</strong> {tt("— depende de qué pista tenga cada servidor. Para escucharla en español:")}
        </p>
        <ol className="text-muted/80 list-decimal list-inside space-y-0.5 marker:text-amber-400/70">
          <li>{tt("Elegí un servidor marcado")} <span className="text-emerald-300 font-semibold">🇲🇽</span> {tt("(más probable que tenga latino).")}</li>
          <li>{tt("Dentro del player, abrí")} <strong className="text-amber-200">{tt("🔊 Audio")}</strong> {tt("o")} <strong className="text-amber-200">{tt("CC")}</strong> {tt("y elegí \"Español\"/\"Latino\".")}</li>
          <li>{tt("Si no aparece la opción, probá otro servidor. Si ninguno la tiene,")} <span className="text-muted">{tt("no está disponible doblada")}</span>.</li>
        </ol>
      </div>
    </div>
  )
}
