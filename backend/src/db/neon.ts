import fs from "node:fs";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";
import { config } from "../config.js";

const dbFile = config.sqlitePath || path.resolve(process.cwd(), "data", "app.db");
const dbDir = path.dirname(dbFile);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const sqlite = new DatabaseSync(dbFile);
sqlite.exec("PRAGMA journal_mode = WAL;");
sqlite.exec("PRAGMA foreign_keys = ON;");

export const pool = sqlite as unknown as object;

const toSqliteValue = (value: unknown): unknown => {
  if (typeof value === "boolean") return value ? 1 : 0;
  if (Array.isArray(value)) return JSON.stringify(value);
  if (value && typeof value === "object" && !(value instanceof Date) && !(Buffer.isBuffer(value))) {
    return JSON.stringify(value);
  }
  return value;
};

const normalizeSql = (input: string) => {
  let sql = String(input || "").trim();
  // Strip PostgreSQL casts, including array casts like ::text[]
  sql = sql.replace(/::[a-zA-Z_][a-zA-Z0-9_]*(\[\])?/g, "");
  sql = sql.replace(/\bILIKE\b/g, "LIKE");
  sql = sql.replace(/\bNOW\(\)/g, "CURRENT_TIMESTAMP");
  sql = sql.replace(/\bTRUE\b/g, "1").replace(/\bFALSE\b/g, "0");
  sql = sql.replace(/\bGREATEST\s*\(/gi, "MAX(");
  sql = sql.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s*'(\d+)\s*hours?'/gi, "datetime('now','+$1 hours')");
  sql = sql.replace(/CURRENT_TIMESTAMP\s*\+\s*INTERVAL\s*'(\d+)\s*days?'/gi, "datetime('now','+$1 days')");
  // Safety: in case any array type token survives casting transforms.
  sql = sql.replace(/\b([a-zA-Z_][a-zA-Z0-9_]*)\[\]/g, "$1");
  sql = sql.replace(/\$\d+/g, "?");
  // PostgreSQL-specific unnest on tags is not supported in local SQLite.
  sql = sql.replace(/OR EXISTS\s*\(SELECT 1 FROM unnest\(p\.tags\) t WHERE t LIKE \?\)/gi, "");
  return sql;
};

const decodeRow = <T = unknown>(row: Record<string, unknown>): T => {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row || {})) {
    if (typeof v === "string") {
      const trimmed = v.trim();
      if ((trimmed.startsWith("[") && trimmed.endsWith("]")) || (trimmed.startsWith("{") && trimmed.endsWith("}"))) {
        try {
          out[k] = JSON.parse(trimmed);
          continue;
        } catch {
          // keep string
        }
      }
    }
    out[k] = v;
  }
  return out as T;
};

export const queryNeon = async <T = unknown>(query: string, params: unknown[] = []): Promise<T[]> => {
  const sql = normalizeSql(query);
  const args = params.map(toSqliteValue) as any[];
  const stmt = sqlite.prepare(sql);
  const lower = sql.toLowerCase();
  const returnsRows = lower.startsWith("select") || lower.includes(" returning ");
  if (returnsRows) {
    const rows = stmt.all(...args) as Record<string, unknown>[];
    return rows.map((r) => decodeRow<T>(r));
  }
  stmt.run(...args);
  return [];
};

export const ensureNeonSchema = async () => {
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS ai_cache_entries (
      cache_key TEXT PRIMARY KEY,
      function_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS ai_function_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      function_name TEXT NOT NULL,
      cache_key TEXT,
      request_body TEXT,
      response_body TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      target_year INTEGER,
      optional_subject TEXT,
      study_hours_per_day INTEGER,
      language TEXT DEFAULT 'English',
      profile_photo_url TEXT,
      mentor_personality TEXT DEFAULT 'friendly',
      current_streak INTEGER NOT NULL DEFAULT 0,
      total_xp INTEGER NOT NULL DEFAULT 0,
      level INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      last_login_date TEXT
    );

    CREATE TABLE IF NOT EXISTS user_accounts (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS chat_messages (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      chat_type TEXT DEFAULT 'mentor',
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      content TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS prelims_attempts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT,
      selected_answer TEXT,
      is_correct INTEGER,
      subject TEXT,
      level INTEGER,
      score INTEGER,
      total_questions INTEGER,
      attempted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS mains_submissions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      question_id TEXT,
      question_text TEXT,
      answer_text TEXT,
      answer_image_url TEXT,
      word_count INTEGER,
      evaluation TEXT,
      marks REAL,
      ai_score REAL,
      ai_feedback TEXT,
      section TEXT,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS study_plan (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT,
      tasks TEXT,
      total_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      day_label TEXT,
      subject TEXT,
      topic TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS upsc_smart_notes (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      subject_id TEXT,
      subject_name TEXT,
      topic TEXT NOT NULL,
      slides_count INTEGER DEFAULT 0,
      deck_json TEXT NOT NULL DEFAULT '{}',
      current_slide INTEGER DEFAULT 0,
      passed_checkpoints TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS subject_rag_chunks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject_id TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      source_name TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_subject_rag_chunks_subject ON subject_rag_chunks(subject_id);

    CREATE TABLE IF NOT EXISTS weekly_tests (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      week_label TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      start_at TEXT,
      end_at TEXT,
      is_published INTEGER NOT NULL DEFAULT 0,
      created_by TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS weekly_test_questions (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_test_questions_test_id ON weekly_test_questions(test_id);

    CREATE TABLE IF NOT EXISTS weekly_test_attempts (
      id TEXT PRIMARY KEY,
      test_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (test_id, user_id)
    );
    CREATE INDEX IF NOT EXISTS idx_weekly_test_attempts_test_id ON weekly_test_attempts(test_id);

    CREATE TABLE IF NOT EXISTS weekly_test_attempt_answers (
      id TEXT PRIMARY KEY,
      attempt_id TEXT NOT NULL,
      question_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL,
      is_correct INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS weekly_test_admin_sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS doubt_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      image_url TEXT,
      answer_count INTEGER NOT NULL DEFAULT 0,
      likes_count INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      views_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unanswered',
      best_answer_id TEXT,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      report_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doubt_answers (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      content TEXT NOT NULL,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      is_ai_generated INTEGER NOT NULL DEFAULT 0,
      is_best_answer INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      report_count INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doubt_answer_votes (
      id TEXT PRIMARY KEY,
      answer_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(answer_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS doubt_post_likes (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS doubt_post_saves (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS doubt_post_views (
      id TEXT PRIMARY KEY,
      post_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(post_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS doubt_reports (
      id TEXT PRIMARY KEY,
      reporter_id TEXT NOT NULL,
      target_type TEXT NOT NULL,
      target_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS doubt_notifications (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_post_id TEXT,
      related_answer_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes_feed_posts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT NOT NULL DEFAULT '[]',
      image_urls TEXT NOT NULL DEFAULT '[]',
      likes_count INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      report_count INTEGER NOT NULL DEFAULT 0,
      is_flagged INTEGER NOT NULL DEFAULT 0,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS notes_feed_likes (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notes_feed_saves (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(note_id, user_id)
    );

    CREATE TABLE IF NOT EXISTS notes_feed_reports (
      id TEXT PRIMARY KEY,
      note_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      reason TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );
  `);

  // Safe schema updates for existing SQLite files.
  try { sqlite.exec(`ALTER TABLE doubt_posts ADD COLUMN likes_count INTEGER NOT NULL DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE doubt_posts ADD COLUMN views_count INTEGER NOT NULL DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE doubt_posts ADD COLUMN saves_count INTEGER NOT NULL DEFAULT 0;`); } catch {}
  try { sqlite.exec(`ALTER TABLE doubt_answers ADD COLUMN is_ai_generated INTEGER NOT NULL DEFAULT 0;`); } catch {}

  return true;
};

export const neonHealthCheck = async () => {
  try {
    const row = sqlite.prepare("SELECT datetime('now') AS now").get() as any;
    return { connected: true, now: row?.now ?? null, active: dbFile, mode: "local-sqlite" };
  } catch (error: any) {
    return { connected: false, reason: error?.message || "Local DB error", mode: "local-sqlite" };
  }
};

export const neonCacheGet = async <T = unknown>(cacheKey: string): Promise<T | null> => {
  try {
    const row = sqlite.prepare("SELECT payload FROM ai_cache_entries WHERE cache_key = ? LIMIT 1").get(cacheKey) as any;
    if (!row?.payload) return null;
    return JSON.parse(String(row.payload)) as T;
  } catch {
    return null;
  }
};

export const neonCacheSet = async (cacheKey: string, functionName: string, payload: unknown) => {
  sqlite
    .prepare(`
      INSERT INTO ai_cache_entries (cache_key, function_name, payload, updated_at)
      VALUES (?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = excluded.payload, updated_at = CURRENT_TIMESTAMP
    `)
    .run(cacheKey, functionName, JSON.stringify(payload ?? null));
};

export const neonLogRequest = async (functionName: string, cacheKey: string, requestBody: unknown, responseBody: unknown) => {
  sqlite
    .prepare(`
      INSERT INTO ai_function_logs (function_name, cache_key, request_body, response_body, created_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
    `)
    .run(functionName, cacheKey, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null));
};

export const neonAdminStats = async () => {
  const logs = (sqlite.prepare("SELECT COUNT(*) AS count FROM ai_function_logs").get() as any)?.count || 0;
  const cacheEntries = (sqlite.prepare("SELECT COUNT(*) AS count FROM ai_cache_entries").get() as any)?.count || 0;
  return { logs: Number(logs), cacheEntries: Number(cacheEntries) };
};
