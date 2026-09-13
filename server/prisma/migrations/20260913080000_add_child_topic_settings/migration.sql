CREATE TABLE "child_topic_settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "child_id" TEXT NOT NULL,
    "curriculum_id" TEXT NOT NULL,
    "topic_key" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "child_topic_settings_child_id_fkey" FOREIGN KEY ("child_id") REFERENCES "children" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "child_topic_settings_curriculum_id_fkey" FOREIGN KEY ("curriculum_id") REFERENCES "curricula" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "child_topic_settings_child_id_curriculum_id_topic_key_key"
ON "child_topic_settings"("child_id", "curriculum_id", "topic_key");
