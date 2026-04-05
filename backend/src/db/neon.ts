import { Pool } from "pg";
import { config, hasNeon } from "../config.js";

const normalizeConnectionUrl = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.searchParams.get("channel_binding")) {
      parsed.searchParams.delete("channel_binding");
    }
    if (!parsed.searchParams.get("sslmode")) {
      parsed.searchParams.set("sslmode", "require");
    }
    return parsed.toString();
  } catch {
    return url;
  }
};

const poolFromUrl = (url: string) =>
  new Pool({
    connectionString: normalizeConnectionUrl(url),
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

const toPoolerVariant = (url: string) => {
  try {
    const parsed = new URL(url);
    if (parsed.hostname.includes("-pooler.")) return "";
    if (parsed.hostname.startsWith("ep-") && parsed.hostname.includes(".c-")) {
      parsed.hostname = parsed.hostname.replace(/^([^.]*)/, "$1-pooler");
      return parsed.toString();
    }
  } catch {
    // ignore URL parse errors
  }
  return "";
};

const toDirectVariant = (url: string) => {
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.includes("-pooler.")) return "";
    parsed.hostname = parsed.hostname.replace("-pooler.", ".");
    return parsed.toString();
  } catch {
    // ignore URL parse errors
  }
  return "";
};

const candidateUrls = (() => {
  if (!hasNeon || !config.neonDatabaseUrl) return [] as string[];
  const pooler = toPoolerVariant(config.neonDatabaseUrl);
  const direct = toDirectVariant(config.neonDatabaseUrl);
  const fromEnvList = String(process.env.NEON_DATABASE_URLS || "")
    .split(/[,\n;|]/g)
    .map((v) => v.trim())
    .filter(Boolean);
  return Array.from(new Set([config.neonDatabaseUrl, pooler, direct, ...fromEnvList].filter(Boolean)));
})();

const pools = candidateUrls.map((url) => poolFromUrl(url));
let activePoolIndex = 0;

export const pool = pools[0] ?? null;

const getActivePool = () => {
  if (!pools.length) return null;
  return pools[activePoolIndex] || pools[0];
};

const withPoolFailover = async <T>(fn: (p: Pool) => Promise<T>): Promise<T> => {
  const first = getActivePool();
  if (!first) throw new Error("NEON_DATABASE_URL missing");
  try {
    return await fn(first);
  } catch (error: any) {
    const msg = String(error?.message || "").toLowerCase();
    const retriableNetwork =
      msg.includes("enotfound") ||
      msg.includes("getaddrinfo") ||
      msg.includes("econnrefused") ||
      msg.includes("fetch failed") ||
      msg.includes("socket hang up");
    if (!retriableNetwork || pools.length < 2) throw error;

    let lastError = error;
    for (let i = 0; i < pools.length; i += 1) {
      if (i === activePoolIndex) continue;
      try {
        const res = await fn(pools[i]);
        activePoolIndex = i;
        return res;
      } catch (nextError: any) {
        lastError = nextError;
      }
    }
    throw lastError;
  }
};

export const queryNeon = async <T = unknown>(query: string, params: unknown[] = []): Promise<T[]> => {
  const current = getActivePool();
  if (!current) throw new Error("NEON_DATABASE_URL missing");
  const result = await withPoolFailover((p) => p.query(query, params));
  return result.rows as T[];
};

export const ensureNeonSchema = async () => {
  if (!getActivePool()) return false;

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS ai_cache_entries (
      cache_key TEXT PRIMARY KEY,
      function_name TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS ai_function_logs (
      id BIGSERIAL PRIMARY KEY,
      function_name TEXT NOT NULL,
      cache_key TEXT,
      request_body JSONB,
      response_body JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));

  await withPoolFailover((p) => p.query(`
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
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS user_accounts (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      refresh_token TEXT NOT NULL,
      user_id UUID NOT NULL REFERENCES user_accounts(id) ON DELETE CASCADE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      chat_type TEXT DEFAULT 'mentor',
      role TEXT NOT NULL,
      message TEXT NOT NULL,
      content TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));

  await withPoolFailover((p) => p.query(`
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
  `));

  await withPoolFailover((p) => p.query(`
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
  `));

  await withPoolFailover((p) => p.query(`
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
  `));

  await withPoolFailover((p) => p.query(`
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
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS subject_rag_chunks (
      id BIGSERIAL PRIMARY KEY,
      subject_id TEXT NOT NULL,
      subject_name TEXT NOT NULL,
      source_name TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      chunk_text TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_subject_rag_chunks_subject ON subject_rag_chunks(subject_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS weekly_tests (
      id UUID PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      week_label TEXT,
      duration_minutes INTEGER NOT NULL DEFAULT 60,
      start_at TIMESTAMPTZ,
      end_at TIMESTAMPTZ,
      is_published BOOLEAN NOT NULL DEFAULT FALSE,
      created_by UUID,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS weekly_test_questions (
      id UUID PRIMARY KEY,
      test_id UUID NOT NULL REFERENCES weekly_tests(id) ON DELETE CASCADE,
      question_text TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      option_d TEXT NOT NULL,
      correct_answer TEXT NOT NULL,
      explanation TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_weekly_test_questions_test_id ON weekly_test_questions(test_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS weekly_test_attempts (
      id UUID PRIMARY KEY,
      test_id UUID NOT NULL REFERENCES weekly_tests(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      score INTEGER NOT NULL DEFAULT 0,
      total_questions INTEGER NOT NULL DEFAULT 0,
      submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (test_id, user_id)
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_weekly_test_attempts_test_id ON weekly_test_attempts(test_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS weekly_test_attempt_answers (
      id UUID PRIMARY KEY,
      attempt_id UUID NOT NULL REFERENCES weekly_test_attempts(id) ON DELETE CASCADE,
      question_id UUID NOT NULL REFERENCES weekly_test_questions(id) ON DELETE CASCADE,
      selected_answer TEXT NOT NULL,
      is_correct BOOLEAN NOT NULL DEFAULT FALSE
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS weekly_test_admin_sessions (
      token TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      expires_at TIMESTAMPTZ NOT NULL
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS doubt_posts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      image_url TEXT,
      answer_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'unanswered',
      best_answer_id UUID,
      is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      report_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_posts_created_at ON doubt_posts(created_at DESC);`));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_posts_category ON doubt_posts(category);`));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_posts_status ON doubt_posts(status);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS doubt_answers (
      id UUID PRIMARY KEY,
      post_id UUID NOT NULL REFERENCES doubt_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      content TEXT NOT NULL,
      helpful_count INTEGER NOT NULL DEFAULT 0,
      is_best_answer BOOLEAN NOT NULL DEFAULT FALSE,
      is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      report_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_answers_post_id ON doubt_answers(post_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS doubt_answer_votes (
      id UUID PRIMARY KEY,
      answer_id UUID NOT NULL REFERENCES doubt_answers(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(answer_id, user_id)
    );
  `));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS doubt_reports (
      id UUID PRIMARY KEY,
      reporter_id UUID NOT NULL,
      target_type TEXT NOT NULL,
      target_id UUID NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_reports_target ON doubt_reports(target_type, target_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS doubt_notifications (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      type TEXT NOT NULL,
      message TEXT NOT NULL,
      related_post_id UUID,
      related_answer_id UUID,
      is_read BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_doubt_notifications_user ON doubt_notifications(user_id, is_read, created_at DESC);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS notes_feed_posts (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      category TEXT NOT NULL,
      tags TEXT[] NOT NULL DEFAULT '{}',
      image_urls TEXT[] NOT NULL DEFAULT '{}',
      likes_count INTEGER NOT NULL DEFAULT 0,
      saves_count INTEGER NOT NULL DEFAULT 0,
      report_count INTEGER NOT NULL DEFAULT 0,
      is_flagged BOOLEAN NOT NULL DEFAULT FALSE,
      moderation_status TEXT NOT NULL DEFAULT 'clean',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_posts_created_at ON notes_feed_posts(created_at DESC);`));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_posts_category ON notes_feed_posts(category);`));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_posts_saves_count ON notes_feed_posts(saves_count DESC);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS notes_feed_likes (
      id UUID PRIMARY KEY,
      note_id UUID NOT NULL REFERENCES notes_feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(note_id, user_id)
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_likes_note ON notes_feed_likes(note_id);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS notes_feed_saves (
      id UUID PRIMARY KEY,
      note_id UUID NOT NULL REFERENCES notes_feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE(note_id, user_id)
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_saves_note ON notes_feed_saves(note_id);`));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_saves_user ON notes_feed_saves(user_id, created_at DESC);`));

  await withPoolFailover((p) => p.query(`
    CREATE TABLE IF NOT EXISTS notes_feed_reports (
      id UUID PRIMARY KEY,
      note_id UUID NOT NULL REFERENCES notes_feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL,
      reason TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `));
  await withPoolFailover((p) => p.query(`CREATE INDEX IF NOT EXISTS idx_notes_feed_reports_note ON notes_feed_reports(note_id);`));

  await withPoolFailover((p) => p.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS chat_type TEXT DEFAULT 'mentor';`));
  await withPoolFailover((p) => p.query(`ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS content TEXT;`));
  await withPoolFailover((p) => p.query(`UPDATE chat_messages SET content = message WHERE content IS NULL AND message IS NOT NULL;`));
  await withPoolFailover((p) => p.query(`UPDATE chat_messages SET message = content WHERE message IS NULL AND content IS NOT NULL;`));

  await withPoolFailover((p) => p.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS question_id TEXT;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS selected_answer TEXT;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE prelims_attempts ADD COLUMN IF NOT EXISTS is_correct BOOLEAN;`));

  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS question_id TEXT;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS answer_image_url TEXT;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS word_count INTEGER;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS evaluation TEXT;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS marks NUMERIC;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE mains_submissions ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NOT NULL DEFAULT NOW();`));

  await withPoolFailover((p) => p.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS date DATE;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS tasks JSONB;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS total_tasks INTEGER DEFAULT 0;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE study_plan ADD COLUMN IF NOT EXISTS completed_tasks INTEGER DEFAULT 0;`));
  await withPoolFailover((p) => p.query(`ALTER TABLE doubt_posts ADD COLUMN IF NOT EXISTS best_answer_id UUID;`));

  return true;
};

export const neonHealthCheck = async () => {
  if (!getActivePool()) return { connected: false, reason: "NEON_DATABASE_URL missing" };
  try {
    const result = await withPoolFailover((p) => p.query("SELECT NOW() AS now"));
    return { connected: true, now: result.rows[0]?.now ?? null, active: candidateUrls[activePoolIndex] };
  } catch (error: any) {
    return { connected: false, reason: error?.message || "Neon query failed" };
  }
};

export const neonCacheGet = async <T = unknown>(cacheKey: string): Promise<T | null> => {
  if (!getActivePool()) return null;
  try {
    const result = await withPoolFailover((p) => p.query(
      "SELECT payload FROM ai_cache_entries WHERE cache_key = $1 LIMIT 1",
      [cacheKey],
    ));
    return (result.rows[0]?.payload as T) ?? null;
  } catch {
    return null;
  }
};

export const neonCacheSet = async (cacheKey: string, functionName: string, payload: unknown) => {
  if (!getActivePool()) return;
  try {
    await withPoolFailover((p) => p.query(
      `
      INSERT INTO ai_cache_entries (cache_key, function_name, payload)
      VALUES ($1, $2, $3::jsonb)
      ON CONFLICT (cache_key)
      DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
      `,
      [cacheKey, functionName, JSON.stringify(payload)],
    ));
  } catch {
    // ignore neon write failure and keep app responsive
  }
};

export const neonLogRequest = async (functionName: string, cacheKey: string, requestBody: unknown, responseBody: unknown) => {
  if (!getActivePool()) return;
  try {
    await withPoolFailover((p) => p.query(
      `
      INSERT INTO ai_function_logs (function_name, cache_key, request_body, response_body)
      VALUES ($1, $2, $3::jsonb, $4::jsonb)
      `,
      [functionName, cacheKey, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null)],
    ));
  } catch {
    // ignore neon write failure and keep app responsive
  }
};

export const neonAdminStats = async () => {
  if (!getActivePool()) return { logs: 0, cacheEntries: 0 };

  try {
    const logs = await withPoolFailover((p) => p.query("SELECT COUNT(*)::int AS count FROM ai_function_logs"));
    const cacheEntries = await withPoolFailover((p) => p.query("SELECT COUNT(*)::int AS count FROM ai_cache_entries"));

    return {
      logs: logs.rows[0]?.count ?? 0,
      cacheEntries: cacheEntries.rows[0]?.count ?? 0,
    };
  } catch {
    return { logs: 0, cacheEntries: 0 };
  }
};
