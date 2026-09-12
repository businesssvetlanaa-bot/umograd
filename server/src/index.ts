import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import path from 'path'
import fs from 'fs'

dotenv.config()

import authRoutes    from './routes/auth'
import childrenRoutes from './routes/children'
import sessionsRoutes from './routes/sessions'
import { parentRouter, curriculaRouter } from './routes/parent'

const app = express()
const PORT = process.env.PORT || 5001

app.use(cors({
  origin: process.env.CLIENT_URL || 'http://localhost:3001',
  credentials: true,
}))
app.use(express.json({ limit: '20mb' })) // 20mb для base64 фото

app.use('/api/auth',      authRoutes)
app.use('/api/children',  childrenRoutes)
app.use('/api/sessions',  sessionsRoutes)
app.use('/api/parent',    parentRouter)
app.use('/api/curricula', curriculaRouter)

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', message: 'Умоград API работает' })
})

// ── Статика клиента (production) ─────────────────────────────────────────────
const clientDist = path.join(__dirname, '../../client/dist')
if (fs.existsSync(clientDist)) {
  app.use(express.static(clientDist))
  // SPA fallback — все не-API маршруты отдают index.html
  app.get('*', (_req, res) => {
    res.sendFile(path.join(clientDist, 'index.html'))
  })
}

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`)
})
