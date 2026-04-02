import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "../config.js";

const dir = path.dirname(config.sqlitePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

export const sqlite = new Database(config.sqlitePath);

sqlite.exec(`
CREATE TABLE IF NOT EXISTS cache_entries (
  key TEXT PRIMARY KEY,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS request_logs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  function_name TEXT NOT NULL,
  request_body TEXT,
  response_body TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
`);

const getStmt = sqlite.prepare("SELECT payload FROM cache_entries WHERE key = ?");
const upsertStmt = sqlite.prepare(`
  INSERT INTO cache_entries (key, payload) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET payload = excluded.payload, created_at = datetime('now')
`);
const logStmt = sqlite.prepare(`
  INSERT INTO request_logs (function_name, request_body, response_body) VALUES (?, ?, ?)
`);

export const cacheGet = <T = unknown>(key: string): T | null => {
  const row = getStmt.get(key) as { payload: string } | undefined;
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
};

export const cacheSet = (key: string, payload: unknown) => {
  upsertStmt.run(key, JSON.stringify(payload));
};

export const logRequest = (fn: string, requestBody: unknown, responseBody: unknown) => {
  logStmt.run(fn, JSON.stringify(requestBody ?? null), JSON.stringify(responseBody ?? null));
};
