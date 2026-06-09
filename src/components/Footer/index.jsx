import { Link } from 'react-router-dom'
import { FilmSlate, Heart, Code } from '@phosphor-icons/react'
import CafecitoButton from '../CafecitoButton'

export default function Footer({ onDonateClick }) {
  return (
    <footer className="relative z-10 bg-[#08080E] border-t border-white/[0.04] mt-20">
      <div className="max-w-7xl mx-auto px-6 md:px-12 py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="col-span-2">
            <Link to="/" className="flex items-center gap-2.5 group mb-3">
              <div className="w-8 h-8 rounded-full bg-gold flex items-center justify-center shadow-[0_0_12px_rgba(232,160,32,0.5)]">
                <FilmSlate size={16} weight="fill" className="text-void" />
              </div>
              <span className="font-display font-800 text-[1.1rem] tracking-tight text-chalk">
                Repe<span className="text-gold">lis</span>
              </span>
            </Link>
            <p className="text-muted text-xs leading-relaxed max-w-sm mb-4">
              Catálogo y reproductor agregador. Los metadatos son de TMDB,
              el video lo sirven servidores de terceros independientes.
              Repelis no aloja ningún contenido.
            </p>
            <p className="text-muted/60 text-[11px] flex items-center gap-1.5">
              <Code size={11} weight="bold" className="text-gold" />
              Hecho por <Link to="/about" className="text-gold hover:text-gold-hi font-semibold transition-colors">TinTech</Link>
              <span className="text-muted/40 mx-1">·</span>
              <Heart size={10} weight="fill" className="text-red-400/70" />
              <span>con amor</span>
            </p>
          </div>

          {/* Navegación */}
          <div>
            <p className="text-chalk/80 font-display font-semibold text-sm mb-3">Explorar</p>
            <ul className="space-y-2 text-muted text-xs">
              <li><Link to="/" className="hover:text-gold transition-colors">Inicio</Link></li>
              <li><Link to="/populares" className="hover:text-gold transition-colors">Películas</Link></li>
              <li><Link to="/series" className="hover:text-gold transition-colors">Series</Link></li>
              <li><Link to="/anime" className="hover:text-gold transition-colors">Anime</Link></li>
              <li><Link to="/kdrama" className="hover:text-gold transition-colors">K-Drama</Link></li>
              <li><Link to="/clasicos" className="hover:text-gold transition-colors">Clásicos</Link></li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <p className="text-chalk/80 font-display font-semibold text-sm mb-3">Legal</p>
            <ul className="space-y-2 text-muted text-xs">
              <li><Link to="/about"   className="hover:text-gold transition-colors">Sobre Repelis</Link></li>
              <li><Link to="/terms"   className="hover:text-gold transition-colors">Términos y condiciones</Link></li>
              <li><Link to="/privacy" className="hover:text-gold transition-colors">Política de privacidad</Link></li>
              <li><Link to="/dmca"    className="hover:text-gold transition-colors">DMCA / Reclamos</Link></li>
            </ul>

            <div className="mt-4">
              <CafecitoButton />
            </div>
          </div>
        </div>

        <div className="mt-10 pt-6 border-t border-white/[0.04] flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-muted/50 text-[11px] font-mono">
            © {new Date().getFullYear()} Repelis by TinTech · Todos los derechos sobre el contenido pertenecen a sus respectivos dueños
          </p>
          <p className="text-muted/40 text-[10px] font-mono">
            Powered by <a href="https://www.themoviedb.org/" target="_blank" rel="noopener noreferrer" className="hover:text-gold transition-colors">TMDB</a>
          </p>
        </div>
      </div>
    </footer>
  )
}
