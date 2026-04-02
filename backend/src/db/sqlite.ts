import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

type CacheRow = { payload: string; created_at: string };
type LogRow = {
  id: number;
  function_name: string;
  request_body: string;
  response_body: string;
  created_at: string;
};

type DbShape = {
  cache_entries: Record<string, CacheRow>;
  request_logs: LogRow[];
  next_id: number;
};

const dir = path.dirname(config.sqlitePath);
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });

const storageFile = config.sqlitePath.endsWith(".db")
  ? config.sqlitePath.replace(/\.db$/i, ".json")
  : `${config.sqlitePath}.json`;

const emptyDb: DbShape = {
  cache_entries: {},
  request_logs: [],
  next_id: 1,
};

let db: DbShape = emptyDb;

const load = () => {
  try {
    if (!fs.existsSync(storageFile)) {
      fs.writeFileSync(storageFile, JSON.stringify(emptyDb, null, 2), "utf-8");
      db = { ...emptyDb };
      return;
    }
    const raw = fs.readFileSync(storageFile, "utf-8");
    db = JSON.parse(raw) as DbShape;
    if (!db.cache_entries) db.cache_entries = {};
    if (!Array.isArray(db.request_logs)) db.request_logs = [];
    if (typeof db.next_id !== "number") db.next_id = db.request_logs.length + 1;
  } catch {
    db = { ...emptyDb };
  }
};

const persist = () => {
  try {
    fs.writeFileSync(storageFile, JSON.stringify(db, null, 2), "utf-8");
  } catch {
    // ignore persistence failure to keep app running
  }
};

load();

export const cacheGet = <T = unknown>(key: string): T | null => {
  const row = db.cache_entries[key];
  if (!row) return null;
  try {
    return JSON.parse(row.payload) as T;
  } catch {
    return null;
  }
};

export const cacheSet = (key: string, payload: unknown) => {
  db.cache_entries[key] = {
    payload: JSON.stringify(payload ?? null),
    created_at: new Date().toISOString(),
  };
  persist();
};

export const logRequest = (fn: string, requestBody: unknown, responseBody: unknown) => {
  db.request_logs.push({
    id: db.next_id++,
    function_name: fn,
    request_body: JSON.stringify(requestBody ?? null),
    response_body: JSON.stringify(responseBody ?? null),
    created_at: new Date().toISOString(),
  });
  if (db.request_logs.length > 5000) {
    db.request_logs = db.request_logs.slice(-5000);
  }
  persist();
};
