import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'node:path'
import fs from 'node:fs'
import { PrismaClient } from '@prisma/client'
import authRoutes from './routes/auth'
import childrenRoutes from './routes/children'
import sessionsRoutes from './routes/sessions'
import { parentRouter, curriculaRouter } from './routes/parent'
import { DatabasePreflightError, assertDatabaseReady } from './services/databaseReadiness'
import { RuntimeConfigError, validateRuntimeEnv } from './config/runtime'
import { assertClientBuild, clientIndexPath } from './config/startupPreflight'

const projectRoot = path.resolve(__dirname, '../..')
const forceProduction = process.argv.includes('--production')

async function startServer(): Promise<void> {
  const config = validateRuntimeEnv(process.env, {
    forceProduction,
    projectRoot,
    prismaSchemaDir: path.join(projectRoot, 'server', 'prisma'),
  })
  if (config.isProduction) assertClientBuild(projectRoot)

  const readinessPrisma = new PrismaClient({ datasourceUrl: config.databaseUrl })
  try {
    if (config.isProduction) await assertDatabaseReady(readinessPrisma, config.databaseFilePath)
  } catch (error) {
    await readinessPrisma.$disconnect()
    throw error
  }

  const app = express()
  app.use(cors({ origin: config.clientUrl ?? false, credentials: config.clientUrl !== null }))
  app.use(express.json({ limit: '20mb' }))
  app.use('/api/auth', authRoutes)
  app.use('/api/children', childrenRoutes)
  app.use('/api/sessions', sessionsRoutes)
  app.use('/api/parent', parentRouter)
  app.use('/api/curricula', curriculaRouter)

  app.get('/api/health', (_req, res) => { res.json({ status: 'ok' }) })
  app.get('/api/ready', async (_req, res) => {
    try {
      await assertDatabaseReady(readinessPrisma, config.databaseFilePath)
      res.json({ status: 'ready' })
    } catch {
      res.status(503).json({ status: 'not_ready' })
    }
  })

  const clientIndex = clientIndexPath(projectRoot)
  if (fs.existsSync(clientIndex)) {
    app.use(express.static(path.dirname(clientIndex)))
    app.get('*', (_req, res) => { res.sendFile(clientIndex) })
  }

  const server = app.listen(config.port, () => {
    console.log(`Server running on port ${config.port} (${config.environment})`)
  })
  const shutdown = (signal: string) => {
    console.log(`Received ${signal}; shutting down`)
    server.close(() => { void readinessPrisma.$disconnect().finally(() => process.exit(0)) })
  }
  process.once('SIGTERM', () => shutdown('SIGTERM'))
  process.once('SIGINT', () => shutdown('SIGINT'))
}

void startServer().catch((error: unknown) => {
  const safeMessage = error instanceof RuntimeConfigError || error instanceof DatabasePreflightError
    ? error.message
    : error instanceof Error && error.message.startsWith('Production client build is missing')
      ? error.message
      : 'Database or startup asset validation failed'
  console.error(`Startup failed: ${safeMessage}`)
  process.exitCode = 1
})
