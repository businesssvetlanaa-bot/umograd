import fs from 'node:fs'

export interface ReadinessDatabase {
  $queryRawUnsafe<T = unknown>(query: string): Promise<T>
}

export class DatabasePreflightError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DatabasePreflightError'
  }
}

const REQUIRED_SCHEMA: Readonly<Record<string, readonly string[]>> = {
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

function quoteIdentifier(value: string): string {
  return `"${value.replaceAll('"', '""')}"`
}

export async function assertDatabaseReady(
  database: ReadinessDatabase,
  databaseFilePath: string,
): Promise<void> {
  let stat: fs.Stats
  try {
    stat = fs.statSync(databaseFilePath)
  } catch {
    throw new DatabasePreflightError('SQLite database file does not exist; startup never creates it')
  }
  if (!stat.isFile()) throw new DatabasePreflightError('SQLite database path is not a file')

  try {
    await database.$queryRawUnsafe('SELECT 1')
    const tableRows = await database.$queryRawUnsafe<Array<{ name: string }>>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    )
    const tables = new Set(tableRows.map((row) => row.name))
    for (const [table, requiredColumns] of Object.entries(REQUIRED_SCHEMA)) {
      if (!tables.has(table)) throw new DatabasePreflightError(`Database schema is missing required table ${table}`)
      const columnRows = await database.$queryRawUnsafe<Array<{ name: string }>>(
        `PRAGMA table_info(${quoteIdentifier(table)})`,
      )
      const columns = new Set(columnRows.map((row) => row.name))
      for (const column of requiredColumns) {
        if (!columns.has(column)) {
          throw new DatabasePreflightError(`Database schema is missing required column ${table}.${column}`)
        }
      }
    }
  } catch (error) {
    if (error instanceof DatabasePreflightError) throw error
    throw new DatabasePreflightError('SQLite database is unavailable or unreadable')
  }
}
