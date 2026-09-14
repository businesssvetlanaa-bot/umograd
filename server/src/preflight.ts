import 'dotenv/config'
import path from 'node:path'
import { DatabasePreflightError } from './services/databaseReadiness'
import { RuntimeConfigError, validateRuntimeEnv } from './config/runtime'
import { runStartupPreflight } from './config/startupPreflight'

const projectRoot = path.resolve(__dirname, '../..')
const forceProduction = process.argv.includes('--production')

async function main(): Promise<void> {
  const config = validateRuntimeEnv(process.env, {
    forceProduction,
    projectRoot,
    prismaSchemaDir: path.join(projectRoot, 'server', 'prisma'),
  })
  await runStartupPreflight(config, projectRoot)
  console.log(`Startup preflight passed (${config.environment}, SQLite schema ready)`)
}

void main().catch((error: unknown) => {
  const safeMessage = error instanceof RuntimeConfigError || error instanceof DatabasePreflightError
    ? error.message
    : error instanceof Error && error.message.startsWith('Production client build is missing')
      ? error.message
      : 'Database or startup asset validation failed'
  console.error(`Startup preflight failed: ${safeMessage}`)
  process.exitCode = 1
})
