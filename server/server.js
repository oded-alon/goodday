require('dotenv').config()
const path = require('path')
const express = require('express')
const helmet = require('helmet')
const cors = require('cors')
const rateLimit = require('express-rate-limit')

const app = express()
app.set('trust proxy', 1) // Render terminates TLS at a proxy

app.use(helmet({ contentSecurityPolicy: false }))
app.use(express.json({ limit: '2mb' }))

// Dev: Vite on :5173. Prod: only needed if the client is hosted elsewhere (set CLIENT_ORIGIN).
const origins = process.env.CLIENT_ORIGIN
  ? process.env.CLIENT_ORIGIN.split(',').map((s) => s.trim())
  : process.env.NODE_ENV !== 'production' ? ['http://localhost:5173', 'http://127.0.0.1:5173'] : null
if (origins) app.use(cors({ origin: origins }))

// Registered before everything else: the client polls this while a sleeping free
// Render instance boots, so it must stay tiny, touch no database and skip rate limits.
app.get('/api/health', (req, res) => {
  res.set('Cache-Control', 'no-store')
  res.json({ ok: true, t: Date.now() })
})

const limit = (windowMs, max) => rateLimit({ windowMs, limit: max, standardHeaders: true, legacyHeaders: false })
app.use('/api', limit(60_000, 120))

app.use('/api/auth', limit(15 * 60_000, 20), require('./api/auth'))
app.use('/api/sync', require('./api/sync'))
app.use('/api', (req, res) => res.status(404).json({ error: 'not_found' }))

const dist = path.resolve(__dirname, '../client/dist')
app.use(express.static(dist, {
  setHeaders(res, file) {
    if (file.includes(`${path.sep}assets${path.sep}`)) res.set('Cache-Control', 'public, max-age=31536000, immutable')
    else res.set('Cache-Control', 'no-cache') // index.html, sw.js and the manifest must revalidate
  },
}))
app.get('*', (req, res) => res.sendFile(path.join(dist, 'index.html')))

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err)
  res.status(500).json({ error: 'server_error' })
})

const port = process.env.PORT || 3040
app.listen(port, () => console.log('Good Day server on :' + port))
