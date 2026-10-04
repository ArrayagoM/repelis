// Sintetiza el sonido de inicio de Life High (original, sin samples ni derechos de autor).
// Whoosh ascendente → golpe grave → acorde brillante con eco. Escribe el mismo WAV para la web y la app móvil.
// Uso: node scripts/generate-intro-sound.mjs
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(__dirname, '..')

const SR = 24000
const DURATION = 2.7
const HIT = 1.0 // segundo del golpe
const N = Math.floor(SR * DURATION)
const buf = new Float32Array(N)

const TAU = Math.PI * 2
const exp = (t, tau) => Math.exp(-t / tau)

// ruido determinista (mismo resultado en cada corrida)
let seed = 1337
const rand = () => {
  seed = (seed * 1664525 + 1013904223) >>> 0
  return seed / 0xffffffff * 2 - 1
}

// 1) Whoosh: barrido senoidal + ruido que "se abre"
let phase = 0
let lp = 0
for (let i = 0; i < Math.floor(SR * HIT); i++) {
  const t = i / SR
  const p = t / HIT
  const f = 110 * Math.pow(7, p * p) // 110 → 770 Hz, acelera hacia el golpe
  phase += (TAU * f) / SR
  const amp = Math.pow(p, 2.2) * 0.32
  const cutoff = 0.02 + 0.5 * p * p
  lp += cutoff * (rand() - lp)
  buf[i] += Math.sin(phase) * amp * 0.7 + lp * amp * 1.4
}

// 2) Golpe grave: sub + ruido corto
for (let i = Math.floor(SR * HIT); i < N; i++) {
  const t = i / SR - HIT
  const sub = Math.sin(TAU * (55 + 40 * exp(t, 0.08)) * t) * exp(t, 0.55) * 0.85
  const thump = rand() * exp(t, 0.035) * 0.35
  buf[i] += sub + thump
}

// 3) Acorde brillante (La mayor abierto) + campanita
const chord = [110, 164.81, 220, 277.18, 329.63, 440, 554.37]
for (let i = Math.floor(SR * HIT); i < N; i++) {
  const t = i / SR - HIT
  const attack = Math.min(1, t / 0.02)
  let s = 0
  for (const [k, f] of chord.entries()) {
    const detune = 1 + (k % 2 ? 0.0012 : -0.0012)
    s += Math.sin(TAU * f * detune * t) * (0.16 / (1 + k * 0.25))
    s += Math.sin(TAU * f * 2 * t) * (0.04 / (1 + k * 0.4))
  }
  const pad = s * attack * exp(t, 1.0)
  const bell =
    (Math.sin(TAU * 880 * t) * 0.16 + Math.sin(TAU * 1318.5 * t + 0.4) * 0.1 + Math.sin(TAU * 2217 * t) * 0.05) *
    attack * exp(t, 0.55)
  buf[i] += pad + bell
}

// 4) Eco suave para dar espacio
const DELAY = Math.floor(SR * 0.19)
for (let i = DELAY; i < N; i++) buf[i] += buf[i - DELAY] * 0.32

// 5) Normalizar a -3 dBFS y fade-out final
let peak = 0
for (let i = 0; i < N; i++) peak = Math.max(peak, Math.abs(buf[i]))
const gain = 0.7 / peak
const FADE = Math.floor(SR * 0.35)
for (let i = 0; i < N; i++) {
  const fade = i > N - FADE ? (N - i) / FADE : 1
  buf[i] *= gain * fade
}

// WAV PCM 16 bits mono
const data = Buffer.alloc(N * 2)
for (let i = 0; i < N; i++) data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, buf[i])) * 32767), i * 2)
const header = Buffer.alloc(44)
header.write('RIFF', 0)
header.writeUInt32LE(36 + data.length, 4)
header.write('WAVEfmt ', 8)
header.writeUInt32LE(16, 16)
header.writeUInt16LE(1, 20)
header.writeUInt16LE(1, 22)
header.writeUInt32LE(SR, 24)
header.writeUInt32LE(SR * 2, 28)
header.writeUInt16LE(2, 32)
header.writeUInt16LE(16, 34)
header.write('data', 36)
header.writeUInt32LE(data.length, 40)
const wav = Buffer.concat([header, data])

for (const out of ['public/sounds/intro.wav', 'mobile/assets/sounds/intro.wav']) {
  const file = path.join(root, out)
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, wav)
  console.log(`✓ ${out} (${(wav.length / 1024).toFixed(0)} KB, ${DURATION}s)`)
}

// Envolvente RMS por tramos (diagnóstico rápido: debe subir, golpear, y decaer)
const bins = 9
const per = Math.floor(N / bins)
const env = []
for (let b = 0; b < bins; b++) {
  let sum = 0
  for (let i = b * per; i < (b + 1) * per; i++) sum += buf[i] * buf[i]
  env.push((Math.sqrt(sum / per)).toFixed(2))
}
console.log('RMS por tramo:', env.join(' '))
