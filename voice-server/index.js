// Punto de entrada del servicio (Railway/Docker): node index.js
import { createVoiceServer } from './server.js'

const port = Number(process.env.PORT) || 8080
const { server } = createVoiceServer({
  secret: process.env.VOICE_SECRET,
  origins: process.env.VOICE_ORIGINS || 'https://lifehigh.site,https://repelis.vercel.app',
  iceServers: process.env.ICE_SERVERS,
})
server.listen(port, '0.0.0.0', () => console.log(`[voice] escuchando en :${port}`))
process.on('SIGTERM', () => server.close(() => process.exit(0)))
