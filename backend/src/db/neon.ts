import { Pool } from "pg";
import { config, hasNeon } from "../config.js";

export const pool = hasNeon
  ? new Pool({
      connectionString: config.neonDatabaseUrl,
      ssl: { rejectUnauthorized: false },
      max: 5,
    })
  : null;

export const queryNeon = async <T = unknown>(query: string, params: unknown[] = []): Promise<T[]> => {
  if (!pool) return [];
  const result = await pool.query(query, params);
  return result.rows as T[];
};

export const ensureNeonSchema = async () => {
  if (!pool) return false;

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_cache_entries (
      cache_key TEXT PRIMARY KEY,
      function_name TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS ai_function_logs (
      id BIGSERIAL PRIMARY KEY,
      function_name TEXT NOT NULL,
      cache_key TEXT,
      request_body JSONB,
      response_body JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
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
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_login_date DATE
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      chat_type TEXT DEFAULT 'mentor',
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS prelims_attempts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      question_id TEXT,
      selected_answer TEXT,
      is_correct BOOLEAN,
      subject TEXT,
      level INTEGER,
      score INTEGER,
      total_questions INTEGER,
      attempted_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS mains_submissions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      question_id TEXT,
      question_text TEXT,
      answer_text TEXT,
      answer_image_url TEXT,
      word_count INTEGER,
      evaluation TEXT,
      marks NUMERIC,
      ai_score NUMERIC,
      ai_feedback TEXT,
      section TEXT,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS study_plan (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      date DATE,
      tasks JSONB,
      total_tasks INTEGER DEFAULT 0,
      completed_tasks INTEGER DEFAULT 0,
      day_label TEXT,
      subject TEXT,
      topic TEXT,
      status TEXT DEFAULT 'pending',
      notes TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS upsc_smart_notes (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      subject_id TEXT,
      subject_name TEXT,
      topic TEXT NOT NULL,
      slides_count INTEGER DEFAULT 0,
      deck_json JSONB NOT NULL DEFAULT '{}'::jsonb,
      current_slide INTEGER DEFAULT 0,
      passed_checkpoints INTEGER[] NOT NULL DEFAULT '{}',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'mentor';`);
  await pool.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;`);
  await pool.query(`UPDATE chat_messages SET content = message WHERE content IS NULL AND message IS NOT NULL;`);
  await pool.query(`UPDATE chat_messages SET message = content WHERE message IS NULL AND content IS NOT NULL;`);

  await pool.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS question_id TEXT;`);
  await pool.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS selected_answer TEXT;`);
  await pool.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;`);

  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS question_id TEXT;`);
  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS answer_image_url TEXT;`);
  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS word_count INTEGER;`);
  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS evaluation TEXT;`);
  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS marks NUMERIC;`);
  await pool.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`);

  await pool.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS date DATE;`);
  await pool.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS tasks JSONB;`);
  await pool.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS total_tasks INTEGER DEFAULT 0;`);
  await pool.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0;`);

  return true;
};

export const neonHealthCheck = async () => {
  if (!pool) return { connected: false, reason: "NEON_DATABASE_URL missing" };
  try {
    const result = await pool.query("SELECT NOW() AS now");
    return { connected: true, now: result.rows[0]?.now ?? null };
  } catch (error: any) {
    return { connected: false, reason: error?.message || "Neon query failed" };
  }
};

export const neonCacheGet = async <T = unknown>(cacheKey: string): Promise<T | null> => {
  if (!pool) return null;
  try {
    const result = await pool.query(
      "SELECT payload FROM ai_cache_entries WHERE cache_key = $1 LIMIT 1",
      [cacheKey],
    );
    return (result.rows[0]?.payload as T) ?? null;
  } catch {
    return null;
  }
};

export const neonCacheSet = async (cacheKey: string, functionName: string, payload: unknown) => {
  if (!pool) return;
  try {
    await pool.query(
      `
      INSERT INTO ai_cache_entries (cache_key, function_name, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `,
      [cacheKey, functionName, JSON.stringify(payload)],
    );
  } catch {
    // ignore neon write failure and keep app responsive
  }
};

export const neonLogRequest = async (functionName: string, cacheKey: string, requestBody: unknown, responseBody: unknown) => {
  if (!pool) return;
  try {
    await pool.query(
      `
      INSERT INTO ai_function_logs (function_name, cache_key, request_body, response_body)
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
      `,
      [functionName, cacheKey, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null)],
    );
  } catch {
    // ignore neon write failure and keep app responsive
  }
};

export const neonAdminStats = async () => {
  if (!pool) return { logs: 0, cacheEntries: 0 };

  try {
    const logs = await pool.query("SELECT COUNT(*)::int AS count FROM ai_function_logs");
    const cacheEntries = await pool.query("SELECT COUNT(*)::int AS count FROM ai_cache_entries");

    return {
      logs: logs.rows[0]?.count ?? 0,
      cacheEntries: cacheEntries.rows[0]?.count ?? 0,
    };
  } catch {
    return { logs: 0, cacheEntries: 0 };
  }
};
