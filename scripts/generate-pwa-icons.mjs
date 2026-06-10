// Genera los PNG necesarios para PWA Builder a partir del favicon.svg
// Uso: node scripts/generate-pwa-icons.mjs
import sharp from 'sharp'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')
const svgPath = path.join(root, 'public', 'favicon.svg')
const svg = fs.readFileSync(svgPath)

const SIZES = [
  { size: 192, name: 'icon-192.png' },
  { size: 512, name: 'icon-512.png' },
  { size: 192, name: 'icon-192-maskable.png', maskable: true },
  { size: 512, name: 'icon-512-maskable.png', maskable: true },
  { size: 180, name: 'apple-touch-icon.png' },
]

const generate = async () => {
  for (const { size, name, maskable } of SIZES) {
    const padding = maskable ? Math.round(size * 0.1) : 0
    const inner = size - padding * 2

    const innerPng = await sharp(svg)
      .resize(inner, inner)
      .png()
      .toBuffer()

    await sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 8, g: 8, b: 14, alpha: 1 },
      },
    })
      .composite([{ input: innerPng, top: padding, left: padding }])
      .png()
      .toFile(path.join(root, 'public', name))

    console.log(`✓ ${name} (${size}x${size}${maskable ? ' maskable' : ''})`)
  }
}

generate().catch((e) => {
  console.error(e)
  process.exit(1)
})
