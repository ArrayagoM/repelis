import { DeviceMobile, DownloadSimple } from '@phosphor-icons/react'
import { APK_URL } from '../../lib/apkInfo'

/**
 * Botón "Descargar APK". Variantes:
 *   - 'compact': ícono + label corta (para navbar/footer)
 *   - 'big':     CTA grande para la página de descarga
 */
export default function DownloadAPK({ variant = 'compact', className = '' }) {
  if (variant === 'big') {
    return (
      <a
        href={APK_URL}
        download
        className={`group inline-flex items-center gap-3 px-7 py-4 rounded-2xl bg-emerald-500 text-void font-bold text-base shadow-[0_8px_32px_rgba(16,185,129,0.4)] hover:bg-emerald-400 hover:scale-105 active:scale-95 transition-all duration-200 ${className}`}
      >
        <span className="w-10 h-10 rounded-full bg-void/20 flex items-center justify-center group-hover:rotate-6 transition-transform">
          <DownloadSimple size={20} weight="bold" />
        </span>
        <div className="text-left leading-tight">
          <div className="text-lg font-extrabold">Descargar APK</div>
          <div className="text-xs font-mono opacity-70">Android 5.0+ · ~6 MB</div>
        </div>
      </a>
    )
  }

  // Variant compact (navbar/footer)
  return (
    <a
      href={APK_URL}
      download
      title="Descargar APK para Android"
      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-semibold hover:bg-emerald-500/20 transition-all whitespace-nowrap ${className}`}
    >
      <DeviceMobile size={12} weight="fill" />
      APK
    </a>
  )
}
