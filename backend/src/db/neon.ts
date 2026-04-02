import { neon } from "@neondatabase/serverless";
import { config, hasNeon } from "../config.js";

export const neonSql = hasNeon ? neon(config.neonDatabaseUrl) : null;

export const queryNeon = async <T = unknown>(query: string, params: unknown[] = []): Promise<T[]> => {
  if (!neonSql) return [];
  const rows = await neonSql(query, params);
  return rows as T[];
};

export const ensureNeonSchema = async () => {
  if (!neonSql) return false;

  await neonSql(`
    CREATE TABLE IF NOT EXISTS ai_cache_entries (
      cache_key TEXT PRIMARY KEY,
      function_name TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `);

  await neonSql(`
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
  if (!neonSql) return { connected: false, reason: "NEON_DATABASE_URL missing" };
  try {
    const rows = await neonSql("SELECT NOW() AS now");
    return { connected: true, now: (rows as any[])[0]?.now ?? null };
  } catch (error: any) {
    return { connected: false, reason: error?.message || "Neon query failed" };
  }
};

export const neonCacheGet = async <T = unknown>(cacheKey: string): Promise<T | null> => {
  if (!neonSql) return null;
  const rows = await neonSql(
    "SELECT payload FROM ai_cache_entries WHERE cache_key = $1 LIMIT 1",
    [cacheKey],
  ) as Array<{ payload: T }>;
  return rows[0]?.payload ?? null;
};

export const neonCacheSet = async (cacheKey: string, functionName: string, payload: unknown) => {
  if (!neonSql) return;
  await neonSql(
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
  if (!neonSql) return;
  await neonSql(
    `
    INSERT INTO ai_function_logs (function_name, cache_key, request_body, response_body)
    VALUES ($1, $2, $3::jsonb, $4::jsonb)
    `,
    [functionName, cacheKey, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null)],
  );
};

export const neonAdminStats = async () => {
  if (!neonSql) return { logs: 0, cacheEntries: 0 };

  const logs = await neonSql("SELECT COUNT(*)::int AS count FROM ai_function_logs") as Array<{ count: number }>;
  const cacheEntries = await neonSql("SELECT COUNT(*)::int AS count FROM ai_cache_entries") as Array<{ count: number }>;

  return {
    logs: logs[0]?.count ?? 0,
    cacheEntries: cacheEntries[0]?.count ?? 0,
  };
};
