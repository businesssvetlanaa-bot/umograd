import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { DatabaseSync } from 'node:sqlite'
import { PrismaClient } from '@prisma/client'
import { DatabasePreflightError, assertDatabaseReady } from './databaseReadiness'

const REQUIRED_SCHEMA: Record<string, string[]> = {
  users: ['id', 'email', 'password'],
  children: ['id', 'parent_id', 'pin', 'direct_answer_allowed'],
  topics: ['id', 'subject', 'order'],
  sessions: ['id', 'child_id', 'completed', 'xp_earned', 'coins_earned'],
  messages: ['id', 'session_id', 'role'],
  voice_usage_events: ['id', 'session_id', 'kind'],
  subject_progress: ['id', 'child_id', 'subject'],
  topic_progress: ['id', 'subject_progress_id', 'topic_id'],
  buildings: ['id', 'child_id', 'building_type'],
  curricula: ['id', 'parent_id', 'topics'],
  child_topic_settings: ['id', 'child_id', 'curriculum_id', 'topic_key', 'enabled'],
}

function fileUrl(filePath: string): string {
  return `file:${filePath.replaceAll('\\', '/')}`
}

function hashFile(filePath: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
}

function createSchema(filePath: string, omitTable?: string): void {
  const sqlite = new DatabaseSync(filePath)
  try {
    for (const [table, columns] of Object.entries(REQUIRED_SCHEMA)) {
      if (table === omitTable) continue
      sqlite.exec(`CREATE TABLE "${table}" (${columns.map((column) => `"${column}" TEXT`).join(', ')})`)
    }
  } finally {
    sqlite.close()
  }
}

test('read-only preflight accepts the current core schema without changing the database', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umograd-ready-'))
  const databasePath = path.join(tempDir, 'ready.sqlite')
  createSchema(databasePath)
  const before = hashFile(databasePath)
  const prisma = new PrismaClient({ datasourceUrl: fileUrl(databasePath) })
  try {
    await assertDatabaseReady(prisma, databasePath)
    assert.equal(hashFile(databasePath), before)
  } finally {
    await prisma.$disconnect()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('preflight rejects a missing file without creating it', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umograd-missing-'))
  const databasePath = path.join(tempDir, 'missing.sqlite')
  const prisma = new PrismaClient({ datasourceUrl: fileUrl(databasePath) })
  try {
    await assert.rejects(() => assertDatabaseReady(prisma, databasePath), DatabasePreflightError)
    assert.equal(fs.existsSync(databasePath), false)
  } finally {
    await prisma.$disconnect()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})

test('preflight rejects a database with the wrong schema', async () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umograd-wrong-schema-'))
  const databasePath = path.join(tempDir, 'wrong.sqlite')
  createSchema(databasePath, 'child_topic_settings')
  const prisma = new PrismaClient({ datasourceUrl: fileUrl(databasePath) })
  try {
    await assert.rejects(
      () => assertDatabaseReady(prisma, databasePath),
      (error: unknown) => error instanceof DatabasePreflightError
        && error.message.includes('child_topic_settings'),
    )
  } finally {
    await prisma.$disconnect()
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
