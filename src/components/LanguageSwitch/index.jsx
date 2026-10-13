import { getLang, setLang, tt } from '../../lib/i18n'

// Selector ES | EN. El idioma se detecta solo (navegador y país); esto permite cambiarlo a mano y queda guardado.
export default function LanguageSwitch({ className = '' }) {
  const current = getLang()
  return (
    <div role="group" aria-label={tt('Idioma')}
      className={`inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] p-0.5 text-[10px] font-bold tracking-wide ${className}`}>
      {['es', 'en'].map((l) => (
        <button key={l} type="button" onClick={() => l !== current && setLang(l)}
          aria-pressed={l === current}
          className={`px-2 py-0.5 rounded-full uppercase transition-colors ${l === current ? 'bg-gold/20 text-gold' : 'text-muted hover:text-chalk'}`}>
          {l}
        </button>
      ))}
    </div>
  )
}
