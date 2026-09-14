import assert from 'node:assert/strict'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { RuntimeConfigError, validateRuntimeEnv } from './runtime'

const projectRoot = path.resolve(process.cwd(), '..')
const prismaSchemaDir = path.resolve(process.cwd(), 'prisma')
const productionDatabase = path.resolve(projectRoot, '..', 'umograd-persistent-data', 'umograd.sqlite')
const strongSecret = 'N7!vQ2#zL9@pR4$xT8&mW3*kC6-yH1_s'

function productionEnv(overrides: NodeJS.ProcessEnv = {}): NodeJS.ProcessEnv {
  return {
    NODE_ENV: 'production',
    DATABASE_URL: `file:${productionDatabase.replaceAll('\\', '/')}`,
    JWT_SECRET: strongSecret,
    UMOGRAD_PERSISTENT_DB_CONFIRMED: 'true',
    CLIENT_URL: 'https://umograd.example',
    PORT: '5001',
    ...overrides,
  }
}

function validateProduction(overrides: NodeJS.ProcessEnv = {}) {
  return validateRuntimeEnv(productionEnv(overrides), { projectRoot, prismaSchemaDir })
}

test('development accepts the documented convenient local settings', () => {
  const config = validateRuntimeEnv({
    DATABASE_URL: 'file:./dev.db',
    JWT_SECRET: 'umograd-local-development-secret',
  }, { projectRoot, prismaSchemaDir })
  assert.equal(config.environment, 'development')
  assert.equal(config.databaseUrl, 'file:./dev.db')
  assert.equal(config.port, 5001)
  assert.equal(config.clientUrl, 'http://localhost:3001')
})

test('all runtime modes fail fast when core database or auth configuration is missing', () => {
  assert.throws(() => validateRuntimeEnv({}, { projectRoot, prismaSchemaDir }), RuntimeConfigError)
  assert.throws(
    () => validateRuntimeEnv({ DATABASE_URL: 'file:./dev.db' }, { projectRoot, prismaSchemaDir }),
    RuntimeConfigError,
  )
})

test('production accepts an acknowledged absolute persistent SQLite path', () => {
  const config = validateProduction()
  assert.equal(config.isProduction, true)
  assert.equal(config.databaseFilePath, path.normalize(productionDatabase))
  assert.equal(config.clientUrl, 'https://umograd.example')
})

test('production rejects missing, weak, or placeholder secrets without echoing them', () => {
  for (const secret of ['', 'short', 'your_super_secret_jwt_key_here', 'umograd-local-development-secret']) {
    assert.throws(
      () => validateProduction({ JWT_SECRET: secret }),
      (error: unknown) => error instanceof RuntimeConfigError && !error.message.includes(secret || 'missing-secret'),
    )
  }
})

test('production rejects non-SQLite, relative, dev, repository, temp, and unconfirmed databases', () => {
  const insideRepo = path.join(projectRoot, 'data', 'prod.sqlite').replaceAll('\\', '/')
  const inTemp = path.join(os.tmpdir(), 'umograd.sqlite').replaceAll('\\', '/')
  const invalid = [
    'postgresql://db.example/umograd',
    'file:./prod.sqlite',
    `file:${path.join(projectRoot, 'server', 'prisma', 'dev.db').replaceAll('\\', '/')}`,
    `file:${insideRepo}`,
    `file:${inTemp}`,
    'file::memory:',
  ]
  for (const databaseUrl of invalid) {
    assert.throws(() => validateProduction({ DATABASE_URL: databaseUrl }), RuntimeConfigError)
  }
  assert.throws(
    () => validateProduction({ UMOGRAD_PERSISTENT_DB_CONFIRMED: 'false' }),
    RuntimeConfigError,
  )
})

test('PORT and CLIENT_URL are validated as a range and a single origin', () => {
  for (const port of ['0', '65536', '12.5', 'abc']) {
    assert.throws(() => validateProduction({ PORT: port }), RuntimeConfigError)
  }
  for (const clientUrl of ['ftp://example.com', 'https://example.com/path', 'https://a.example,https://b.example']) {
    assert.throws(() => validateProduction({ CLIENT_URL: clientUrl }), RuntimeConfigError)
  }
  assert.equal(validateProduction({ PORT: '8080', CLIENT_URL: '' }).port, 8080)
  assert.equal(validateProduction({ PORT: '8080', CLIENT_URL: '' }).clientUrl, null)
})
