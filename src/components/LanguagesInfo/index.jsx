import { Globe, Translate, Info } from '@phosphor-icons/react'
import { tt } from '../../lib/i18n'

// Mapeo ISO 639-1 → nombre en español (los más comunes)
const LANG_NAMES = {
  en: tt("Inglés"), es: tt("Español"), fr: tt("Francés"), it: 'Italiano',
  de: tt("Alemán"), pt: tt("Portugués"), ja: tt("Japonés"), ko: 'Coreano',
  zh: 'Chino', ru: 'Ruso', ar: tt("Árabe"), hi: 'Hindi',
  tr: 'Turco', pl: 'Polaco', nl: tt("Holandés"), sv: 'Sueco',
  th: tt("Tailandés"), vi: 'Vietnamita', he: 'Hebreo', uk: 'Ucraniano',
  cs: 'Checo', el: 'Griego', no: 'Noruego', fi: tt("Finlandés"),
  da: tt("Danés"), hu: tt("Húngaro"), ro: 'Rumano', bg: tt("Búlgaro"),
}

const flag = (iso) => {
  // Mapeo simple ISO 639-1 → emoji de bandera del país más representativo.
  const flags = {
    en: '🇺🇸', es: '🇪🇸', fr: '🇫🇷', it: '🇮🇹', de: '🇩🇪', pt: '🇵🇹',
    ja: '🇯🇵', ko: '🇰🇷', zh: '🇨🇳', ru: '🇷🇺', ar: '🇸🇦', hi: '🇮🇳',
    tr: '🇹🇷', pl: '🇵🇱', nl: '🇳🇱', sv: '🇸🇪', th: '🇹🇭', vi: '🇻🇳',
    he: '🇮🇱', uk: '🇺🇦', cs: '🇨🇿', el: '🇬🇷', no: '🇳🇴', fi: '🇫🇮',
    da: '🇩🇰', hu: '🇭🇺', ro: '🇷🇴', bg: '🇧🇬',
  }
  return flags[iso] || '🌐'
}

const label = (iso, fallback) =>
  LANG_NAMES[iso] || fallback || iso?.toUpperCase() || 'Desconocido'

/**
 * Muestra los idiomas disponibles según TMDB.
 *
 * Honestidad obligada: TMDB indica idiomas hablados de la obra original,
 * NO doblajes ni subtítulos del servidor de streaming. La nota al pie lo aclara.
 */
export default function LanguagesInfo({ originalLanguage, spokenLanguages = [] }) {
  const allLangs = []
  if (originalLanguage) allLangs.push({ iso: originalLanguage, original: true, name: null })
  for (const l of spokenLanguages) {
    if (!allLangs.some((x) => x.iso === l.iso_639_1)) {
      allLangs.push({ iso: l.iso_639_1, original: false, name: l.name || l.english_name })
    }
  }
  if (allLangs.length === 0) return null

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 text-muted/70 text-xs uppercase tracking-widest font-semibold">
        <Translate size={12} weight="bold" /> {tt("Idiomas")}
      </div>
      <div className="flex flex-wrap gap-2">
        {allLangs.map(({ iso, original, name }) => (
          <span
            key={iso}
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[11px] font-mono
              ${original
                ? 'bg-gold/10 border-gold/30 text-gold'
                : 'bg-white/[0.03] border-white/10 text-muted'
              }`}
            title={original ? tt("Idioma original") : tt("Hablado en la obra")}
          >
            <span className="text-sm leading-none">{flag(iso)}</span>
            <span>{label(iso, name)}</span>
            {original && <span className="text-[9px] opacity-70">{tt("orig.")}</span>}
          </span>
        ))}
      </div>

      <p className="text-muted/45 text-[10px] leading-relaxed flex items-start gap-1.5 max-w-[58ch]">
        <Info size={10} weight="fill" className="text-gold/60 flex-shrink-0 mt-0.5" />
        <span>
          {tt("Idiomas de la obra según TMDB. El")} <strong className="text-chalk/70">{tt("doblaje y los subtítulos")}</strong> {tt("que llegan al reproductor dependen del servidor — buscá el botón")} <strong className="text-gold/80">{tt("🔊 Audio / CC")}</strong> {tt("dentro del player y, si no está, probá otro servidor (1-12).")}
        </span>
      </p>
    </div>
  )
}
