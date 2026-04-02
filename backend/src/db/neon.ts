import { neon } from "@neondatabase/serverless";
import { config, hasNeon } from "../config.js";

export const neonSql = hasNeon ? neon(config.neonDatabaseUrl) : null;

export const queryNeon = async <T = unknown>(query: string, params: unknown[] = []): Promise<T[]> => {
  if (!neonSql) return [];
  const rows = await neonSql(query, params);
  return rows as T[];
};
