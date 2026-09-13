import { DatabaseSync } from 'node:sqlite'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
const dbPath = path.join(scriptDir, '..', 'prisma', 'dev.db')
const db = new DatabaseSync(dbPath)

db.exec(`
  PRAGMA foreign_keys = ON;

  CREATE TABLE IF NOT EXISTS "users" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "users_email_key" ON "users"("email");

  CREATE TABLE IF NOT EXISTS "children" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 4,
    "avatar_type" TEXT NOT NULL DEFAULT 'explorer',
    "avatar_color" TEXT NOT NULL DEFAULT 'blue',
    "pin" TEXT,
    "direct_answer_allowed" BOOLEAN NOT NULL DEFAULT false,
    "xp" INTEGER NOT NULL DEFAULT 0,
    "level" INTEGER NOT NULL DEFAULT 1,
    "streak_days" INTEGER NOT NULL DEFAULT 0,
    "coins" INTEGER NOT NULL DEFAULT 50,
    "last_active" DATETIME,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "children_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users" ("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "topics" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "keywords" JSONB NOT NULL,
    "rules" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 4,
    "order" INTEGER NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "topics_subject_order_key" ON "topics"("subject", "order");

  CREATE TABLE IF NOT EXISTS "sessions" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "topic_id" TEXT,
    "task_text" TEXT,
    "image_url" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "ended_at" DATETIME,
    "completed" BOOLEAN NOT NULL DEFAULT false,
    "xp_earned" INTEGER NOT NULL DEFAULT 0,
    "coins_earned" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "sessions_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE,
    CONSTRAINT "sessions_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON DELETE SET NULL
  );

  CREATE TABLE IF NOT EXISTS "messages" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "messages_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "voice_usage_events" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "session_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "characters" INTEGER NOT NULL DEFAULT 0,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "voice_usage_events_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "sessions" ("id") ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS "voice_usage_events_session_id_created_at_idx" ON "voice_usage_events"("session_id", "created_at");

  CREATE TABLE IF NOT EXISTS "subject_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "sessions_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "subject_progress_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "subject_progress_child_id_subject_key" ON "subject_progress"("child_id", "subject");

  CREATE TABLE IF NOT EXISTS "topic_progress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "subject_progress_id" TEXT NOT NULL,
    "topic_id" TEXT NOT NULL,
    "mastery_level" INTEGER NOT NULL DEFAULT 0,
    "sessions_count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "topic_progress_subject_progress_id_fkey" FOREIGN KEY ("subject_progress_id") REFERENCES "subject_progress" ("id") ON DELETE CASCADE,
    CONSTRAINT "topic_progress_topic_id_fkey" FOREIGN KEY ("topic_id") REFERENCES "topics" ("id") ON DELETE RESTRICT
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "topic_progress_subject_progress_id_topic_id_key" ON "topic_progress"("subject_progress_id", "topic_id");

  CREATE TABLE IF NOT EXISTS "buildings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "building_type" TEXT NOT NULL,
    "placed" BOOLEAN NOT NULL DEFAULT false,
    "position_x" REAL,
    "position_y" REAL,
    "purchased_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "buildings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "curricula" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "parent_id" TEXT,
    "name" TEXT NOT NULL,
    "grade" INTEGER NOT NULL DEFAULT 4,
    "subject" TEXT NOT NULL,
    "is_system" BOOLEAN NOT NULL DEFAULT false,
    "topics" JSONB NOT NULL DEFAULT '[]',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "curricula_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "users" ("id") ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS "child_topic_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "topic_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "child_topic_settings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE,
    CONSTRAINT "child_topic_settings_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula" ("id") ON DELETE CASCADE
  );
  CREATE UNIQUE INDEX IF NOT EXISTS "child_topic_settings_child_id_curriculum_id_topic_key_key"
    ON "child_topic_settings"("child_id", "curriculum_id", "topic_key");
`)

const childColumns = db.prepare('PRAGMA table_info("children")').all()
if (!childColumns.some((column) => column.name === 'direct_answer_allowed')) {
  db.exec('ALTER TABLE "children" ADD COLUMN "direct_answer_allowed" BOOLEAN NOT NULL DEFAULT false')
}
db.close()
console.log(`Локальная база Умограда готова: ${dbPath}`)
