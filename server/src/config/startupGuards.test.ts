import assert from 'node:assert/strict'
import crypto from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { spawnSync } from 'node:child_process'
import test from 'node:test'

const serverRoot = path.resolve(__dirname, '../..')
const localDatabase = path.join(serverRoot, 'prisma', 'dev.db')

function hashIfPresent(filePath: string): string | null {
  return fs.existsSync(filePath)
    ? crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex')
    : null
}

test('local database initializer refuses production before touching dev.db', () => {
  const before = hashIfPresent(localDatabase)
  const result = spawnSync(process.execPath, ['scripts/init-local-db.mjs'], {
    cwd: serverRoot,
    env: { ...process.env, NODE_ENV: 'production' },
    encoding: 'utf8',
  })
  assert.notEqual(result.status, 0)
  assert.match(`${result.stdout}${result.stderr}`, /local database initializer is disabled in production/iu)
  assert.equal(hashIfPresent(localDatabase), before)
})

test('seed refuses production and creates no database', () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'umograd-seed-guard-'))
  const databasePath = path.join(tempDir, 'must-not-exist.sqlite')
  try {
    const result = spawnSync(process.execPath, ['dist/data/seed.js'], {
      cwd: serverRoot,
      env: {
        ...process.env,
        NODE_ENV: 'production',
        DATABASE_URL: `file:${databasePath.replaceAll('\\', '/')}`,
      },
      encoding: 'utf8',
    })
    assert.notEqual(result.status, 0)
    assert.match(`${result.stdout}${result.stderr}`, /seed is disabled in production/iu)
    assert.equal(fs.existsSync(databasePath), false)
  } finally {
    fs.rmSync(tempDir, { recursive: true, force: true })
  }
})
