import fs from 'node:fs'
import path from 'node:path'
import { PrismaClient } from '@prisma/client'
import { RuntimeConfig } from './runtime'
import { assertDatabaseReady } from '../services/databaseReadiness'

export function clientIndexPath(projectRoot: string): string {
  return path.join(projectRoot, 'client', 'dist', 'index.html')
}

export function assertClientBuild(projectRoot: string): void {
  const indexPath = clientIndexPath(projectRoot)
  try {
    if (!fs.statSync(indexPath).isFile()) throw new Error('not a file')
  } catch {
    throw new Error('Production client build is missing; run npm run build before startup')
  }
}

export async function runStartupPreflight(config: RuntimeConfig, projectRoot: string): Promise<void> {
  if (config.isProduction) assertClientBuild(projectRoot)
  const prisma = new PrismaClient({ datasourceUrl: config.databaseUrl })
  try {
    await assertDatabaseReady(prisma, config.databaseFilePath)
  } finally {
    await prisma.$disconnect()
  }
}
