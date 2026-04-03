import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

type Row = Record<string, any>;
type Filter = { col: string; value: unknown; op?: "eq" | "gte" | "lte" };

type LocalDb = {
  user_accounts: Row[];
  auth_sessions: Row[];
  profiles: Row[];
  chat_messages: Row[];
  prelims_attempts: Row[];
  mains_submissions: Row[];
  study_plan: Row[];
  upsc_smart_notes: Row[];
};

const filePath = path.resolve(process.cwd(), "data", "local-app-db.json");

const emptyDb = (): LocalDb => ({
  user_accounts: [],
  auth_sessions: [],
  profiles: [],
  chat_messages: [],
  prelims_attempts: [],
  mains_submissions: [],
  study_plan: [],
  upsc_smart_notes: [],
});

const ensureDb = () => {
  const dir = path.dirname(filePath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(filePath)) fs.writeFileSync(filePath, JSON.stringify(emptyDb(), null, 2), "utf-8");
};

const readDb = (): LocalDb => {
  ensureDb();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    return { ...emptyDb(), ...(JSON.parse(raw) as Partial<LocalDb>) };
  } catch {
    return emptyDb();
  }
};

const writeDb = (db: LocalDb) => {
  ensureDb();
  fs.writeFileSync(filePath, JSON.stringify(db, null, 2), "utf-8");
};

export const getLocalSnapshot = (): LocalDb => readDb();

export const clearLocalSnapshot = () => {
  writeDb(emptyDb());
};

const applyFilters = (rows: Row[], filters: Filter[] = []) => {
  return rows.filter((r) =>
    filters.every((f) => {
      const left = r?.[f.col];
      const right = f.value as any;
      if (f.op === "gte") return (left as any) >= right;
      if (f.op === "lte") return (left as any) <= right;
      return left === right;
    }),
  );
};

export const localSignUp = (email: string, passwordHash: string, name: string) => {
  const db = readDb();
  const exists = db.user_accounts.find((u) => String(u.email).toLowerCase() === email.toLowerCase());
  if (exists) throw new Error("User already exists");

  const id = randomUUID();
  db.user_accounts.push({ id, email, password_hash: passwordHash, name, created_at: new Date().toISOString() });
  db.profiles.push({
    id,
    name: name || "Aspirant",
    target_year: 2027,
    optional_subject: "Public Administration",
    study_hours_per_day: 4,
    language: "English",
    mentor_personality: "friendly",
    current_streak: 0,
    total_xp: 0,
    level: 1,
    last_login_date: new Date().toISOString().slice(0, 10),
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });
  writeDb(db);
  return { id, email };
};

export const localLogin = (email: string, passwordHash: string) => {
  const db = readDb();
  const user = db.user_accounts.find(
    (u) => String(u.email).toLowerCase() === email.toLowerCase() && u.password_hash === passwordHash,
  );
  if (!user) throw new Error("Invalid email or password");
  return { id: user.id, email: user.email };
};

export const localCreateSession = (userId: string, email: string) => {
  const db = readDb();
  const token = `upsc_${randomUUID().replace(/-/g, "")}`;
  const refreshToken = `upsc_refresh_${randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();
  db.auth_sessions.push({
    token,
    refresh_token: refreshToken,
    user_id: userId,
    created_at: new Date().toISOString(),
    expires_at: expiresAt,
  });
  writeDb(db);
  return { access_token: token, refresh_token: refreshToken, user: { id: userId, email } };
};

export const localResolveSession = (token?: string | null) => {
  if (!token) return null;
  const db = readDb();
  const session = db.auth_sessions.find((s) => s.token === token && new Date(s.expires_at).getTime() > Date.now());
  if (!session) return null;
  const user = db.user_accounts.find((u) => u.id === session.user_id);
  if (!user) return null;
  return { access_token: token, refresh_token: session.refresh_token || "", user: { id: user.id, email: user.email } };
};

export const localRevokeSession = (token?: string | null) => {
  if (!token) return;
  const db = readDb();
  db.auth_sessions = db.auth_sessions.filter((s) => s.token !== token);
  writeDb(db);
};

export const localDbSelect = (table: keyof LocalDb, filters: Filter[] = [], order?: { col: string; ascending?: boolean } | null, limit?: number | null) => {
  const db = readDb();
  let rows = applyFilters(db[table] || [], filters);
  if (order?.col) {
    rows = [...rows].sort((a, b) => {
      const av = a?.[order.col];
      const bv = b?.[order.col];
      if (av === bv) return 0;
      if (order.ascending === false) return av < bv ? 1 : -1;
      return av > bv ? 1 : -1;
    });
  }
  if (limit && Number.isFinite(limit)) rows = rows.slice(0, Math.max(1, Math.min(1000, limit)));
  return rows;
};

export const localDbInsert = (table: keyof LocalDb, rowsInput: Row[]) => {
  const db = readDb();
  const rows = rowsInput.map((r) => ({ id: r.id || randomUUID(), created_at: r.created_at || new Date().toISOString(), ...r }));
  db[table].push(...rows);
  writeDb(db);
  return rows;
};

export const localDbUpsert = (table: keyof LocalDb, rowsInput: Row[]) => {
  const db = readDb();
  const out: Row[] = [];
  rowsInput.forEach((r) => {
    const id = r.id || randomUUID();
    const idx = db[table].findIndex((x) => x.id === id);
    if (idx >= 0) {
      db[table][idx] = { ...db[table][idx], ...r, id, updated_at: new Date().toISOString() };
      out.push(db[table][idx]);
    } else {
      const row = { id, created_at: r.created_at || new Date().toISOString(), ...r };
      db[table].push(row);
      out.push(row);
    }
  });
  writeDb(db);
  return out;
};

export const localDbUpdate = (table: keyof LocalDb, patch: Row, filters: Filter[] = []) => {
  const db = readDb();
  const rows = applyFilters(db[table], filters);
  rows.forEach((r) => Object.assign(r, patch, { updated_at: new Date().toISOString() }));
  writeDb(db);
  return rows;
};

export const localDbDelete = (table: keyof LocalDb, filters: Filter[] = []) => {
  const db = readDb();
  const matched = applyFilters(db[table], filters);
  const ids = new Set(matched.map((r) => r.id));
  db[table] = db[table].filter((r) => !ids.has(r.id));
  writeDb(db);
  return matched;
};
