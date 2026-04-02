import { pool } from "./neon.js";

export type Profile = {
  id: string;
  name: string;
  target_year: number | null;
  optional_subject: string | null;
  study_hours_per_day: number | null;
  language: string | null;
  profile_photo_url: string | null;
  mentor_personality: string | null;
  current_streak: number;
  total_xp: number;
  level: number;
  created_at: string;
  updated_at: string;
  last_login_date: string | null;
};

export type ProfileUpsertInput = {
  id: string;
  name: string;
  target_year?: number | null;
  optional_subject?: string | null;
  study_hours_per_day?: number | null;
  language?: string | null;
  profile_photo_url?: string | null;
  mentor_personality?: string | null;
  current_streak?: number;
  total_xp?: number;
  level?: number;
  created_at?: string | null;
  updated_at?: string | null;
  last_login_date?: string | null;
};

const toNullableNumber = (value: string | undefined): number | null => {
  if (!value || !value.trim()) return null;
  const n = Number(value.trim());
  return Number.isFinite(n) ? n : null;
};

const toNumberDefault = (value: string | undefined, fallback: number): number => {
  const n = toNullableNumber(value);
  return n ?? fallback;
};

const splitSemicolonLine = (line: string): string[] => {
  const out: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }
    if (ch === ";" && !inQuotes) {
      out.push(current.trim());
      current = "";
      continue;
    }
    current += ch;
  }
  out.push(current.trim());
  return out;
};

export const parseProfilesCsv = (csv: string): ProfileUpsertInput[] => {
  const lines = csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 2) return [];

  const header = splitSemicolonLine(lines[0]);
  const rows = lines.slice(1);

  const parsed: ProfileUpsertInput[] = [];
  rows.forEach((line) => {
      const values = splitSemicolonLine(line);
      const row: Record<string, string> = {};
      header.forEach((h, idx) => {
        row[h] = values[idx] ?? "";
      });

      const id = row.id?.trim();
      if (!id) return;

      parsed.push({
        id,
        name: row.name?.trim() || "Aspirant",
        target_year: toNullableNumber(row.target_year),
        optional_subject: row.optional_subject?.trim() || null,
        study_hours_per_day: toNullableNumber(row.study_hours_per_day),
        language: row.language?.trim() || "English",
        profile_photo_url: row.profile_photo_url?.trim() || null,
        mentor_personality: row.mentor_personality?.trim() || "friendly",
        current_streak: toNumberDefault(row.current_streak, 0),
        total_xp: toNumberDefault(row.total_xp, 0),
        level: toNumberDefault(row.level, 1),
        created_at: row.created_at?.trim() || null,
        updated_at: row.updated_at?.trim() || null,
        last_login_date: row.last_login_date?.trim() || null,
      });
    });
  return parsed;
};

export const upsertProfiles = async (profiles: ProfileUpsertInput[]) => {
  if (!pool) throw new Error("Neon is not configured");
  if (!profiles.length) return { inserted: 0 };

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const p of profiles) {
      await client.query(
        `
        INSERT INTO profiles (
          id, name, target_year, optional_subject, study_hours_per_day, language,
          profile_photo_url, mentor_personality, current_streak, total_xp, level,
          created_at, updated_at, last_login_date
        ) VALUES (
          $1, $2, $3, $4, $5, $6,
          $7, $8, $9, $10, $11,
          COALESCE($12::timestamptz, NOW()),
          COALESCE($13::timestamptz, NOW()),
          $14::date
        )
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          target_year = EXCLUDED.target_year,
          optional_subject = EXCLUDED.optional_subject,
          study_hours_per_day = EXCLUDED.study_hours_per_day,
          language = EXCLUDED.language,
          profile_photo_url = EXCLUDED.profile_photo_url,
          mentor_personality = EXCLUDED.mentor_personality,
          current_streak = EXCLUDED.current_streak,
          total_xp = EXCLUDED.total_xp,
          level = EXCLUDED.level,
          updated_at = COALESCE(EXCLUDED.updated_at, NOW()),
          last_login_date = EXCLUDED.last_login_date
        `,
        [
          p.id,
          p.name,
          p.target_year ?? null,
          p.optional_subject ?? null,
          p.study_hours_per_day ?? null,
          p.language ?? "English",
          p.profile_photo_url ?? null,
          p.mentor_personality ?? "friendly",
          p.current_streak ?? 0,
          p.total_xp ?? 0,
          p.level ?? 1,
          p.created_at ?? null,
          p.updated_at ?? null,
          p.last_login_date ?? null,
        ],
      );
    }
    await client.query("COMMIT");
    return { inserted: profiles.length };
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
};

export const listProfiles = async (limit = 100, offset = 0): Promise<Profile[]> => {
  if (!pool) return [];
  const result = await pool.query<Profile>(
    `
    SELECT *
    FROM profiles
    ORDER BY updated_at DESC
    LIMIT $1 OFFSET $2
    `,
    [Math.max(1, Math.min(500, limit)), Math.max(0, offset)],
  );
  return result.rows;
};

export const getProfileById = async (id: string): Promise<Profile | null> => {
  if (!pool) return null;
  const result = await pool.query<Profile>("SELECT * FROM profiles WHERE id = $1 LIMIT 1", [id]);
  return result.rows[0] ?? null;
};
