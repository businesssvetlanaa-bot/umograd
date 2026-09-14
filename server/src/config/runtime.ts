import os from 'node:os'
import path from 'node:path'

export type RuntimeEnvironment = 'development' | 'test' | 'production'

export interface RuntimeConfig {
  environment: RuntimeEnvironment
  isProduction: boolean
  port: number
  clientUrl: string | null
  databaseUrl: string
  databaseFilePath: string
  jwtSecret: string
}

export interface RuntimeValidationOptions {
  forceProduction?: boolean
  projectRoot?: string
  prismaSchemaDir?: string
  tempRoot?: string
}

export class RuntimeConfigError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'RuntimeConfigError'
  }
}

function fail(message: string): never {
  throw new RuntimeConfigError(message)
}

function isInside(candidate: string, root: string): boolean {
  const relative = path.relative(path.resolve(root), path.resolve(candidate))
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative))
}

function parsePort(raw: string | undefined): number {
  if (raw === undefined || raw.trim() === '') return 5001
  if (!/^\d+$/u.test(raw)) fail('PORT must be an integer between 1 and 65535')
  const port = Number(raw)
  if (!Number.isSafeInteger(port) || port < 1 || port > 65535) {
    fail('PORT must be an integer between 1 and 65535')
  }
  return port
}

function parseClientUrl(raw: string | undefined, isProduction: boolean): string | null {
  if (raw === undefined || raw.trim() === '') return isProduction ? null : 'http://localhost:3001'
  try {
    const url = new URL(raw)
    if (
      (url.protocol !== 'http:' && url.protocol !== 'https:')
      || url.username
      || url.password
      || url.pathname !== '/'
      || url.search
      || url.hash
      || raw.includes(',')
    ) {
      fail('CLIENT_URL must be one http(s) origin without a path, credentials, query, or fragment')
    }
    return url.origin
  } catch (error) {
    if (error instanceof RuntimeConfigError) throw error
    return fail('CLIENT_URL must be one valid http(s) origin')
  }
}

function databaseFilePath(databaseUrl: string, prismaSchemaDir: string): string {
  if (!databaseUrl.startsWith('file:')) fail('DATABASE_URL must use the current SQLite file: provider')
  const rawPath = databaseUrl.slice('file:'.length).split('?')[0]
  if (!rawPath || rawPath === ':memory:' || rawPath === ':memory:?cache=shared') {
    fail('DATABASE_URL must point to a filesystem SQLite database')
  }
  let decoded: string
  try {
    decoded = decodeURIComponent(rawPath)
  } catch {
    return fail('DATABASE_URL contains an invalid encoded file path')
  }
  return path.isAbsolute(decoded) ? path.normalize(decoded) : path.resolve(prismaSchemaDir, decoded)
}

function validateProductionSecret(secret: string): void {
  if (secret.length < 32) fail('JWT_SECRET must contain at least 32 characters in production')
  if (
    /(?:change[_ -]?me|replace[_ -]?me|your[_ -]|placeholder|example|local|development)/iu.test(secret)
    || new Set(secret).size < 10
  ) {
    fail('JWT_SECRET must be a strong non-placeholder value in production')
  }
}

export function validateRuntimeEnv(
  env: NodeJS.ProcessEnv,
  options: RuntimeValidationOptions = {},
): RuntimeConfig {
  const environment: RuntimeEnvironment = options.forceProduction || env.NODE_ENV === 'production'
    ? 'production'
    : env.NODE_ENV === 'test' ? 'test' : 'development'
  const isProduction = environment === 'production'
  const databaseUrl = env.DATABASE_URL?.trim() || ''
  const jwtSecret = env.JWT_SECRET || ''

  if (!databaseUrl) fail('DATABASE_URL is required')
  if (!jwtSecret) fail('JWT_SECRET is required')

  const projectRoot = path.resolve(options.projectRoot ?? path.join(process.cwd(), '..'))
  const prismaSchemaDir = path.resolve(options.prismaSchemaDir ?? path.join(process.cwd(), 'prisma'))
  const sqliteFile = databaseFilePath(databaseUrl, prismaSchemaDir)

  if (isProduction) {
    validateProductionSecret(jwtSecret)
    const rawPath = decodeURIComponent(databaseUrl.slice('file:'.length).split('?')[0] ?? '')
    if (!path.isAbsolute(rawPath)) fail('Production DATABASE_URL must contain an absolute SQLite file path')
    if (path.basename(sqliteFile).toLocaleLowerCase('en-US') === 'dev.db') {
      fail('Production DATABASE_URL must not point to dev.db')
    }
    const tempRoot = path.resolve(options.tempRoot ?? os.tmpdir())
    if (isInside(sqliteFile, projectRoot)) fail('Production SQLite database must be outside the application repository')
    if (isInside(sqliteFile, tempRoot)) fail('Production SQLite database must be outside the temporary directory')
    if (env.UMOGRAD_PERSISTENT_DB_CONFIRMED !== 'true') {
      fail('Set UMOGRAD_PERSISTENT_DB_CONFIRMED=true only after mounting persistent storage')
    }
  }

  return {
    environment,
    isProduction,
    port: parsePort(env.PORT),
    clientUrl: parseClientUrl(env.CLIENT_URL, isProduction),
    databaseUrl,
    databaseFilePath: sqliteFile,
    jwtSecret,
  }
}
