import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share, Copy, Check, WhatsappLogo, TelegramLogo, TwitterLogo, FacebookLogo } from '@phosphor-icons/react'

/**
 * Botones de compartir. Funciona en mobile con Web Share API nativa.
 * En desktop muestra dropdown con WhatsApp/Telegram/X/Facebook + copiar link.
 */
export default function ShareButtons({ title, description = '' }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const url = typeof window !== 'undefined' ? window.location.href : ''
  const text = `${title}${description ? ` — ${description}` : ''}`

  const tryNativeShare = async (e) => {
    e?.preventDefault?.()
    if (navigator.share) {
      try {
        await navigator.share({ title, text, url })
        return
      } catch {} // user canceled
    }
    setOpen((v) => !v)
  }

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback antiguo
      const ta = document.createElement('textarea')
      ta.value = url
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); setCopied(true); setTimeout(() => setCopied(false), 2000) } catch {}
      document.body.removeChild(ta)
    }
  }

  const SHARE_LINKS = [
    {
      id: 'whatsapp',
      label: 'WhatsApp',
      Icon: WhatsappLogo,
      color: 'hover:text-green-400 hover:border-green-400/30',
      href: `https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`,
    },
    {
      id: 'telegram',
      label: 'Telegram',
      Icon: TelegramLogo,
      color: 'hover:text-sky-400 hover:border-sky-400/30',
      href: `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(text)}`,
    },
    {
      id: 'x',
      label: 'X / Twitter',
      Icon: TwitterLogo,
      color: 'hover:text-chalk hover:border-white/30',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`,
    },
    {
      id: 'facebook',
      label: 'Facebook',
      Icon: FacebookLogo,
      color: 'hover:text-blue-400 hover:border-blue-400/30',
      href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
    },
  ]

  return (
    <div className="relative inline-block">
      <button
        onClick={tryNativeShare}
        className="flex items-center gap-2 px-4 py-2.5 rounded-full glass border border-white/10 text-muted text-sm hover:text-gold hover:border-gold/30 transition-all duration-200"
      >
        <Share size={14} weight="bold" />
        Compartir
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* backdrop para cerrar al clickear afuera */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

            <motion.div
              initial={{ opacity: 0, y: -8, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
              className="absolute left-0 top-full mt-2 z-50 w-60 p-2 rounded-2xl bg-[#0E0E18] border border-white/10 shadow-[0_24px_60px_rgba(0,0,0,0.6)]"
            >
              {SHARE_LINKS.map(({ id, label, Icon, color, href }) => (
                <a
                  key={id}
                  href={href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted text-sm border border-transparent transition-all ${color}`}
                >
                  <Icon size={16} weight="fill" />
                  {label}
                </a>
              ))}

              <button
                onClick={() => { copyToClipboard(); }}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-muted text-sm border-t border-white/[0.04] hover:text-gold transition-colors"
              >
                {copied ? <Check size={16} weight="bold" className="text-emerald-400" /> : <Copy size={16} weight="bold" />}
                {copied ? '¡Copiado!' : 'Copiar enlace'}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
