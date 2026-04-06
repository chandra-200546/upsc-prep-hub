import { randomUUID, createHash } from "node:crypto";
import { queryNeon } from "./neon.js";

const TABLES = new Set([
  "profiles",
  "chat_messages",
  "prelims_attempts",
  "mains_submissions",
  "study_plan",
  "upsc_smart_notes",
]);

const COL_RE = /^[a-zA-Z_][a-zA-Z0-9_]*$/;

const assertTable = (table: string) => {
  if (!TABLES.has(table)) throw new Error(`Unsupported table: ${table}`);
  return table;
};

const assertCol = (column: string) => {
  if (!COL_RE.test(column)) throw new Error(`Invalid column: ${column}`);
  return column;
};

const hashPassword = (password: string) => createHash("sha256").update(password).digest("hex");
const NAME_RE = /^[A-Za-z]+(?:[A-Za-z\s'-]*[A-Za-z])?$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PASSWORD_RE = /^(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z0-9]).{6,}$/;

const validateSignUpInput = (name: string, email: string, password: string) => {
  if (!name || !NAME_RE.test(name.trim())) {
    throw new Error("Name must contain only letters and valid separators.");
  }
  if (!email || !EMAIL_RE.test(email.trim().toLowerCase())) {
    throw new Error("Please enter a valid email address.");
  }
  if (!password || !PASSWORD_RE.test(password)) {
    throw new Error("Password must include at least one uppercase letter, one number, and one special character.");
  }
};

export const signUpUser = async (email: string, password: string, name: string) => {
  validateSignUpInput(name, email, password);
  const userId = randomUUID();
  const passHash = hashPassword(password);
  const existing = await queryNeon<{ id: string }>("SELECT id FROM user_accounts WHERE email = $1 LIMIT 1", [email]);
  if (existing[0]) throw new Error("User already exists");

  await queryNeon(
    "INSERT INTO user_accounts (id, email, password_hash, name) VALUES ($1, $2, $3, $4)",
    [userId, email, passHash, name],
  );
  await queryNeon(
    `
    INSERT INTO profiles (
      id, name, target_year, optional_subject, study_hours_per_day, language,
      profile_photo_url, mentor_personality, current_streak, total_xp, level, last_login_date
    )
    VALUES ($1, $2, 2027, 'Public Administration', 4, 'English', NULL, 'friendly', 0, 0, 1, date('now'))
    ON CONFLICT (id) DO NOTHING
    `,
    [userId, name || "Aspirant"],
  );
  return createSession(userId, email);
};

export const loginUser = async (email: string, password: string) => {
  const passHash = hashPassword(password);
  const result = await queryNeon<{ id: string; email: string }>(
    "SELECT id, email FROM user_accounts WHERE email = $1 AND password_hash = $2 LIMIT 1",
    [email, passHash],
  );
  const user = result[0];
  if (!user) throw new Error("Invalid email or password");

  await queryNeon("UPDATE profiles SET last_login_date = date('now'), updated_at = CURRENT_TIMESTAMP WHERE id = $1", [user.id]);
  return createSession(user.id, user.email);
};

export const loginOrCreateGoogleUser = async (email: string, name: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  if (!normalizedEmail) throw new Error("Google account email is required");

  const existing = await queryNeon<{ id: string; email: string; name: string }>(
    "SELECT id, email, name FROM user_accounts WHERE email = $1 LIMIT 1",
    [normalizedEmail],
  );

  let userId = existing[0]?.id;
  const userName = existing[0]?.name || name || "Aspirant";

  if (!userId) {
    userId = randomUUID();
    const randomPass = hashPassword(`google-oauth-${randomUUID()}`);
    await queryNeon(
      "INSERT INTO user_accounts (id, email, password_hash, name) VALUES ($1, $2, $3, $4)",
      [userId, normalizedEmail, randomPass, userName],
    );
    await queryNeon(
      `
      INSERT INTO profiles (
        id, name, target_year, optional_subject, study_hours_per_day, language,
        profile_photo_url, mentor_personality, current_streak, total_xp, level, last_login_date
      )
      VALUES ($1, $2, 2027, 'Public Administration', 4, 'English', NULL, 'friendly', 0, 0, 1, date('now'))
      ON CONFLICT (id) DO NOTHING
      `,
      [userId, userName],
    );
  } else {
    await queryNeon("UPDATE user_accounts SET name = $1 WHERE id = $2", [userName, userId]);
    await queryNeon("UPDATE profiles SET name = $1, last_login_date = date('now'), updated_at = CURRENT_TIMESTAMP WHERE id = $2", [userName, userId]);
  }

  return createSession(userId, normalizedEmail);
};

export const resetPasswordByEmail = async (email: string, newPassword: string) => {
  const normalizedEmail = email.trim().toLowerCase();
  const passHash = hashPassword(newPassword);

  const existing = await queryNeon<{ id: string }>("SELECT id FROM user_accounts WHERE email = $1 LIMIT 1", [normalizedEmail]);
  const userId = existing[0]?.id;
  if (!userId) return { updated: false };

  await queryNeon("UPDATE user_accounts SET password_hash = $1 WHERE id = $2", [passHash, userId]);
  await queryNeon("DELETE FROM auth_sessions WHERE user_id = $1", [userId]);
  return { updated: true };
};

export const updatePasswordForUser = async (userId: string, currentPassword: string, newPassword: string) => {
  const currentHash = hashPassword(currentPassword);
  const nextHash = hashPassword(newPassword);

  const existing = await queryNeon<{ id: string }>(
    "SELECT id FROM user_accounts WHERE id = $1 AND password_hash = $2 LIMIT 1",
    [userId, currentHash],
  );
  if (!existing[0]) throw new Error("Current password is incorrect");

  await queryNeon("UPDATE user_accounts SET password_hash = $1 WHERE id = $2", [nextHash, userId]);
  return { updated: true };
};

export const createSession = async (userId: string, email: string) => {
  const token = `upsc_${randomUUID().replace(/-/g, "")}`;
  const refreshToken = `upsc_refresh_${randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 3650).toISOString();

  await queryNeon(
    "INSERT INTO auth_sessions (token, refresh_token, user_id, expires_at) VALUES ($1, $2, $3, $4)",
    [token, refreshToken, userId, expiresAt],
  );

  return {
    access_token: token,
    refresh_token: refreshToken,
    user: { id: userId, email },
  };
};

export const resolveSession = async (token?: string | null) => {
  if (!token) return null;
  const result = await queryNeon<{ user_id: string; email: string }>(
    `
    SELECT s.user_id, u.email
    FROM auth_sessions s
    JOIN user_accounts u ON u.id = s.user_id
    WHERE s.token = $1 AND datetime(s.expires_at) > CURRENT_TIMESTAMP
    LIMIT 1
    `,
    [token],
  );
  const row = result[0];
  if (!row) return null;

  await queryNeon(`UPDATE auth_sessions SET expires_at = datetime('now','+3650 days') WHERE token = $1`, [token]);

  return {
    access_token: token,
    refresh_token: "",
    user: { id: row.user_id, email: row.email },
  };
};

export const revokeSession = async (token?: string | null) => {
  if (!token) return;
  await queryNeon("DELETE FROM auth_sessions WHERE token = $1", [token]);
};

type EqFilter = { col: string; value: unknown; op?: "eq" | "gte" | "lte" };

const safeOperator = (op?: string) => {
  if (op === "gte") return ">=";
  if (op === "lte") return "<=";
  return "=";
};

export const dbSelect = async (input: {
  table: string;
  columns?: string;
  filters?: EqFilter[];
  order?: { col: string; ascending?: boolean } | null;
  limit?: number | null;
}) => {
  const table = assertTable(input.table);
  const values: unknown[] = [];
  const whereParts: string[] = [];

  (input.filters ?? []).forEach((f) => {
    const col = assertCol(f.col);
    const op = safeOperator(f.op);
    values.push(f.value);
    whereParts.push(`${col} ${op} $${values.length}`);
  });

  let sql = `SELECT * FROM ${table}`;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(" AND ")}`;
  if (input.order?.col) {
    const col = assertCol(input.order.col);
    sql += ` ORDER BY ${col} ${input.order.ascending === false ? "DESC" : "ASC"}`;
  }
  if (input.limit && Number.isFinite(input.limit)) {
    const lim = Math.max(1, Math.min(1000, Number(input.limit)));
    sql += ` LIMIT ${lim}`;
  }
  return queryNeon(sql, values);
};

const rowColumns = (row: Record<string, unknown>) =>
  Object.keys(row)
    .filter((k) => COL_RE.test(k))
    .sort();

export const dbInsert = async (tableInput: string, rowsInput: Record<string, unknown>[]) => {
  const table = assertTable(tableInput);
  const rows = rowsInput.length ? rowsInput : [];
  if (!rows.length) return [];

  const inserted: unknown[] = [];
  for (const raw of rows) {
    const row = { ...raw };
    if (!row.id) row.id = randomUUID();
    if (!row.created_at) row.created_at = new Date().toISOString();
    if (table === "chat_messages") {
      const content = (row.content as string) || (row.message as string) || "";
      row.content = content;
      row.message = content;
    }

    const cols = rowColumns(row);
    const vals = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const sql = `INSERT INTO ${table} (${cols.join(", ")}) VALUES (${placeholders}) RETURNING *`;
    const result = await queryNeon(sql, vals);
    inserted.push(result[0]);
  }
  return inserted;
};

export const dbUpsert = async (tableInput: string, rowsInput: Record<string, unknown>[]) => {
  const table = assertTable(tableInput);
  const rows = rowsInput.length ? rowsInput : [];
  if (!rows.length) return [];

  const upserted: unknown[] = [];
  for (const raw of rows) {
    const row = { ...raw };
    if (!row.id) row.id = randomUUID();
    if (!row.created_at) row.created_at = new Date().toISOString();
    if (table === "chat_messages") {
      const content = (row.content as string) || (row.message as string) || "";
      row.content = content;
      row.message = content;
    }

    const cols = rowColumns(row);
    const vals = cols.map((c) => row[c]);
    const placeholders = cols.map((_, i) => `$${i + 1}`).join(", ");
    const updates = cols
      .filter((c) => c !== "id" && c !== "created_at")
      .map((c) => `${c} = excluded.${c}`)
      .join(", ");

    const sql = `
      INSERT INTO ${table} (${cols.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updates || "id = excluded.id"}
      RETURNING *
    `;
    const result = await queryNeon(sql, vals);
    upserted.push(result[0]);
  }

  return upserted;
};

export const dbUpdate = async (input: {
  table: string;
  columns?: string;
  patch: Record<string, unknown>;
  filters?: EqFilter[];
}) => {
  const table = assertTable(input.table);
  const patchCols = rowColumns(input.patch);
  if (!patchCols.length) return [];

  const values: unknown[] = [];
  const setSql = patchCols
    .map((c) => {
      values.push(input.patch[c]);
      return `${c} = $${values.length}`;
    })
    .join(", ");

  const whereParts: string[] = [];
  (input.filters ?? []).forEach((f) => {
    const col = assertCol(f.col);
    const op = safeOperator(f.op);
    values.push(f.value);
    whereParts.push(`${col} ${op} $${values.length}`);
  });

  let sql = `UPDATE ${table} SET ${setSql}`;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(" AND ")}`;
  sql += " RETURNING *";

  return queryNeon(sql, values);
};

export const dbDelete = async (input: { table: string; filters?: EqFilter[] }) => {
  const table = assertTable(input.table);
  const values: unknown[] = [];
  const whereParts: string[] = [];
  (input.filters ?? []).forEach((f) => {
    const col = assertCol(f.col);
    const op = safeOperator(f.op);
    values.push(f.value);
    whereParts.push(`${col} ${op} $${values.length}`);
  });

  let sql = `DELETE FROM ${table}`;
  if (whereParts.length) sql += ` WHERE ${whereParts.join(" AND ")}`;
  sql += " RETURNING *";
  return queryNeon(sql, values);
};
