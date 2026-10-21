import type { SQLiteDatabase } from "expo-sqlite";

// Каждая миграция — одна ступень схемы. Не редактируй уже выпущенную миграцию —
// добавляй новую в конец массива. PRAGMA user_version хранит номер последней
// применённой ступени, миграции применяются последовательно от текущего значения.
const migrations: string[] = [
  `
  -- Карточка + её накопленное состояние памяти (счётчики, сложность, последний ответ).
  CREATE TABLE IF NOT EXISTS cards (
    id TEXT PRIMARY KEY NOT NULL,
    deck TEXT NOT NULL,
    front TEXT NOT NULL,
    back TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    suspended INTEGER NOT NULL DEFAULT 0,
    correct INTEGER NOT NULL DEFAULT 0,
    wrong INTEGER NOT NULL DEFAULT 0,
    bias REAL NOT NULL DEFAULT 0,
    last_at INTEGER,
    seconds REAL NOT NULL DEFAULT 12
  );
  -- Журнал ответов с прогнозом модели в момент ответа (для калибровки и пересборки).
  CREATE TABLE IF NOT EXISTS reviews (
    id TEXT PRIMARY KEY NOT NULL,
    card_id TEXT NOT NULL,
    at INTEGER NOT NULL,
    outcome TEXT NOT NULL,
    answer TEXT NOT NULL,
    confused_with TEXT,
    p REAL NOT NULL,
    ms INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS reviews_card ON reviews (card_id);
  -- Граф путаниц: вес и момент последнего изменения (вес затухает от него).
  CREATE TABLE IF NOT EXISTS edges (
    a TEXT NOT NULL,
    b TEXT NOT NULL,
    w REAL NOT NULL,
    at INTEGER NOT NULL,
    PRIMARY KEY (a, b)
  );
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY NOT NULL,
    value TEXT NOT NULL
  );
  `,
];

export async function runMigrations(db: SQLiteDatabase): Promise<void> {
  const row = await db.getFirstAsync<{ user_version: number }>("PRAGMA user_version;");
  const currentVersion = row?.user_version ?? 0;

  for (let i = currentVersion; i < migrations.length; i++) {
    await db.execAsync(migrations[i]);
    await db.execAsync(`PRAGMA user_version = ${i + 1};`);
  }
}
