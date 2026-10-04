// Genera los íconos/splash/banners de la app a partir del logo de la web (triángulo dorado sobre fondo void).
// Uso: node scripts/generate-assets.mjs  (usa `sharp` del package.json raíz del repo)
import sharp from 'sharp'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const out = (name) => path.join(__dirname, '..', 'assets', name)

const VOID = '#08080E'
const GOLD = '#E8A020'

// Triángulo "play" del logo (viewBox 32 → centrado ópticamente) escalado a `scale` del lienzo.
const triangle = (size, scale, fill) => {
  const unit = (size * scale) / 15            // el triángulo original mide 15 de ancho
  const w = 15 * unit
  const h = 16 * unit
  const x = size / 2 - 0.4 * w                 // centro óptico (entre centroide y caja)
  const y = (size - h) / 2
  const pts = [[x, y], [x + w, y + h / 2], [x, y + h]].map((p) => p.join(',')).join(' ')
  return `<polygon points="${pts}" fill="${fill}"/>`
}

const svg = (size, body) =>
  Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${body}</svg>`)

const png = (buf, file, resize) =>
  sharp(buf).resize(resize, resize).png().toFile(out(file)).then(() => console.log(`✓ ${file} (${resize}x${resize})`))

const tvBanner = async () => {
  const w = 320
  const h = 180
  const body = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${VOID}"/>
    <rect x="0" y="${h - 6}" width="${w}" height="6" fill="${GOLD}"/>
    <g transform="translate(${w / 2 - 29}, ${h / 2 - 42}) scale(3)">
      <polygon points="0,0 24,14 0,28" fill="${GOLD}"/>
    </g>
  </svg>`
  await sharp(Buffer.from(body)).png().toFile(out('tv-banner.png'))
  console.log(`✓ tv-banner.png (${w}x${h})`)
}

const main = async () => {
  // Ícono iOS / general (sin transparencia, full-bleed)
  await png(svg(1024, `<rect width="1024" height="1024" fill="${VOID}"/>${triangle(1024, 0.5, GOLD)}`), 'icon.png', 1024)
  // Android adaptive: capas separadas (zona segura = 66% central)
  await png(svg(1024, `<rect width="1024" height="1024" fill="${VOID}"/>`), 'android-icon-background.png', 1024)
  await png(svg(1024, triangle(1024, 0.34, GOLD)), 'android-icon-foreground.png', 1024)
  await png(svg(1024, triangle(1024, 0.34, '#FFFFFF')), 'android-icon-monochrome.png', 1024)
  // Splash + favicon web
  await png(svg(1024, triangle(1024, 0.5, GOLD)), 'splash-icon.png', 1024)
  await png(svg(256, `<rect width="256" height="256" rx="56" fill="${VOID}"/>${triangle(256, 0.5, GOLD)}`), 'favicon.png', 48)
  await tvBanner()
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
