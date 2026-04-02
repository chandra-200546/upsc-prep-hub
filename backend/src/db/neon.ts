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
  const result = await pool.query(
    "SELECT payload FROM ai_cache_entries WHERE cache_key = $1 LIMIT 1",
    [cacheKey],
  );
  return (result.rows[0]?.payload as T) ?? null;
};

export const neonCacheSet = async (cacheKey: string, functionName: string, payload: unknown) => {
  if (!pool) return;
  await pool.query(
    `
    INSERT INTO ai_cache_entries (cache_key, function_name, payload)
    VALUES ($1, $2, $3::jsonb)
    ON CONFLICT (cache_key)
    DO UPDATE SET payload = EXCLUDED.payload, updated_at = NOW();
    `,
    [cacheKey, functionName, JSON.stringify(payload)],
  );
};

export const neonLogRequest = async (functionName: string, cacheKey: string, requestBody: unknown, responseBody: unknown) => {
  if (!pool) return;
  await pool.query(
    `
    INSERT INTO ai_function_logs (function_name, cache_key, request_body, response_body)
    VALUES ($1, $2, $3::jsonb, $4::jsonb)
    `,
    [functionName, cacheKey, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null)],
  );
};

export const neonAdminStats = async () => {
  if (!pool) return { logs: 0, cacheEntries: 0 };

  const logs = await pool.query("SELECT COUNT(*)::int AS count FROM ai_function_logs");
  const cacheEntries = await pool.query("SELECT COUNT(*)::int AS count FROM ai_cache_entries");

  return {
    logs: logs.rows[0]?.count ?? 0,
    cacheEntries: cacheEntries.rows[0]?.count ?? 0,
  };
};
