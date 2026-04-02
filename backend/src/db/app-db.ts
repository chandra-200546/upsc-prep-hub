import { randomUUID, createHash } from "node:crypto";
import { pool } from "./neon.js";

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

export const signUpUser = async (email: string, password: string, name: string) => {
  if (!pool) throw new Error("Neon is not configured");
  const userId = randomUUID();
  const passHash = hashPassword(password);

  const existing = await pool.query("SELECT id FROM user_accounts WHERE email = $1 LIMIT 1", [email]);
  if (existing.rows[0]) throw new Error("User already exists");

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(
      "INSERT INTO user_accounts (id, email, password_hash, name) VALUES ($1, $2, $3, $4)",
      [userId, email, passHash, name],
    );
    await client.query(
      `
      INSERT INTO profiles (
        id, name, target_year, optional_subject, study_hours_per_day, language,
        profile_photo_url, mentor_personality, current_streak, total_xp, level, last_login_date
      )
      VALUES ($1, $2, 2027, 'Public Administration', 4, 'English', NULL, 'friendly', 0, 0, 1, CURRENT_DATE)
      ON CONFLICT (id) DO NOTHING
      `,
      [userId, name || "Aspirant"],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }

  return createSession(userId, email);
};

export const loginUser = async (email: string, password: string) => {
  if (!pool) throw new Error("Neon is not configured");
  const passHash = hashPassword(password);
  const result = await pool.query<{ id: string; email: string }>(
    "SELECT id, email FROM user_accounts WHERE email = $1 AND password_hash = $2 LIMIT 1",
    [email, passHash],
  );
  const user = result.rows[0];
  if (!user) throw new Error("Invalid email or password");

  await pool.query("UPDATE profiles SET last_login_date = CURRENT_DATE, updated_at = NOW() WHERE id = $1", [user.id]);
  return createSession(user.id, user.email);
};

export const createSession = async (userId: string, email: string) => {
  if (!pool) throw new Error("Neon is not configured");
  const token = `upsc_${randomUUID().replace(/-/g, "")}`;
  const refreshToken = `upsc_refresh_${randomUUID().replace(/-/g, "")}`;
  const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString();

  await pool.query(
    `
    INSERT INTO auth_sessions (token, refresh_token, user_id, expires_at)
    VALUES ($1, $2, $3, $4::timestamptz)
    `,
    [token, refreshToken, userId, expiresAt],
  );

  return {
    access_token: token,
    refresh_token: refreshToken,
    user: { id: userId, email },
  };
};

export const resolveSession = async (token?: string | null) => {
  if (!pool || !token) return null;
  const result = await pool.query<{ user_id: string; email: string }>(
    `
    SELECT s.user_id, u.email
    FROM auth_sessions s
    JOIN user_accounts u ON u.id = s.user_id
    WHERE s.token = $1 AND s.expires_at > NOW()
    LIMIT 1
    `,
    [token],
  );
  const row = result.rows[0];
  if (!row) return null;
  return {
    access_token: token,
    refresh_token: "",
    user: { id: row.user_id, email: row.email },
  };
};

export const revokeSession = async (token?: string | null) => {
  if (!pool || !token) return;
  await pool.query("DELETE FROM auth_sessions WHERE token = $1", [token]);
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
  if (!pool) return [];
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

  const result = await pool.query(sql, values);
  return result.rows;
};

const rowColumns = (row: Record<string, unknown>) =>
  Object.keys(row)
    .filter((k) => COL_RE.test(k))
    .sort();

export const dbInsert = async (tableInput: string, rowsInput: Record<string, unknown>[]) => {
  if (!pool) return [];
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
    const result = await pool.query(sql, vals);
    inserted.push(result.rows[0]);
  }
  return inserted;
};

export const dbUpsert = async (tableInput: string, rowsInput: Record<string, unknown>[]) => {
  if (!pool) return [];
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
      .map((c) => `${c} = EXCLUDED.${c}`)
      .join(", ");

    const sql = `
      INSERT INTO ${table} (${cols.join(", ")})
      VALUES (${placeholders})
      ON CONFLICT (id) DO UPDATE SET ${updates || "id = EXCLUDED.id"}
      RETURNING *
    `;
    const result = await pool.query(sql, vals);
    upserted.push(result.rows[0]);
  }

  return upserted;
};

export const dbUpdate = async (input: {
  table: string;
  columns?: string;
  patch: Record<string, unknown>;
  filters?: EqFilter[];
}) => {
  if (!pool) return [];
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

  const result = await pool.query(sql, values);
  return result.rows;
};

export const dbDelete = async (input: { table: string; filters?: EqFilter[] }) => {
  if (!pool) return [];
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
  const result = await pool.query(sql, values);
  return result.rows;
};
