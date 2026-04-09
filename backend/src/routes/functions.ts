import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { dbDelete, dbInsert, dbSelect, dbUpdate, dbUpsert, loginOrCreateGoogleUser, loginUser, resetPasswordByEmail, resolveSession, revokeSession, signUpUser, updatePasswordForUser } from "../db/app-db.js";
import { cacheGet, cacheSet, logRequest } from "../db/sqlite.js";
import { neonAdminStats, neonCacheGet, neonCacheSet, neonLogRequest, queryNeon } from "../db/neon.js";
import { getProfileById, listProfiles, parseProfilesCsv, upsertProfiles } from "../db/profiles.js";
import { getHistoryRagStats, ingestHistoryChunks, queryHistoryRag } from "../rag/history-rag.js";
import { generateSubjectBookAnswer, generateSubjectRagNotes, getSubjectRagStats, ingestSubjectPdf } from "../rag/subject-rag.js";
import { generateJson, generateText } from "../lib/gemini.js";
import { config, hasXai } from "../config.js";
import { deleteFile, getStoragePublicPath, saveBase64File } from "../lib/storage.js";
import { hashPayload } from "../lib/utils.js";

type Bindings = { Variables: { fn: string } };
export const functionsRouter = new Hono<Bindings>();

const nowIso = () => new Date().toISOString();

const withCache = async <T>(fn: string, payload: unknown, compute: () => Promise<T>) => {
  const key = hashPayload(fn, payload);

  try {
    const neonCached = await neonCacheGet<T>(key);
    if (neonCached) return neonCached;
  } catch {
    // Ignore Neon cache outages and continue with local cache/computation.
  }

  const sqliteCached = cacheGet<T>(key);
  if (sqliteCached) {
    await neonCacheSet(key, fn, sqliteCached);
    return sqliteCached;
  }

  const fresh = await compute();
  cacheSet(key, fresh);
  try {
    await neonCacheSet(key, fn, fresh);
  } catch {
    // Ignore Neon cache write failures.
  }
  return fresh;
};

const persistLog = async (fn: string, payload: unknown, response: unknown) => {
  const key = hashPayload(fn, payload);
  logRequest(fn, payload, response);
  try {
    await neonLogRequest(fn, key, payload, response);
  } catch {
    // Ignore Neon logging failures so feature APIs keep working.
  }
};

const safeAi = async (system: string, user: string, fallback: string) => {
  try {
    const txt = await generateText([
      { role: "system", content: system },
      { role: "user", content: user },
    ]);
    return txt || fallback;
  } catch {
    return fallback;
  }
};

const authTokenFromHeader = (authHeader?: string | null) => {
  if (!authHeader) return "";
  const match = authHeader.match(/^Bearer\s+(.+)$/i);
  return match?.[1]?.trim() || "";
};

const getSessionUser = async (c: any) => {
  const token = authTokenFromHeader(c.req.header("Authorization"));
  if (!token) return null;
  const session = await resolveSession(token);
  return session?.user || null;
};

const getAdminTokenFromHeader = (c: any) => String(c.req.header("X-Weekly-Admin-Token") || "").trim();

const requireWeeklyAdmin = async (c: any) => {
  const token = getAdminTokenFromHeader(c);
  if (!token) return null;
  const rows = await queryNeon<{ email: string }>(
    `SELECT email FROM weekly_test_admin_sessions WHERE token = $1 AND expires_at > NOW() LIMIT 1`,
    [token],
  );
  return rows[0] || null;
};

const verifyGoogleIdToken = async (idToken: string) => {
  const tokenInfoRes = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  const tokenInfo = await tokenInfoRes.json().catch(() => ({}));
  if (!tokenInfoRes.ok) {
    const reason = String(tokenInfo?.error_description || tokenInfo?.error || "Invalid Google token");
    throw new Error(reason);
  }

  const aud = String(tokenInfo?.aud || "");
  if (config.googleClientId && aud && aud !== config.googleClientId) {
    throw new Error("Google token audience mismatch");
  }

  const email = String(tokenInfo?.email || "").trim().toLowerCase();
  const emailVerified = String(tokenInfo?.email_verified || "").toLowerCase() === "true";
  const name = String(tokenInfo?.name || "Aspirant").trim() || "Aspirant";
  if (!email || !emailVerified) {
    throw new Error("Google account email is not verified");
  }
  return { email, name };
};

const UPSC_CATEGORIES = [
  "Polity",
  "History",
  "Geography",
  "Economy",
  "Environment",
  "Science & Tech",
  "Ethics",
  "Essay",
  "Current Affairs",
  "CSAT",
  "Optional",
  "Prelims",
  "Mains",
  "Interview",
] as const;

const OFFTOPIC_KEYWORDS = [
  "coding", "programming", "python", "java", "javascript", "react", "node", "movie", "cinema",
  "song", "cricket", "football", "meme", "netflix", "instagram", "relationship", "dating",
  "shopping", "buy", "sell", "promotion", "crypto tip", "stock tip",
];

const normalizeText = (value: unknown) => String(value ?? "").toLowerCase().trim();

const sanitizeTags = (tags: unknown) => {
  if (!Array.isArray(tags)) return [] as string[];
  return tags
    .map((t) => String(t ?? "").trim())
    .filter(Boolean)
    .slice(0, 8);
};

const analyzeUpscContent = (input: {
  title?: string;
  description?: string;
  content?: string;
  category?: string;
}) => {
  const text = [input.title, input.description, input.content, input.category].map(normalizeText).join(" ");
  const offTopicHits = OFFTOPIC_KEYWORDS.filter((k) => text.includes(k)).length;
  const categoryOk = UPSC_CATEGORIES.includes(String(input.category || "") as (typeof UPSC_CATEGORIES)[number]);

  if (!categoryOk) {
    return {
      allowed: false,
      flagged: true,
      moderationStatus: "rejected",
      warning: "Please select a valid UPSC category.",
    };
  }

  const flagged = offTopicHits > 0;
  return {
    allowed: true,
    flagged,
    moderationStatus: flagged ? "needs_review" : "clean",
    warning: flagged ? "This content is flagged for moderation review." : "",
  };
};

const validModerationReasons = new Set(["off-topic", "spam", "abusive", "irrelevant", "duplicate"]);
const validSharePlatforms = new Set([
  "copy_link",
  "whatsapp",
  "x",
  "telegram",
  "email",
  "native",
  "facebook",
  "linkedin",
  "reddit",
  "other",
]);

const normalizeSharePlatform = (value: unknown) => {
  const platform = String(value ?? "").trim().toLowerCase();
  return validSharePlatforms.has(platform) ? platform : "other";
};

const createDoubtNotification = async (params: {
  userId: string;
  type:
    | "answer_received"
    | "answer_liked"
    | "best_answer_selected"
    | "doubt_liked"
    | "doubt_saved"
    | "doubt_shared"
    | "note_liked"
    | "note_saved"
    | "note_shared";
  message: string;
  actorUserId?: string;
  targetKind?: "doubt" | "notes";
  relatedPostId?: string;
  relatedNoteId?: string;
  relatedAnswerId?: string;
}) => {
  await queryNeon(
    `
    INSERT INTO doubt_notifications (id, user_id, type, message, actor_user_id, target_kind, related_post_id, related_note_id, related_answer_id, is_read)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5::uuid, $6, $7::uuid, $8::uuid, $9::uuid, FALSE)
    `,
    [
      randomUUID(),
      params.userId,
      params.type,
      params.message,
      params.actorUserId || null,
      params.targetKind || "doubt",
      params.relatedPostId || null,
      params.relatedNoteId || null,
      params.relatedAnswerId || null,
    ],
  );
};

const getNotificationActorName = async (userId: string): Promise<string> => {
  if (!userId) return "Aspirant";
  const rows = await queryNeon<{ name: string | null }>(
    `
    SELECT COALESCE(p.name, ua.name, 'Aspirant') AS name
    FROM user_accounts ua
    LEFT JOIN profiles p ON p.id = ua.id
    WHERE ua.id = $1::uuid
    LIMIT 1
    `,
    [userId],
  );
  return String(rows[0]?.name || "Aspirant").trim() || "Aspirant";
};

const toIsoFromDbTimestamp = (value: string | null | undefined): string => {
  const raw = String(value || "").trim();
  if (!raw) return new Date().toISOString();
  if (/[zZ]$/.test(raw) || /[+\-]\d{2}:\d{2}$/.test(raw)) {
    const dt = new Date(raw);
    return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
  }
  const normalized = raw.replace(" ", "T");
  const dt = new Date(`${normalized}Z`);
  return Number.isNaN(dt.getTime()) ? new Date().toISOString() : dt.toISOString();
};

const formatNotificationMessage = (type: string, actorName: string): string => {
  const actor = actorName || "Aspirant";
  switch (type) {
    case "answer_received":
      return `${actor} answered your UPSC doubt.`;
    case "answer_liked":
      return `${actor} marked your answer as helpful.`;
    case "best_answer_selected":
      return `${actor} selected your answer as the best answer.`;
    case "doubt_liked":
      return `${actor} liked your doubt post.`;
    case "doubt_saved":
      return `${actor} saved your doubt post.`;
    case "doubt_shared":
      return `${actor} shared your doubt post.`;
    case "note_liked":
      return `${actor} liked your notes post.`;
    case "note_saved":
      return `${actor} saved your notes post.`;
    case "note_shared":
      return `${actor} shared your notes post.`;
    default:
      return `${actor} interacted with your post.`;
  }
};

const resolveNotificationActorName = async (row: {
  type: string;
  actor_user_id: string | null;
  related_post_id: string | null;
  related_note_id: string | null;
  related_answer_id: string | null;
}): Promise<string> => {
  if (row.actor_user_id) return getNotificationActorName(row.actor_user_id);
  if (row.type === "answer_received" || row.type === "answer_liked") {
    if (!row.related_answer_id) return "Aspirant";
    const a = await queryNeon<{ user_id: string }>(
      `SELECT user_id::text FROM doubt_answers WHERE id = $1::uuid LIMIT 1`,
      [row.related_answer_id],
    );
    return getNotificationActorName(String(a[0]?.user_id || ""));
  }
  if (row.type === "best_answer_selected" || row.type.startsWith("doubt_")) {
    if (!row.related_post_id) return "Aspirant";
    if (row.type === "doubt_liked") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM doubt_post_likes WHERE post_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_post_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
    if (row.type === "doubt_saved") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM doubt_post_saves WHERE post_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_post_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
    if (row.type === "doubt_shared") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM doubt_post_shares WHERE post_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_post_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
    const r = await queryNeon<{ user_id: string }>(
      `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
      [row.related_post_id],
    );
    return getNotificationActorName(String(r[0]?.user_id || ""));
  }
  if (row.type.startsWith("note_")) {
    if (!row.related_note_id) return "Aspirant";
    if (row.type === "note_liked") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM notes_feed_likes WHERE note_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_note_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
    if (row.type === "note_saved") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM notes_feed_saves WHERE note_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_note_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
    if (row.type === "note_shared") {
      const r = await queryNeon<{ user_id: string }>(
        `SELECT user_id::text FROM notes_feed_shares WHERE note_id = $1::uuid ORDER BY created_at DESC LIMIT 1`,
        [row.related_note_id],
      );
      return getNotificationActorName(String(r[0]?.user_id || ""));
    }
  }
  return "Aspirant";
};

const refreshDoubtPostMeta = async (postId: string) => {
  const rows = await queryNeon<{ answer_count: number; best_answer_id: string | null }>(
    `
    SELECT
      COUNT(a.id)::int AS answer_count,
      MAX(CASE WHEN a.is_best_answer THEN a.id::text ELSE NULL END) AS best_answer_id
    FROM doubt_posts p
    LEFT JOIN doubt_answers a ON a.post_id = p.id
    WHERE p.id = $1::uuid
    `,
    [postId],
  );
  const answerCount = Number(rows[0]?.answer_count || 0);
  const bestAnswerId = rows[0]?.best_answer_id || null;
  const status = bestAnswerId ? "solved" : answerCount > 0 ? "answered" : "unanswered";

  await queryNeon(
    `
    UPDATE doubt_posts
    SET answer_count = $2, best_answer_id = $3::uuid, status = $4, updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [postId, answerCount, bestAnswerId, status],
  );
};

const ensureDoubtEngagementSchema = async () => {
  try {
    await queryNeon(
      `CREATE TABLE IF NOT EXISTS doubt_post_likes (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )`,
    );
  } catch {}
  try {
    await queryNeon(
      `CREATE TABLE IF NOT EXISTS doubt_post_saves (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )`,
    );
  } catch {}
  try {
    await queryNeon(
      `CREATE TABLE IF NOT EXISTS doubt_post_views (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(post_id, user_id)
      )`,
    );
  } catch {}
  try {
    await queryNeon(
      `CREATE TABLE IF NOT EXISTS doubt_post_shares (
        id TEXT PRIMARY KEY,
        post_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  } catch {}
};

const ensureNotesFeedShareSchema = async () => {
  try {
    await queryNeon(
      `CREATE TABLE IF NOT EXISTS notes_feed_shares (
        id TEXT PRIMARY KEY,
        note_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        platform TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
      )`,
    );
  } catch {}
};

functionsRouter.post("/auth/signup", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  const name = String(body?.name ?? "Aspirant").trim();

  if (!email || !password) return c.json({ message: "email and password are required" }, 400);
  try {
    const session = await signUpUser(email, password, name || "Aspirant");
    return c.json({ session, user: session.user });
  } catch (error: any) {
    return c.json({ message: error?.message || "Signup failed" }, 400);
  }
});

functionsRouter.post("/auth/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return c.json({ message: "email and password are required" }, 400);

  try {
    const session = await loginUser(email, password);
    return c.json({ session, user: session.user });
  } catch (error: any) {
    return c.json({ message: error?.message || "Login failed" }, 401);
  }
});

functionsRouter.post("/auth/google", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const idToken = String(body?.idToken ?? "").trim();
  if (!idToken) return c.json({ message: "idToken is required" }, 400);

  try {
    const google = await verifyGoogleIdToken(idToken);
    const session = await loginOrCreateGoogleUser(google.email, google.name);
    return c.json({ session, user: session.user });
  } catch (error: any) {
    return c.json({ message: error?.message || "Google authentication failed" }, 401);
  }
});

functionsRouter.post("/auth/forgot-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const newPassword = String(body?.newPassword ?? "");

  if (!email || !newPassword || newPassword.length < 6) {
    return c.json({ message: "email and newPassword (min 6 chars) are required" }, 400);
  }

  try {
    await resetPasswordByEmail(email, newPassword);
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ message: error?.message || "Failed to reset password" }, 400);
  }
});

functionsRouter.post("/auth/update-password", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const currentPassword = String(body?.currentPassword ?? "");
  const newPassword = String(body?.newPassword ?? "");
  if (!currentPassword || !newPassword || newPassword.length < 6) {
    return c.json({ message: "currentPassword and newPassword (min 6 chars) are required" }, 400);
  }

  const token = authTokenFromHeader(c.req.header("Authorization"));
  const session = await resolveSession(token);
  if (!session?.user?.id) return c.json({ message: "Unauthorized" }, 401);

  try {
    await updatePasswordForUser(session.user.id, currentPassword, newPassword);
    return c.json({ ok: true });
  } catch (error: any) {
    return c.json({ message: error?.message || "Failed to update password" }, 400);
  }
});

functionsRouter.get("/auth/session", async (c) => {
  const token = authTokenFromHeader(c.req.header("Authorization"));
  if (!token) return c.json({ session: null, user: null });
  const session = await resolveSession(token);
  return c.json({ session, user: session?.user ?? null });
});

functionsRouter.post("/auth/logout", async (c) => {
  const token = authTokenFromHeader(c.req.header("Authorization"));
  if (token) await revokeSession(token);
  return c.json({ success: true });
});

functionsRouter.post("/weekly-tests/admin/login", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const email = String(body?.email ?? "").trim().toLowerCase();
  const password = String(body?.password ?? "");
  if (!email || !password) return c.json({ message: "email and password are required" }, 400);

  if (config.weeklyTestAdminEmail && config.weeklyTestAdminPassword) {
    if (email !== config.weeklyTestAdminEmail.toLowerCase() || password !== config.weeklyTestAdminPassword) {
      return c.json({ message: "Invalid admin credentials" }, 401);
    }
    const existing = await queryNeon<{ id: string }>("SELECT id::text FROM user_accounts WHERE email = $1 LIMIT 1", [email]);
    if (!existing[0]) {
      return c.json({ message: "Admin email must belong to an existing account." }, 400);
    }
  } else {
    const firstUser = await queryNeon<{ email: string }>(
      `SELECT email FROM user_accounts ORDER BY created_at ASC LIMIT 1`,
    );
    const firstEmail = String(firstUser[0]?.email || "").toLowerCase();
    if (!firstEmail || email !== firstEmail) {
      return c.json({ message: "Only the first registered account can access admin for now." }, 401);
    }
    try {
      await loginUser(email, password);
    } catch {
      return c.json({ message: "Invalid admin credentials" }, 401);
    }
  }

  const token = `wta_${randomUUID().replace(/-/g, "")}`;
  await queryNeon(
    `INSERT INTO weekly_test_admin_sessions (token, email, expires_at) VALUES ($1, $2, NOW() + INTERVAL '12 hours')`,
    [token, email],
  );
  return c.json({ ok: true, token });
});

functionsRouter.get("/weekly-tests/list", async (c) => {
  const rows = await queryNeon<{
    id: string;
    title: string;
    description: string | null;
    week_label: string | null;
    duration_minutes: number;
    start_at: string | null;
    end_at: string | null;
    is_published: boolean;
    questions_count: number;
  }>(
    `
    SELECT t.id::text, t.title, t.description, t.week_label, t.duration_minutes, t.start_at::text, t.end_at::text, t.is_published,
           COUNT(q.id)::int AS questions_count
    FROM weekly_tests t
    LEFT JOIN weekly_test_questions q ON q.test_id = t.id
    WHERE t.is_published = TRUE
    GROUP BY t.id
    ORDER BY t.created_at DESC
    `,
  );
  return c.json({ tests: rows });
});

functionsRouter.get("/weekly-tests/admin/tests", async (c) => {
  const admin = await requireWeeklyAdmin(c);
  if (!admin) return c.json({ message: "Unauthorized admin access" }, 401);
  const rows = await queryNeon<{
    id: string;
    title: string;
    description: string | null;
    week_label: string | null;
    duration_minutes: number;
    start_at: string | null;
    end_at: string | null;
    is_published: boolean;
    questions_count: number;
  }>(
    `
    SELECT t.id::text, t.title, t.description, t.week_label, t.duration_minutes, t.start_at::text, t.end_at::text, t.is_published,
           COUNT(q.id)::int AS questions_count
    FROM weekly_tests t
    LEFT JOIN weekly_test_questions q ON q.test_id = t.id
    GROUP BY t.id
    ORDER BY t.created_at DESC
    `,
  );
  return c.json({ tests: rows });
});

functionsRouter.post("/weekly-tests/admin/create", async (c) => {
  const admin = await requireWeeklyAdmin(c);
  if (!admin) return c.json({ message: "Unauthorized admin access" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const weekLabel = String(body?.weekLabel ?? "").trim();
  const durationMinutes = Math.max(15, Math.min(180, Number(body?.durationMinutes ?? 60)));
  const startAt = String(body?.startAt ?? "").trim() || null;
  const endAt = String(body?.endAt ?? "").trim() || null;
  const isPublished = Boolean(body?.isPublished ?? false);
  if (!title) return c.json({ message: "title is required" }, 400);

  const id = randomUUID();
  await queryNeon(
    `
    INSERT INTO weekly_tests (id, title, description, week_label, duration_minutes, start_at, end_at, is_published)
    VALUES ($1, $2, $3, $4, $5, $6::timestamptz, $7::timestamptz, $8)
    `,
    [id, title, description || null, weekLabel || null, durationMinutes, startAt, endAt, isPublished],
  );
  return c.json({ ok: true, id });
});

functionsRouter.post("/weekly-tests/admin/question", async (c) => {
  const admin = await requireWeeklyAdmin(c);
  if (!admin) return c.json({ message: "Unauthorized admin access" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const testId = String(body?.testId ?? "").trim();
  const questionText = String(body?.questionText ?? "").trim();
  const optionA = String(body?.optionA ?? "").trim();
  const optionB = String(body?.optionB ?? "").trim();
  const optionC = String(body?.optionC ?? "").trim();
  const optionD = String(body?.optionD ?? "").trim();
  const correctAnswer = String(body?.correctAnswer ?? "").trim().toUpperCase();
  const explanation = String(body?.explanation ?? "").trim();
  if (!testId || !questionText || !optionA || !optionB || !optionC || !optionD) {
    return c.json({ message: "testId, questionText and all options are required" }, 400);
  }
  if (!["A", "B", "C", "D"].includes(correctAnswer)) {
    return c.json({ message: "correctAnswer must be one of A/B/C/D" }, 400);
  }

  const id = randomUUID();
  await queryNeon(
    `
    INSERT INTO weekly_test_questions
    (id, test_id, question_text, option_a, option_b, option_c, option_d, correct_answer, explanation)
    VALUES ($1, $2::uuid, $3, $4, $5, $6, $7, $8, $9)
    `,
    [id, testId, questionText, optionA, optionB, optionC, optionD, correctAnswer, explanation || null],
  );
  return c.json({ ok: true, id });
});

functionsRouter.post("/weekly-tests/admin/publish", async (c) => {
  const admin = await requireWeeklyAdmin(c);
  if (!admin) return c.json({ message: "Unauthorized admin access" }, 401);
  const body = await c.req.json().catch(() => ({}));
  const testId = String(body?.testId ?? "").trim();
  const isPublished = Boolean(body?.isPublished);
  if (!testId) return c.json({ message: "testId is required" }, 400);
  await queryNeon(`UPDATE weekly_tests SET is_published = $1 WHERE id = $2::uuid`, [isPublished, testId]);
  return c.json({ ok: true });
});

functionsRouter.get("/weekly-tests/:testId", async (c) => {
  const testId = String(c.req.param("testId") || "").trim();
  if (!testId) return c.json({ message: "testId is required" }, 400);

  const testRows = await queryNeon<{
    id: string;
    title: string;
    description: string | null;
    week_label: string | null;
    duration_minutes: number;
    start_at: string | null;
    end_at: string | null;
    is_published: boolean;
  }>(
    `SELECT id::text, title, description, week_label, duration_minutes, start_at::text, end_at::text, is_published
     FROM weekly_tests WHERE id = $1::uuid LIMIT 1`,
    [testId],
  );
  const test = testRows[0];
  if (!test) return c.json({ message: "Test not found" }, 404);
  if (!test.is_published) return c.json({ message: "Test is not published yet" }, 400);

  const questions = await queryNeon<{
    id: string;
    question_text: string;
    option_a: string;
    option_b: string;
    option_c: string;
    option_d: string;
  }>(
    `SELECT id::text, question_text, option_a, option_b, option_c, option_d
     FROM weekly_test_questions WHERE test_id = $1::uuid ORDER BY created_at ASC`,
    [testId],
  );
  return c.json({ test, questions });
});

functionsRouter.post("/weekly-tests/:testId/submit", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const testId = String(c.req.param("testId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const answersRaw = Array.isArray(body?.answers) ? body.answers : [];
  if (!testId || !answersRaw.length) return c.json({ message: "testId and answers are required" }, 400);

  const questions = await queryNeon<{
    id: string;
    correct_answer: string;
  }>(
    `SELECT id::text, correct_answer FROM weekly_test_questions WHERE test_id = $1::uuid`,
    [testId],
  );
  if (!questions.length) return c.json({ message: "No questions configured for this test" }, 400);
  const answerMap = new Map<string, string>();
  answersRaw.forEach((a: any) => {
    const qid = String(a?.questionId ?? "").trim();
    const selected = String(a?.selectedAnswer ?? "").trim().toUpperCase();
    if (qid && ["A", "B", "C", "D"].includes(selected)) {
      answerMap.set(qid, selected);
    }
  });

  let score = 0;
  let answered = 0;
  const details: Array<{ questionId: string; selectedAnswer: string; isCorrect: boolean }> = [];
  questions.forEach((q) => {
    const selected = answerMap.get(q.id);
    if (!selected) return;
    answered += 1;
    const isCorrect = selected === String(q.correct_answer || "").toUpperCase();
    if (isCorrect) score += 1;
    details.push({ questionId: q.id, selectedAnswer: selected, isCorrect });
  });

  const attemptId = randomUUID();
  await queryNeon(
    `
    INSERT INTO weekly_test_attempts (id, test_id, user_id, score, total_questions, submitted_at)
    VALUES ($1, $2::uuid, $3::uuid, $4, $5, NOW())
    ON CONFLICT (test_id, user_id)
    DO UPDATE SET score = EXCLUDED.score, total_questions = EXCLUDED.total_questions, submitted_at = NOW()
    RETURNING id::text
    `,
    [attemptId, testId, user.id, score, questions.length],
  );

  const storedAttempt = await queryNeon<{ id: string }>(
    `SELECT id::text FROM weekly_test_attempts WHERE test_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [testId, user.id],
  );
  const finalAttemptId = storedAttempt[0]?.id || attemptId;

  await queryNeon(`DELETE FROM weekly_test_attempt_answers WHERE attempt_id = $1::uuid`, [finalAttemptId]);
  for (const row of details) {
    await queryNeon(
      `
      INSERT INTO weekly_test_attempt_answers (id, attempt_id, question_id, selected_answer, is_correct)
      VALUES ($1, $2::uuid, $3::uuid, $4, $5)
      `,
      [randomUUID(), finalAttemptId, row.questionId, row.selectedAnswer, row.isCorrect],
    );
  }

  return c.json({
    ok: true,
    score,
    totalQuestions: questions.length,
    answeredQuestions: answered,
    percentage: questions.length ? Math.round((score / questions.length) * 100) : 0,
  });
});

functionsRouter.get("/weekly-tests/:testId/leaderboard", async (c) => {
  const testId = String(c.req.param("testId") || "").trim();
  if (!testId) return c.json({ message: "testId is required" }, 400);

  const rows = await queryNeon<{
    user_id: string;
    name: string;
    score: number;
    total_questions: number;
    submitted_at: string;
  }>(
    `
    SELECT a.user_id::text, COALESCE(p.name, 'Aspirant') AS name, a.score, a.total_questions, a.submitted_at::text
    FROM weekly_test_attempts a
    LEFT JOIN profiles p ON p.id = a.user_id
    WHERE a.test_id = $1::uuid
    ORDER BY a.score DESC, a.submitted_at ASC
    LIMIT 50
    `,
    [testId],
  );

  const leaderboard = rows.map((r, idx) => ({
    rank: idx + 1,
    userId: r.user_id,
    name: r.name,
    score: r.score,
    totalQuestions: r.total_questions,
    percentage: r.total_questions ? Math.round((r.score / r.total_questions) * 100) : 0,
    submittedAt: r.submitted_at,
  }));
  return c.json({ leaderboard });
});

functionsRouter.post("/doubts/create", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const tags = sanitizeTags(body?.tags);
  const imageUrl = String(body?.imageUrl ?? "").trim() || null;

  if (!title || title.length < 10 || title.length > 180) {
    return c.json({ message: "Title must be between 10 and 180 characters." }, 400);
  }
  if (!description || description.length < 20 || description.length > 5000) {
    return c.json({ message: "Description must be between 20 and 5000 characters." }, 400);
  }
  if (!UPSC_CATEGORIES.includes(category as (typeof UPSC_CATEGORIES)[number])) {
    return c.json({ message: "Please select a valid UPSC category." }, 400);
  }

  const contentCheck = analyzeUpscContent({ title, description, category });
  if (!contentCheck.allowed) return c.json({ message: contentCheck.warning }, 400);

  const id = randomUUID();
  await queryNeon(
    `
    INSERT INTO doubt_posts
    (id, user_id, title, description, category, tags, image_url, answer_count, status, is_flagged, moderation_status, report_count)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 0, 'unanswered', $8, $9, 0)
    `,
    [id, user.id, title, description, category, tags, imageUrl, contentCheck.flagged, contentCheck.moderationStatus],
  );

  // Auto-add an AI first comment without blocking post creation.
  try {
    const aiComment = await safeAi(
      "You are a UPSC mentor. Provide one concise, structured first-answer comment for the doubt.",
      `Category: ${category}\nTitle: ${title}\nQuestion: ${description}`,
      "Start with core concept, then add 2-3 exam-focused points and one quick direction for further reading.",
    );
    await queryNeon(
      `
      INSERT INTO doubt_answers
      (id, post_id, user_id, content, helpful_count, is_ai_generated, is_best_answer, is_flagged, moderation_status, report_count)
      VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 0, TRUE, FALSE, 0, 'clean', 0)
      `,
      [randomUUID(), id, user.id, aiComment],
    );
    await refreshDoubtPostMeta(id);
  } catch {
    // Ignore AI-comment failures; user post is already created.
  }

  return c.json({
    ok: true,
    id,
    warning: contentCheck.warning || null,
  });
});

functionsRouter.get("/doubts", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  const search = String(c.req.query("search") || "").trim();
  const category = String(c.req.query("category") || "").trim();
  const status = String(c.req.query("status") || "").trim();
  const sortRaw = String(c.req.query("sort") || "latest").trim().toLowerCase();
  const sort: "latest" | "most_answered" | "unanswered" =
    sortRaw === "most_answered" || sortRaw === "unanswered" ? (sortRaw as "most_answered" | "unanswered") : "latest";
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const limit = Math.max(1, Math.min(50, Number(c.req.query("limit") || 20)));
  const offset = (page - 1) * limit;

  const where: string[] = [];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    where.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx += 1;
  }
  if (category && category !== "all") {
    where.push(`p.category = $${idx}`);
    params.push(category);
    idx += 1;
  }
  if (status && status !== "all") {
    where.push(`p.status = $${idx}`);
    params.push(status);
    idx += 1;
  }
  if (sort === "unanswered" && (!status || status === "all")) {
    where.push(`(COALESCE(p.answer_count, 0) = 0 OR p.status = 'unanswered')`);
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "most_answered"
      ? "ORDER BY COALESCE(p.answer_count, 0) DESC, p.updated_at DESC, p.created_at DESC"
      : sort === "unanswered"
        ? "ORDER BY p.created_at DESC, p.updated_at DESC"
        : "ORDER BY p.created_at DESC";

  let rows: Array<{
    id: string;
    user_id: string;
    title: string;
    description: string;
    category: string;
    tags: string[] | null;
    image_url: string | null;
    answer_count: number;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    status: string;
    is_flagged: boolean;
    moderation_status: string;
    report_count: number;
    created_at: string;
    updated_at: string;
    author_name: string | null;
    liked_by_viewer: number;
    saved_by_viewer: number;
  }> = [];
  try {
    rows = await queryNeon<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      category: string;
      tags: string[] | null;
      image_url: string | null;
      answer_count: number;
      likes_count: number;
      saves_count: number;
      views_count: number;
      shares_count: number;
      status: string;
      is_flagged: boolean;
      moderation_status: string;
      report_count: number;
      created_at: string;
      updated_at: string;
      author_name: string | null;
      liked_by_viewer: number;
      saved_by_viewer: number;
    }>(
      `
      SELECT
        p.id::text, p.user_id::text, p.title, p.description, p.category, p.tags, p.image_url,
        p.answer_count,
        (SELECT COUNT(*) FROM doubt_post_likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM doubt_post_saves s WHERE s.post_id = p.id) AS saves_count,
        COALESCE(p.views_count, 0) AS views_count,
        (SELECT COUNT(*) FROM doubt_post_shares sh WHERE sh.post_id = p.id) AS shares_count,
        p.status, p.is_flagged, p.moderation_status, p.report_count,
        p.created_at::text, p.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name,
        CASE WHEN $${idx}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM doubt_post_likes l WHERE l.post_id = p.id AND l.user_id = $${idx}::uuid) THEN 1 ELSE 0 END AS liked_by_viewer,
        CASE WHEN $${idx}::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM doubt_post_saves s WHERE s.post_id = p.id AND s.user_id = $${idx}::uuid) THEN 1 ELSE 0 END AS saved_by_viewer
      FROM doubt_posts p
      LEFT JOIN profiles pr ON pr.id = p.user_id
      ${whereSql}
      ${orderSql}
      LIMIT $${idx + 1} OFFSET $${idx + 2}
      `,
      [...params, user?.id || null, limit, offset],
    );
  } catch {
    // Backward-compatible fallback when new engagement tables/columns are unavailable.
    rows = await queryNeon<any>(
      `
      SELECT
        p.id::text, p.user_id::text, p.title, p.description, p.category, p.tags, p.image_url,
        p.answer_count, 0 AS likes_count, 0 AS saves_count, 0 AS views_count, 0 AS shares_count,
        p.status, p.is_flagged, p.moderation_status, p.report_count,
        p.created_at::text, p.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name,
        0 AS liked_by_viewer, 0 AS saved_by_viewer
      FROM doubt_posts p
      LEFT JOIN profiles pr ON pr.id = p.user_id
      ${whereSql}
      ${orderSql}
      LIMIT $${idx} OFFSET $${idx + 1}
      `,
      [...params, limit, offset],
    );
  }

  const countRows = await queryNeon<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM doubt_posts p ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.total || 0);

  const posts = rows.map((r) => ({
    id: r.id,
    userId: r.user_id,
    title: r.title,
    description: r.description,
    preview: r.description.length > 220 ? `${r.description.slice(0, 220)}...` : r.description,
    category: r.category,
    tags: Array.isArray(r.tags) ? r.tags : [],
    imageUrl: r.image_url,
    answerCount: Number(r.answer_count || 0),
    likesCount: Number(r.likes_count || 0),
    savesCount: Number(r.saves_count || 0),
    viewsCount: Number(r.views_count || 0),
    sharesCount: Number(r.shares_count || 0),
    likedByViewer: Number(r.liked_by_viewer || 0) > 0,
    savedByViewer: Number(r.saved_by_viewer || 0) > 0,
    status: r.status,
    isFlagged: Boolean(r.is_flagged),
    moderationStatus: r.moderation_status,
    reportCount: Number(r.report_count || 0),
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    author: { id: r.user_id, name: r.author_name || "Aspirant" },
  }));

  return c.json({
    posts,
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
});

functionsRouter.post("/doubts/seed", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);

  const existing = await queryNeon<{ count: number }>(`SELECT COUNT(*)::int AS count FROM doubt_posts`);
  if (Number(existing[0]?.count || 0) > 0) {
    return c.json({ ok: true, inserted: 0, message: "Seed skipped because posts already exist." });
  }

  const samples = [
    {
      title: "How to remember differences between FRs and DPSPs?",
      description: "I keep mixing Fundamental Rights and Directive Principles in prelims. Please share a revision method and elimination tricks.",
      category: "Polity",
      tags: ["constitution", "prelims"],
    },
    {
      title: "Why did Moderate phase of INC lose momentum by 1905?",
      description: "Need conceptual clarity for mains answer writing with historical causes and examples.",
      category: "History",
      tags: ["modern-history", "mains"],
    },
    {
      title: "How to structure monsoon mechanism answer in GS1?",
      description: "Please suggest an answer framework with factors, process, variability and current affairs linkage.",
      category: "Geography",
      tags: ["monsoon", "gs1"],
    },
  ];

  for (const row of samples) {
    await queryNeon(
      `
      INSERT INTO doubt_posts
      (id, user_id, title, description, category, tags, answer_count, status, is_flagged, moderation_status, report_count)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, 0, 'unanswered', FALSE, 'clean', 0)
      `,
      [randomUUID(), user.id, row.title, row.description, row.category, row.tags],
    );
  }
  return c.json({ ok: true, inserted: samples.length });
});

functionsRouter.get("/doubts/:postId", async (c) => {
  await ensureDoubtEngagementSchema();
  const postId = String(c.req.param("postId") || "").trim();
  if (!postId) return c.json({ message: "postId is required" }, 400);
  const user = await getSessionUser(c);

  let posts: Array<{
    id: string;
    user_id: string;
    title: string;
    description: string;
    category: string;
    tags: string[] | null;
    image_url: string | null;
    answer_count: number;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    status: string;
    best_answer_id: string | null;
    is_flagged: boolean;
    moderation_status: string;
    report_count: number;
    liked_by_viewer: number;
    saved_by_viewer: number;
    created_at: string;
    updated_at: string;
    author_name: string | null;
  }> = [];
  try {
    posts = await queryNeon<{
      id: string;
      user_id: string;
      title: string;
      description: string;
      category: string;
      tags: string[] | null;
      image_url: string | null;
      answer_count: number;
      likes_count: number;
      saves_count: number;
      views_count: number;
      shares_count: number;
      status: string;
      best_answer_id: string | null;
      is_flagged: boolean;
      moderation_status: string;
      report_count: number;
      liked_by_viewer: number;
      saved_by_viewer: number;
      created_at: string;
      updated_at: string;
      author_name: string | null;
    }>(
      `
      SELECT
        p.id::text, p.user_id::text, p.title, p.description, p.category, p.tags, p.image_url,
        p.answer_count,
        (SELECT COUNT(*) FROM doubt_post_likes l WHERE l.post_id = p.id) AS likes_count,
        (SELECT COUNT(*) FROM doubt_post_saves s WHERE s.post_id = p.id) AS saves_count,
        COALESCE(p.views_count, 0) AS views_count,
        (SELECT COUNT(*) FROM doubt_post_shares sh WHERE sh.post_id = p.id) AS shares_count,
        p.status, p.best_answer_id::text, p.is_flagged, p.moderation_status, p.report_count,
        CASE WHEN $2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM doubt_post_likes l WHERE l.post_id = p.id AND l.user_id = $2::uuid) THEN 1 ELSE 0 END AS liked_by_viewer,
        CASE WHEN $2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM doubt_post_saves s WHERE s.post_id = p.id AND s.user_id = $2::uuid) THEN 1 ELSE 0 END AS saved_by_viewer,
        p.created_at::text, p.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name
      FROM doubt_posts p
      LEFT JOIN profiles pr ON pr.id = p.user_id
      WHERE p.id = $1::uuid
      LIMIT 1
      `,
      [postId, user?.id || null],
    );
  } catch {
    // Fallback for older local schemas missing newer engagement columns.
    posts = await queryNeon<any>(
      `
      SELECT
        p.id::text, p.user_id::text, p.title, p.description, p.category, p.tags, p.image_url,
        COALESCE(p.answer_count, 0) AS answer_count,
        COALESCE(p.likes_count, 0) AS likes_count,
        COALESCE(p.saves_count, 0) AS saves_count,
        COALESCE(p.views_count, 0) AS views_count,
        0 AS shares_count,
        COALESCE(p.status, 'unanswered') AS status,
        NULL AS best_answer_id,
        COALESCE(p.is_flagged, 0) AS is_flagged,
        COALESCE(p.moderation_status, 'clean') AS moderation_status,
        COALESCE(p.report_count, 0) AS report_count,
        0 AS liked_by_viewer,
        0 AS saved_by_viewer,
        p.created_at::text, p.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name
      FROM doubt_posts p
      LEFT JOIN profiles pr ON pr.id = p.user_id
      WHERE p.id = $1::uuid
      LIMIT 1
      `,
      [postId],
    );
  }
  const post = posts[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);

  let answers: Array<{
    id: string;
    post_id: string;
    user_id: string;
    content: string;
    helpful_count: number;
    is_ai_generated: boolean;
    is_best_answer: boolean;
    is_flagged: boolean;
    moderation_status: string;
    report_count: number;
    created_at: string;
    updated_at: string;
    author_name: string | null;
    viewer_voted: number;
  }> = [];
  try {
    answers = await queryNeon<{
      id: string;
      post_id: string;
      user_id: string;
      content: string;
      helpful_count: number;
      is_ai_generated: boolean;
      is_best_answer: boolean;
      is_flagged: boolean;
      moderation_status: string;
      report_count: number;
      created_at: string;
      updated_at: string;
      author_name: string | null;
      viewer_voted: number;
    }>(
      `
      SELECT
        a.id::text, a.post_id::text, a.user_id::text, a.content, a.helpful_count, a.is_ai_generated, a.is_best_answer,
        a.is_flagged, a.moderation_status, a.report_count, a.created_at::text, a.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name,
        CASE
          WHEN $2::uuid IS NULL THEN 0
          WHEN EXISTS (
            SELECT 1 FROM doubt_answer_votes v
            WHERE v.answer_id = a.id AND v.user_id = $2::uuid
          ) THEN 1
          ELSE 0
        END AS viewer_voted
      FROM doubt_answers a
      LEFT JOIN profiles pr ON pr.id = a.user_id
      WHERE a.post_id = $1::uuid
      ORDER BY a.is_ai_generated DESC, a.is_best_answer DESC, a.helpful_count DESC, a.created_at ASC
      `,
      [postId, user?.id || null],
    );
  } catch {
    // Fallback for older local schemas missing newer answer metadata columns.
    answers = await queryNeon<any>(
      `
      SELECT
        a.id::text, a.post_id::text, a.user_id::text, a.content,
        COALESCE(a.helpful_count, 0) AS helpful_count,
        0 AS is_ai_generated,
        0 AS is_best_answer,
        0 AS is_flagged,
        'clean' AS moderation_status,
        0 AS report_count,
        a.created_at::text, a.updated_at::text,
        COALESCE(pr.name, 'Aspirant') AS author_name,
        0 AS viewer_voted
      FROM doubt_answers a
      LEFT JOIN profiles pr ON pr.id = a.user_id
      WHERE a.post_id = $1::uuid
      ORDER BY a.created_at ASC
      `,
      [postId],
    );
  }

  return c.json({
    post: {
      id: post.id,
      userId: post.user_id,
      title: post.title,
      description: post.description,
      category: post.category,
      tags: Array.isArray(post.tags) ? post.tags : [],
      imageUrl: post.image_url,
      answerCount: Number(post.answer_count || 0),
      likesCount: Number(post.likes_count || 0),
      savesCount: Number(post.saves_count || 0),
      viewsCount: Number(post.views_count || 0),
      sharesCount: Number(post.shares_count || 0),
      likedByViewer: Number(post.liked_by_viewer || 0) > 0,
      savedByViewer: Number(post.saved_by_viewer || 0) > 0,
      status: post.status,
      bestAnswerId: post.best_answer_id,
      isFlagged: Boolean(post.is_flagged),
      moderationStatus: post.moderation_status,
      reportCount: Number(post.report_count || 0),
      createdAt: post.created_at,
      updatedAt: post.updated_at,
      author: { id: post.user_id, name: post.author_name || "Aspirant" },
    },
    answers: answers.map((a) => ({
      id: a.id,
      postId: a.post_id,
      userId: a.user_id,
      content: a.content,
      helpfulCount: Number(a.helpful_count || 0),
      isAiGenerated: Boolean(a.is_ai_generated),
      isBestAnswer: Boolean(a.is_best_answer),
      isFlagged: Boolean(a.is_flagged),
      moderationStatus: a.moderation_status,
      reportCount: Number(a.report_count || 0),
      createdAt: a.created_at,
      updatedAt: a.updated_at,
      hasVoted: Number(a.viewer_voted || 0) > 0,
      author: { id: a.user_id, name: a.author_name || "Aspirant" },
    })),
  });
});

functionsRouter.post("/doubts/:postId/view", async (c) => {
  await ensureDoubtEngagementSchema();
  const postId = String(c.req.param("postId") || "").trim();
  if (!postId) return c.json({ message: "postId is required" }, 400);

  await queryNeon(
    `UPDATE doubt_posts SET views_count = COALESCE(views_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
    [postId],
  );
  const row = await queryNeon<{ count: number }>(
    `SELECT COALESCE(views_count, 0)::int AS count FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  return c.json({ ok: true, viewsCount: Number(row[0]?.count || 0) });
});

functionsRouter.post("/doubts/:postId/like", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  if (!postId) return c.json({ message: "postId is required" }, 400);
  const postRows = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const existing = await queryNeon<{ id: string }>(
    `SELECT id::text FROM doubt_post_likes WHERE post_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [postId, user.id],
  );
  let liked = false;
  if (existing[0]?.id) {
    await queryNeon(`DELETE FROM doubt_post_likes WHERE id = $1::uuid`, [existing[0].id]);
    liked = false;
  } else {
    await queryNeon(
      `INSERT INTO doubt_post_likes (id, post_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
      [randomUUID(), postId, user.id],
    );
    liked = true;
    if (post.user_id !== user.id) {
      await createDoubtNotification({
        userId: post.user_id,
        type: "doubt_liked",
        actorUserId: user.id,
        message: `${actorName} liked your doubt post.`,
        targetKind: "doubt",
        relatedPostId: postId,
      });
    }
  }
  const row = await queryNeon<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM doubt_post_likes WHERE post_id = $1::uuid`,
    [postId],
  );
  return c.json({ ok: true, liked, likesCount: Number(row[0]?.count || 0) });
});

functionsRouter.post("/doubts/:postId/save", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  if (!postId) return c.json({ message: "postId is required" }, 400);
  const postRows = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const existing = await queryNeon<{ id: string }>(
    `SELECT id::text FROM doubt_post_saves WHERE post_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [postId, user.id],
  );
  let saved = false;
  if (existing[0]?.id) {
    await queryNeon(`DELETE FROM doubt_post_saves WHERE id = $1::uuid`, [existing[0].id]);
    saved = false;
  } else {
    await queryNeon(
      `INSERT INTO doubt_post_saves (id, post_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
      [randomUUID(), postId, user.id],
    );
    saved = true;
    if (post.user_id !== user.id) {
      await createDoubtNotification({
        userId: post.user_id,
        type: "doubt_saved",
        actorUserId: user.id,
        message: `${actorName} saved your doubt post.`,
        targetKind: "doubt",
        relatedPostId: postId,
      });
    }
  }
  const row = await queryNeon<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM doubt_post_saves WHERE post_id = $1::uuid`,
    [postId],
  );
  return c.json({ ok: true, saved, savesCount: Number(row[0]?.count || 0) });
});

functionsRouter.get("/doubts/saved/list", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);

  const search = String(c.req.query("search") || "").trim();
  const category = String(c.req.query("category") || "").trim();
  const status = String(c.req.query("status") || "").trim();
  const sortRaw = String(c.req.query("sort") || "latest").trim().toLowerCase();
  const sort: "latest" | "most_answered" | "unanswered" =
    sortRaw === "most_answered" || sortRaw === "unanswered" ? (sortRaw as "most_answered" | "unanswered") : "latest";

  const where: string[] = ["s.user_id = $1::uuid"];
  const params: unknown[] = [user.id];
  let idx = 2;

  if (search) {
    where.push(`(p.title ILIKE $${idx} OR p.description ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx += 1;
  }
  if (category && category !== "all") {
    where.push(`p.category = $${idx}`);
    params.push(category);
    idx += 1;
  }
  if (status && status !== "all") {
    where.push(`p.status = $${idx}`);
    params.push(status);
    idx += 1;
  }
  if (sort === "unanswered" && (!status || status === "all")) {
    where.push(`(COALESCE(p.answer_count, 0) = 0 OR p.status = 'unanswered')`);
  }

  const orderSql =
    sort === "most_answered"
      ? "ORDER BY COALESCE(p.answer_count, 0) DESC, p.updated_at DESC, s.created_at DESC"
      : sort === "unanswered"
        ? "ORDER BY p.created_at DESC, p.updated_at DESC"
        : "ORDER BY s.created_at DESC";

  const rows = await queryNeon<{
    id: string;
    user_id: string;
    title: string;
    description: string;
    category: string;
    tags: string[] | null;
    image_url: string | null;
    answer_count: number;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    status: string;
    is_flagged: boolean;
    moderation_status: string;
    report_count: number;
    created_at: string;
    updated_at: string;
    saved_at: string;
    author_name: string | null;
  }>(
    `
    SELECT
      p.id::text, p.user_id::text, p.title, p.description, p.category, p.tags, p.image_url,
      p.answer_count,
      (SELECT COUNT(*) FROM doubt_post_likes l WHERE l.post_id = p.id) AS likes_count,
      (SELECT COUNT(*) FROM doubt_post_saves ds WHERE ds.post_id = p.id) AS saves_count,
      COALESCE(p.views_count, 0) AS views_count,
      (SELECT COUNT(*) FROM doubt_post_shares sh WHERE sh.post_id = p.id) AS shares_count,
      p.status, p.is_flagged, p.moderation_status, p.report_count,
      p.created_at::text, p.updated_at::text, s.created_at::text AS saved_at,
      COALESCE(pr.name, 'Aspirant') AS author_name
    FROM doubt_post_saves s
    JOIN doubt_posts p ON p.id = s.post_id
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE ${where.join(" AND ")}
    ${orderSql}
    `,
    params,
  );

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      description: r.description,
      preview: r.description.length > 220 ? `${r.description.slice(0, 220)}...` : r.description,
      category: r.category,
      tags: Array.isArray(r.tags) ? r.tags : [],
      imageUrl: r.image_url,
      answerCount: Number(r.answer_count || 0),
      likesCount: Number(r.likes_count || 0),
      savesCount: Number(r.saves_count || 0),
      viewsCount: Number(r.views_count || 0),
      sharesCount: Number(r.shares_count || 0),
      likedByViewer: false,
      savedByViewer: true,
      status: r.status,
      isFlagged: Boolean(r.is_flagged),
      moderationStatus: r.moderation_status,
      reportCount: Number(r.report_count || 0),
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      savedAt: r.saved_at,
      author: { id: r.user_id, name: r.author_name || "Aspirant" },
    })),
  });
});

functionsRouter.post("/doubts/:postId/share", async (c) => {
  await ensureDoubtEngagementSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  if (!postId) return c.json({ message: "postId is required" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const platform = normalizeSharePlatform(body?.platform);
  const postRows = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  await queryNeon(
    `INSERT INTO doubt_post_shares (id, post_id, user_id, platform) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)`,
    [randomUUID(), postId, user.id, platform],
  );

  const totalRows = await queryNeon<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM doubt_post_shares WHERE post_id = $1::uuid`,
    [postId],
  );

  if (post.user_id !== user.id) {
    await createDoubtNotification({
      userId: post.user_id,
      type: "doubt_shared",
      actorUserId: user.id,
      message: `${actorName} shared your doubt post.`,
      targetKind: "doubt",
      relatedPostId: postId,
    });
  }
  const platformRows = await queryNeon<{ platform: string; count: number }>(
    `SELECT platform, COUNT(*)::int AS count FROM doubt_post_shares WHERE post_id = $1::uuid GROUP BY platform`,
    [postId],
  );

  return c.json({
    ok: true,
    sharesCount: Number(totalRows[0]?.count || 0),
    platform,
    platformCounts: platformRows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.platform || "other")] = Number(row.count || 0);
      return acc;
    }, {}),
  });
});

functionsRouter.post("/doubts/:postId/update", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  const body = await c.req.json().catch(() => ({}));

  const title = String(body?.title ?? "").trim();
  const description = String(body?.description ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const tags = sanitizeTags(body?.tags);

  const existing = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  if (!existing[0]) return c.json({ message: "Doubt post not found" }, 404);
  if (existing[0].user_id !== user.id) return c.json({ message: "Only owner can update doubt." }, 403);

  if (!title || !description || !UPSC_CATEGORIES.includes(category as (typeof UPSC_CATEGORIES)[number])) {
    return c.json({ message: "Valid title, description and UPSC category are required." }, 400);
  }
  const contentCheck = analyzeUpscContent({ title, description, category });
  if (!contentCheck.allowed) return c.json({ message: contentCheck.warning }, 400);

  await queryNeon(
    `
    UPDATE doubt_posts
    SET title = $2, description = $3, category = $4, tags = $5,
        is_flagged = $6, moderation_status = $7, updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [postId, title, description, category, tags, contentCheck.flagged, contentCheck.moderationStatus],
  );

  return c.json({ ok: true, warning: contentCheck.warning || null });
});

functionsRouter.post("/doubts/:postId/delete", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();

  const existing = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  if (!existing[0]) return c.json({ message: "Doubt post not found" }, 404);
  if (existing[0].user_id !== user.id) return c.json({ message: "Only owner can delete doubt." }, 403);

  await queryNeon(`DELETE FROM doubt_posts WHERE id = $1::uuid`, [postId]);
  return c.json({ ok: true });
});

functionsRouter.post("/doubts/:postId/answers/create", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  if (!content || content.length < 10 || content.length > 6000) {
    return c.json({ message: "Answer must be between 10 and 6000 characters." }, 400);
  }

  const postRows = await queryNeon<{ user_id: string; title: string; category: string }>(
    `SELECT user_id::text, title, category FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const contentCheck = analyzeUpscContent({ content, category: post.category, title: post.title });
  if (!contentCheck.allowed) return c.json({ message: contentCheck.warning }, 400);

  const answerId = randomUUID();
  await queryNeon(
    `
    INSERT INTO doubt_answers
    (id, post_id, user_id, content, helpful_count, is_best_answer, is_flagged, moderation_status, report_count)
    VALUES ($1::uuid, $2::uuid, $3::uuid, $4, 0, FALSE, $5, $6, 0)
    `,
    [answerId, postId, user.id, content, contentCheck.flagged, contentCheck.moderationStatus],
  );
  await refreshDoubtPostMeta(postId);

  if (post.user_id !== user.id) {
    await createDoubtNotification({
      userId: post.user_id,
      type: "answer_received",
      actorUserId: user.id,
      message: `${actorName} answered your UPSC doubt.`,
      relatedPostId: postId,
      relatedAnswerId: answerId,
    });
  }

  return c.json({ ok: true, id: answerId, warning: contentCheck.warning || null });
});

functionsRouter.post("/answers/:answerId/update", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const answerId = String(c.req.param("answerId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const content = String(body?.content ?? "").trim();
  if (!content || content.length < 10 || content.length > 6000) {
    return c.json({ message: "Answer must be between 10 and 6000 characters." }, 400);
  }

  const rows = await queryNeon<{ user_id: string; post_id: string }>(
    `SELECT user_id::text, post_id::text FROM doubt_answers WHERE id = $1::uuid LIMIT 1`,
    [answerId],
  );
  const answer = rows[0];
  if (!answer) return c.json({ message: "Answer not found" }, 404);
  if (answer.user_id !== user.id) return c.json({ message: "Only owner can edit answer." }, 403);

  await queryNeon(
    `UPDATE doubt_answers SET content = $2, updated_at = NOW() WHERE id = $1::uuid`,
    [answerId, content],
  );
  return c.json({ ok: true });
});

functionsRouter.post("/answers/:answerId/delete", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const answerId = String(c.req.param("answerId") || "").trim();

  const rows = await queryNeon<{ user_id: string; post_id: string }>(
    `SELECT user_id::text, post_id::text FROM doubt_answers WHERE id = $1::uuid LIMIT 1`,
    [answerId],
  );
  const answer = rows[0];
  if (!answer) return c.json({ message: "Answer not found" }, 404);
  if (answer.user_id !== user.id) return c.json({ message: "Only owner can delete answer." }, 403);

  await queryNeon(`DELETE FROM doubt_answers WHERE id = $1::uuid`, [answerId]);
  await refreshDoubtPostMeta(answer.post_id);
  return c.json({ ok: true });
});

functionsRouter.post("/answers/:answerId/vote", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const answerId = String(c.req.param("answerId") || "").trim();

  const answerRows = await queryNeon<{ user_id: string; post_id: string }>(
    `SELECT user_id::text, post_id::text FROM doubt_answers WHERE id = $1::uuid LIMIT 1`,
    [answerId],
  );
  const answer = answerRows[0];
  if (!answer) return c.json({ message: "Answer not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const existingVote = await queryNeon<{ id: string }>(
    `SELECT id::text FROM doubt_answer_votes WHERE answer_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [answerId, user.id],
  );

  let voted = false;
  if (existingVote[0]?.id) {
    await queryNeon(`DELETE FROM doubt_answer_votes WHERE id = $1::uuid`, [existingVote[0].id]);
    await queryNeon(
      `UPDATE doubt_answers SET helpful_count = GREATEST(helpful_count - 1, 0), updated_at = NOW() WHERE id = $1::uuid`,
      [answerId],
    );
    voted = false;
  } else {
    await queryNeon(
      `INSERT INTO doubt_answer_votes (id, answer_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)`,
      [randomUUID(), answerId, user.id],
    );
    await queryNeon(
      `UPDATE doubt_answers SET helpful_count = helpful_count + 1, updated_at = NOW() WHERE id = $1::uuid`,
      [answerId],
    );
    voted = true;
    if (answer.user_id !== user.id) {
      await createDoubtNotification({
        userId: answer.user_id,
        type: "answer_liked",
        actorUserId: user.id,
        message: `${actorName} marked your answer as helpful.`,
        relatedPostId: answer.post_id,
        relatedAnswerId: answerId,
      });
    }
  }

  const latest = await queryNeon<{ helpful_count: number }>(
    `SELECT helpful_count FROM doubt_answers WHERE id = $1::uuid LIMIT 1`,
    [answerId],
  );

  return c.json({ ok: true, voted, helpfulCount: Number(latest[0]?.helpful_count || 0) });
});

functionsRouter.post("/doubts/:postId/best-answer", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const answerId = String(body?.answerId ?? "").trim();
  if (!answerId) return c.json({ message: "answerId is required" }, 400);

  const postRows = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM doubt_posts WHERE id = $1::uuid LIMIT 1`,
    [postId],
  );
  const post = postRows[0];
  if (!post) return c.json({ message: "Doubt post not found" }, 404);
  if (post.user_id !== user.id) return c.json({ message: "Only doubt owner can mark best answer." }, 403);

  const answerRows = await queryNeon<{ id: string; user_id: string }>(
    `SELECT id::text, user_id::text FROM doubt_answers WHERE id = $1::uuid AND post_id = $2::uuid LIMIT 1`,
    [answerId, postId],
  );
  const answer = answerRows[0];
  if (!answer) return c.json({ message: "Answer not found for this doubt." }, 404);
  const actorName = await getNotificationActorName(user.id);

  await queryNeon(`UPDATE doubt_answers SET is_best_answer = FALSE WHERE post_id = $1::uuid`, [postId]);
  await queryNeon(`UPDATE doubt_answers SET is_best_answer = TRUE, updated_at = NOW() WHERE id = $1::uuid`, [answerId]);
  await refreshDoubtPostMeta(postId);

  if (answer.user_id !== user.id) {
    await createDoubtNotification({
      userId: answer.user_id,
      type: "best_answer_selected",
      actorUserId: user.id,
      message: `${actorName} selected your answer as the best answer.`,
      relatedPostId: postId,
      relatedAnswerId: answerId,
    });
  }

  return c.json({ ok: true });
});

functionsRouter.get("/notifications", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const limit = Math.max(1, Math.min(100, Number(c.req.query("limit") || 30)));
  const rows = await queryNeon<{
    id: string;
    type: string;
    message: string;
    actor_user_id: string | null;
    target_kind: string;
    related_post_id: string | null;
    related_note_id: string | null;
    related_answer_id: string | null;
    is_read: boolean;
    created_at: string;
  }>(
    `
    SELECT id::text, type, message, actor_user_id::text, target_kind, related_post_id::text, related_note_id::text, related_answer_id::text, is_read, created_at::text
    FROM doubt_notifications
    WHERE user_id = $1::uuid
    ORDER BY created_at DESC
    LIMIT $2
    `,
    [user.id, limit],
  );
  const unreadRows = await queryNeon<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM doubt_notifications WHERE user_id = $1::uuid AND is_read = FALSE`,
    [user.id],
  );

  const items = await Promise.all(
    rows.map(async (r) => {
      const actorName = await resolveNotificationActorName(r);
      const raw = String(r.message || "");
      const needsRewrite = /^someone\b/i.test(raw) || /^your answer was selected\b/i.test(raw);
      return {
        id: r.id,
        type: r.type,
        message: needsRewrite ? formatNotificationMessage(r.type, actorName) : raw,
        targetKind: r.target_kind || "doubt",
        relatedPostId: r.related_post_id,
        relatedNoteId: r.related_note_id,
        relatedAnswerId: r.related_answer_id,
        isRead: Boolean(r.is_read),
        createdAt: toIsoFromDbTimestamp(r.created_at),
      };
    }),
  );

  return c.json({
    items,
    unreadCount: Number(unreadRows[0]?.count || 0),
  });
});

functionsRouter.post("/notifications/:notificationId/read", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const notificationId = String(c.req.param("notificationId") || "").trim();
  await queryNeon(
    `
    UPDATE doubt_notifications
    SET is_read = TRUE
    WHERE id = $1::uuid AND user_id = $2::uuid
    `,
    [notificationId, user.id],
  );
  return c.json({ ok: true });
});

functionsRouter.post("/notifications/read-all", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  await queryNeon(
    `UPDATE doubt_notifications SET is_read = TRUE WHERE user_id = $1::uuid AND is_read = FALSE`,
    [user.id],
  );
  return c.json({ ok: true });
});

functionsRouter.post("/doubts/:postId/report", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const postId = String(c.req.param("postId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").trim().toLowerCase();
  if (!validModerationReasons.has(reason)) return c.json({ message: "Invalid report reason." }, 400);

  await queryNeon(
    `INSERT INTO doubt_reports (id, reporter_id, target_type, target_id, reason) VALUES ($1::uuid, $2::uuid, 'post', $3::uuid, $4)`,
    [randomUUID(), user.id, postId, reason],
  );
  await queryNeon(
    `
    UPDATE doubt_posts
    SET report_count = report_count + 1,
        is_flagged = TRUE,
        moderation_status = CASE WHEN report_count + 1 >= 3 THEN 'needs_review' ELSE moderation_status END,
        updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [postId],
  );
  return c.json({ ok: true });
});

functionsRouter.post("/answers/:answerId/report", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const answerId = String(c.req.param("answerId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").trim().toLowerCase();
  if (!validModerationReasons.has(reason)) return c.json({ message: "Invalid report reason." }, 400);

  await queryNeon(
    `INSERT INTO doubt_reports (id, reporter_id, target_type, target_id, reason) VALUES ($1::uuid, $2::uuid, 'answer', $3::uuid, $4)`,
    [randomUUID(), user.id, answerId, reason],
  );
  await queryNeon(
    `
    UPDATE doubt_answers
    SET report_count = report_count + 1,
        is_flagged = TRUE,
        moderation_status = CASE WHEN report_count + 1 >= 3 THEN 'needs_review' ELSE moderation_status END,
        updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [answerId],
  );
  return c.json({ ok: true });
});

functionsRouter.post("/notes-feed/create", async (c) => {
  await ensureNotesFeedShareSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);

  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const tags = sanitizeTags(body?.tags);
  const imageUrls = Array.isArray(body?.imageUrls)
    ? body.imageUrls.map((u: unknown) => String(u ?? "").trim()).filter(Boolean).slice(0, 5)
    : [];

  if (!title || title.length < 10 || title.length > 180) {
    return c.json({ message: "Title must be between 10 and 180 characters." }, 400);
  }
  if (!content || content.length < 80 || content.length > 25000) {
    return c.json({ message: "Content must be between 80 and 25000 characters." }, 400);
  }
  if (!UPSC_CATEGORIES.includes(category as (typeof UPSC_CATEGORIES)[number])) {
    return c.json({ message: "Please select a valid UPSC category." }, 400);
  }

  const contentCheck = analyzeUpscContent({ title, content, category });
  if (!contentCheck.allowed) return c.json({ message: contentCheck.warning }, 400);

  const id = randomUUID();
  await queryNeon(
    `
    INSERT INTO notes_feed_posts
    (id, user_id, title, content, category, tags, image_urls, likes_count, saves_count, report_count, is_flagged, moderation_status)
    VALUES ($1::uuid, $2::uuid, $3, $4, $5, $6, $7, 0, 0, 0, $8, $9)
    `,
    [id, user.id, title, content, category, tags, imageUrls, contentCheck.flagged, contentCheck.moderationStatus],
  );

  return c.json({ ok: true, id, warning: contentCheck.warning || null });
});

functionsRouter.get("/notes-feed", async (c) => {
  await ensureNotesFeedShareSchema();
  const search = String(c.req.query("search") || "").trim();
  const category = String(c.req.query("category") || "").trim();
  const sortRaw = String(c.req.query("sort") || "latest").trim().toLowerCase();
  const sort: "latest" | "trending" | "most_saved" =
    sortRaw === "trending" || sortRaw === "most_saved" ? (sortRaw as "trending" | "most_saved") : "latest";
  const page = Math.max(1, Number(c.req.query("page") || 1));
  const limit = Math.max(1, Math.min(50, Number(c.req.query("limit") || 20)));
  const offset = (page - 1) * limit;

  const where: string[] = [`p.moderation_status <> 'hidden'`];
  const params: unknown[] = [];
  let idx = 1;

  if (search) {
    where.push(`(p.title ILIKE $${idx} OR p.content ILIKE $${idx} OR EXISTS (SELECT 1 FROM unnest(p.tags) t WHERE t ILIKE $${idx}))`);
    params.push(`%${search}%`);
    idx += 1;
  }
  if (category && category !== "all") {
    where.push(`p.category = $${idx}`);
    params.push(category);
    idx += 1;
  }

  const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
  const orderSql =
    sort === "trending"
      ? `ORDER BY (p.saves_count * 3 + p.likes_count * 2) DESC, p.created_at DESC`
      : sort === "most_saved"
        ? `ORDER BY p.saves_count DESC, p.created_at DESC`
        : `ORDER BY p.created_at DESC`;

  const rows = await queryNeon<{
    id: string;
    user_id: string;
    title: string;
    content: string;
    category: string;
    tags: string[] | null;
    image_urls: string[] | null;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    report_count: number;
    is_flagged: boolean;
    moderation_status: string;
    created_at: string;
    updated_at: string;
    author_name: string | null;
  }>(
    `
    SELECT
      p.id::text, p.user_id::text, p.title, p.content, p.category, p.tags, p.image_urls,
      p.likes_count, p.saves_count, COALESCE(p.views_count, 0) AS views_count,
      (SELECT COUNT(*) FROM notes_feed_shares sh WHERE sh.note_id = p.id) AS shares_count,
      p.report_count, p.is_flagged, p.moderation_status,
      p.created_at::text, p.updated_at::text, COALESCE(pr.name, 'Aspirant') AS author_name
    FROM notes_feed_posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    ${whereSql}
    ${orderSql}
    LIMIT $${idx} OFFSET $${idx + 1}
    `,
    [...params, limit, offset],
  );

  const countRows = await queryNeon<{ total: number }>(
    `SELECT COUNT(*)::int AS total FROM notes_feed_posts p ${whereSql}`,
    params,
  );
  const total = Number(countRows[0]?.total || 0);

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      content: r.content,
      preview: r.content.length > 280 ? `${r.content.slice(0, 280)}...` : r.content,
      category: r.category,
      tags: Array.isArray(r.tags) ? r.tags : [],
      imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
      likesCount: Number(r.likes_count || 0),
      savesCount: Number(r.saves_count || 0),
      viewsCount: Number(r.views_count || 0),
      sharesCount: Number(r.shares_count || 0),
      reportCount: Number(r.report_count || 0),
      isFlagged: Boolean(r.is_flagged),
      moderationStatus: r.moderation_status,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
      author: { id: r.user_id, name: r.author_name || "Aspirant" },
      trendingScore: Number(r.saves_count || 0) * 3 + Number(r.likes_count || 0) * 2,
    })),
    page,
    limit,
    total,
    hasMore: page * limit < total,
  });
});

functionsRouter.get("/notes-feed/:noteId", async (c) => {
  await ensureNotesFeedShareSchema();
  const noteId = String(c.req.param("noteId") || "").trim();
  if (!noteId) return c.json({ message: "noteId is required" }, 400);
  const user = await getSessionUser(c);

  const rows = await queryNeon<{
    id: string;
    user_id: string;
    title: string;
    content: string;
    category: string;
    tags: string[] | null;
    image_urls: string[] | null;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    report_count: number;
    is_flagged: boolean;
    moderation_status: string;
    created_at: string;
    updated_at: string;
    author_name: string | null;
    liked_by_viewer: number;
    saved_by_viewer: number;
  }>(
    `
    SELECT
      p.id::text, p.user_id::text, p.title, p.content, p.category, p.tags, p.image_urls,
      p.likes_count, p.saves_count, COALESCE(p.views_count, 0) AS views_count,
      (SELECT COUNT(*) FROM notes_feed_shares sh WHERE sh.note_id = p.id) AS shares_count,
      p.report_count, p.is_flagged, p.moderation_status,
      p.created_at::text, p.updated_at::text,
      COALESCE(pr.name, 'Aspirant') AS author_name,
      CASE WHEN $2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM notes_feed_likes l WHERE l.note_id = p.id AND l.user_id = $2::uuid) THEN 1 ELSE 0 END AS liked_by_viewer,
      CASE WHEN $2::uuid IS NOT NULL AND EXISTS (SELECT 1 FROM notes_feed_saves s WHERE s.note_id = p.id AND s.user_id = $2::uuid) THEN 1 ELSE 0 END AS saved_by_viewer
    FROM notes_feed_posts p
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE p.id = $1::uuid
    LIMIT 1
    `,
    [noteId, user?.id || null],
  );
  const note = rows[0];
  if (!note) return c.json({ message: "Note not found" }, 404);
  if (note.moderation_status === "hidden") return c.json({ message: "Note unavailable" }, 404);

  return c.json({
    item: {
      id: note.id,
      userId: note.user_id,
      title: note.title,
      content: note.content,
      category: note.category,
      tags: Array.isArray(note.tags) ? note.tags : [],
      imageUrls: Array.isArray(note.image_urls) ? note.image_urls : [],
      likesCount: Number(note.likes_count || 0),
      savesCount: Number(note.saves_count || 0),
      viewsCount: Number(note.views_count || 0),
      sharesCount: Number(note.shares_count || 0),
      reportCount: Number(note.report_count || 0),
      isFlagged: Boolean(note.is_flagged),
      moderationStatus: note.moderation_status,
      createdAt: note.created_at,
      updatedAt: note.updated_at,
      author: { id: note.user_id, name: note.author_name || "Aspirant" },
      likedByViewer: Number(note.liked_by_viewer || 0) > 0,
      savedByViewer: Number(note.saved_by_viewer || 0) > 0,
    },
  });
});

functionsRouter.post("/notes-feed/:noteId/update", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const title = String(body?.title ?? "").trim();
  const content = String(body?.content ?? "").trim();
  const category = String(body?.category ?? "").trim();
  const tags = sanitizeTags(body?.tags);

  const existing = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  if (!existing[0]) return c.json({ message: "Note not found" }, 404);
  if (existing[0].user_id !== user.id) return c.json({ message: "Only owner can update note." }, 403);

  if (!title || title.length < 10 || title.length > 180) {
    return c.json({ message: "Title must be between 10 and 180 characters." }, 400);
  }
  if (!content || content.length < 80 || content.length > 25000) {
    return c.json({ message: "Content must be between 80 and 25000 characters." }, 400);
  }
  if (!UPSC_CATEGORIES.includes(category as (typeof UPSC_CATEGORIES)[number])) {
    return c.json({ message: "Please select a valid UPSC category." }, 400);
  }
  const contentCheck = analyzeUpscContent({ title, content, category });
  if (!contentCheck.allowed) return c.json({ message: contentCheck.warning }, 400);

  await queryNeon(
    `
    UPDATE notes_feed_posts
    SET title = $2, content = $3, category = $4, tags = $5,
        is_flagged = $6, moderation_status = $7, updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [noteId, title, content, category, tags, contentCheck.flagged, contentCheck.moderationStatus],
  );
  return c.json({ ok: true, warning: contentCheck.warning || null });
});

functionsRouter.post("/notes-feed/:noteId/delete", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();

  const existing = await queryNeon<{ user_id: string }>(
    `SELECT user_id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  if (!existing[0]) return c.json({ message: "Note not found" }, 404);
  if (existing[0].user_id !== user.id) return c.json({ message: "Only owner can delete note." }, 403);

  await queryNeon(`DELETE FROM notes_feed_posts WHERE id = $1::uuid`, [noteId]);
  return c.json({ ok: true });
});

functionsRouter.post("/notes-feed/:noteId/like", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();

  const noteRows = await queryNeon<{ id: string; user_id: string }>(
    `SELECT id::text, user_id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  const note = noteRows[0];
  if (!note) return c.json({ message: "Note not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const existing = await queryNeon<{ id: string }>(
    `SELECT id::text FROM notes_feed_likes WHERE note_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [noteId, user.id],
  );
  let liked = false;
  if (existing[0]?.id) {
    await queryNeon(`DELETE FROM notes_feed_likes WHERE id = $1::uuid`, [existing[0].id]);
    await queryNeon(`UPDATE notes_feed_posts SET likes_count = GREATEST(likes_count - 1, 0), updated_at = NOW() WHERE id = $1::uuid`, [noteId]);
    liked = false;
  } else {
    await queryNeon(`INSERT INTO notes_feed_likes (id, note_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)`, [randomUUID(), noteId, user.id]);
    await queryNeon(`UPDATE notes_feed_posts SET likes_count = likes_count + 1, updated_at = NOW() WHERE id = $1::uuid`, [noteId]);
    liked = true;
    if (note.user_id !== user.id) {
      await createDoubtNotification({
        userId: note.user_id,
        type: "note_liked",
        actorUserId: user.id,
        message: `${actorName} liked your notes post.`,
        targetKind: "notes",
        relatedNoteId: noteId,
      });
    }
  }

  const latest = await queryNeon<{ likes_count: number }>(`SELECT likes_count FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`, [noteId]);
  return c.json({ ok: true, liked, likesCount: Number(latest[0]?.likes_count || 0) });
});

functionsRouter.post("/notes-feed/:noteId/save", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();

  const noteRows = await queryNeon<{ id: string; user_id: string }>(
    `SELECT id::text, user_id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  const note = noteRows[0];
  if (!note) return c.json({ message: "Note not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  const existing = await queryNeon<{ id: string }>(
    `SELECT id::text FROM notes_feed_saves WHERE note_id = $1::uuid AND user_id = $2::uuid LIMIT 1`,
    [noteId, user.id],
  );
  let saved = false;
  if (existing[0]?.id) {
    await queryNeon(`DELETE FROM notes_feed_saves WHERE id = $1::uuid`, [existing[0].id]);
    await queryNeon(`UPDATE notes_feed_posts SET saves_count = GREATEST(saves_count - 1, 0), updated_at = NOW() WHERE id = $1::uuid`, [noteId]);
    saved = false;
  } else {
    await queryNeon(`INSERT INTO notes_feed_saves (id, note_id, user_id) VALUES ($1::uuid, $2::uuid, $3::uuid)`, [randomUUID(), noteId, user.id]);
    await queryNeon(`UPDATE notes_feed_posts SET saves_count = saves_count + 1, updated_at = NOW() WHERE id = $1::uuid`, [noteId]);
    saved = true;
    if (note.user_id !== user.id) {
      await createDoubtNotification({
        userId: note.user_id,
        type: "note_saved",
        actorUserId: user.id,
        message: `${actorName} saved your notes post.`,
        targetKind: "notes",
        relatedNoteId: noteId,
      });
    }
  }

  const latest = await queryNeon<{ saves_count: number }>(`SELECT saves_count FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`, [noteId]);
  return c.json({ ok: true, saved, savesCount: Number(latest[0]?.saves_count || 0) });
});

functionsRouter.post("/notes-feed/:noteId/share", async (c) => {
  await ensureNotesFeedShareSchema();
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();
  if (!noteId) return c.json({ message: "noteId is required" }, 400);
  const body = await c.req.json().catch(() => ({}));
  const platform = normalizeSharePlatform(body?.platform);

  const noteRows = await queryNeon<{ id: string; user_id: string }>(
    `SELECT id::text, user_id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  const note = noteRows[0];
  if (!note) return c.json({ message: "Note not found" }, 404);
  const actorName = await getNotificationActorName(user.id);

  await queryNeon(
    `INSERT INTO notes_feed_shares (id, note_id, user_id, platform) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)`,
    [randomUUID(), noteId, user.id, platform],
  );

  const totalRows = await queryNeon<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM notes_feed_shares WHERE note_id = $1::uuid`,
    [noteId],
  );
  const platformRows = await queryNeon<{ platform: string; count: number }>(
    `SELECT platform, COUNT(*)::int AS count FROM notes_feed_shares WHERE note_id = $1::uuid GROUP BY platform`,
    [noteId],
  );

  if (note.user_id !== user.id) {
    await createDoubtNotification({
      userId: note.user_id,
      type: "note_shared",
      actorUserId: user.id,
      message: `${actorName} shared your notes post.`,
      targetKind: "notes",
      relatedNoteId: noteId,
    });
  }

  return c.json({
    ok: true,
    sharesCount: Number(totalRows[0]?.count || 0),
    platform,
    platformCounts: platformRows.reduce<Record<string, number>>((acc, row) => {
      acc[String(row.platform || "other")] = Number(row.count || 0);
      return acc;
    }, {}),
  });
});

functionsRouter.post("/notes-feed/:noteId/view", async (c) => {
  await ensureNotesFeedShareSchema();
  const noteId = String(c.req.param("noteId") || "").trim();
  if (!noteId) return c.json({ message: "noteId is required" }, 400);

  await queryNeon(
    `UPDATE notes_feed_posts SET views_count = COALESCE(views_count, 0) + 1, updated_at = CURRENT_TIMESTAMP WHERE id = $1::uuid`,
    [noteId],
  );
  const row = await queryNeon<{ count: number }>(
    `SELECT COALESCE(views_count, 0)::int AS count FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`,
    [noteId],
  );
  return c.json({ ok: true, viewsCount: Number(row[0]?.count || 0) });
});

functionsRouter.get("/notes-feed/saved/list", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const search = String(c.req.query("search") || "").trim();
  const category = String(c.req.query("category") || "").trim();
  const sortRaw = String(c.req.query("sort") || "latest").trim().toLowerCase();
  const sort: "latest" | "trending" | "most_saved" =
    sortRaw === "trending" || sortRaw === "most_saved" ? (sortRaw as "trending" | "most_saved") : "latest";

  const where = [`s.user_id = $1::uuid`, `p.moderation_status <> 'hidden'`];
  const params: unknown[] = [user.id];
  let idx = 2;
  if (search) {
    where.push(`(p.title ILIKE $${idx} OR p.content ILIKE $${idx})`);
    params.push(`%${search}%`);
    idx += 1;
  }
  if (category && category !== "all") {
    where.push(`p.category = $${idx}`);
    params.push(category);
  }

  const orderSql =
    sort === "trending"
      ? "ORDER BY (COALESCE(p.saves_count, 0) * 3 + COALESCE(p.likes_count, 0) * 2) DESC, p.updated_at DESC, p.created_at DESC"
      : sort === "most_saved"
        ? "ORDER BY COALESCE(p.saves_count, 0) DESC, p.updated_at DESC, p.created_at DESC"
        : "ORDER BY s.created_at DESC";

  const rows = await queryNeon<{
    id: string;
    user_id: string;
    title: string;
    content: string;
    category: string;
    tags: string[] | null;
    image_urls: string[] | null;
    likes_count: number;
    saves_count: number;
    views_count: number;
    shares_count: number;
    created_at: string;
    author_name: string | null;
    saved_at: string;
  }>(
    `
    SELECT
      p.id::text, p.user_id::text, p.title, p.content, p.category, p.tags, p.image_urls,
      p.likes_count, p.saves_count, COALESCE(p.views_count, 0) AS views_count,
      (SELECT COUNT(*) FROM notes_feed_shares sh WHERE sh.note_id = p.id) AS shares_count,
      p.created_at::text,
      COALESCE(pr.name, 'Aspirant') AS author_name, s.created_at::text AS saved_at
    FROM notes_feed_saves s
    JOIN notes_feed_posts p ON p.id = s.note_id
    LEFT JOIN profiles pr ON pr.id = p.user_id
    WHERE ${where.join(" AND ")}
    ${orderSql}
    `,
    params,
  );

  return c.json({
    items: rows.map((r) => ({
      id: r.id,
      userId: r.user_id,
      title: r.title,
      content: r.content,
      preview: r.content.length > 280 ? `${r.content.slice(0, 280)}...` : r.content,
      category: r.category,
      tags: Array.isArray(r.tags) ? r.tags : [],
      imageUrls: Array.isArray(r.image_urls) ? r.image_urls : [],
      likesCount: Number(r.likes_count || 0),
      savesCount: Number(r.saves_count || 0),
      viewsCount: Number(r.views_count || 0),
      sharesCount: Number(r.shares_count || 0),
      createdAt: r.created_at,
      savedAt: r.saved_at,
      author: { id: r.user_id, name: r.author_name || "Aspirant" },
      trendingScore: Number(r.saves_count || 0) * 3 + Number(r.likes_count || 0) * 2,
    })),
  });
});

functionsRouter.post("/notes-feed/:noteId/report", async (c) => {
  const user = await getSessionUser(c);
  if (!user?.id) return c.json({ message: "Unauthorized" }, 401);
  const noteId = String(c.req.param("noteId") || "").trim();
  const body = await c.req.json().catch(() => ({}));
  const reason = String(body?.reason ?? "").trim().toLowerCase();
  if (!validModerationReasons.has(reason)) return c.json({ message: "Invalid report reason." }, 400);

  const noteRows = await queryNeon<{ id: string }>(`SELECT id::text FROM notes_feed_posts WHERE id = $1::uuid LIMIT 1`, [noteId]);
  if (!noteRows[0]) return c.json({ message: "Note not found" }, 404);

  await queryNeon(
    `INSERT INTO notes_feed_reports (id, note_id, user_id, reason) VALUES ($1::uuid, $2::uuid, $3::uuid, $4)`,
    [randomUUID(), noteId, user.id, reason],
  );
  await queryNeon(
    `
    UPDATE notes_feed_posts
    SET report_count = report_count + 1,
        is_flagged = TRUE,
        moderation_status = CASE WHEN report_count + 1 >= 3 THEN 'needs_review' ELSE moderation_status END,
        updated_at = NOW()
    WHERE id = $1::uuid
    `,
    [noteId],
  );

  return c.json({ ok: true });
});

functionsRouter.post("/db/select", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await dbSelect({
      table: String(body?.table ?? ""),
      filters: Array.isArray(body?.filters) ? body.filters : [],
      order: body?.order ?? null,
      limit: body?.limit ?? null,
    });
    return c.json({ data, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Select failed" } }, 400);
  }
});

functionsRouter.post("/db/insert", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const data = await dbInsert(String(body?.table ?? ""), rows);
    return c.json({ data, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Insert failed" } }, 400);
  }
});

functionsRouter.post("/db/upsert", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const rows = Array.isArray(body?.rows) ? body.rows : [];
    const data = await dbUpsert(String(body?.table ?? ""), rows);
    return c.json({ data, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Upsert failed" } }, 400);
  }
});

functionsRouter.post("/db/update", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await dbUpdate({
      table: String(body?.table ?? ""),
      patch: body?.patch ?? {},
      filters: Array.isArray(body?.filters) ? body.filters : [],
    });
    return c.json({ data, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Update failed" } }, 400);
  }
});

functionsRouter.post("/db/delete", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  try {
    const data = await dbDelete({
      table: String(body?.table ?? ""),
      filters: Array.isArray(body?.filters) ? body.filters : [],
    });
    return c.json({ data, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Delete failed" } }, 400);
  }
});

functionsRouter.post("/storage/upload", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const bucket = String(body?.bucket ?? "default");
  const filePath = String(body?.path ?? "");
  const base64 = String(body?.base64 ?? "");
  if (!filePath || !base64) return c.json({ data: null, error: { message: "path and base64 are required" } }, 400);

  try {
    saveBase64File(bucket, filePath, base64);
    const publicUrl = getStoragePublicPath(bucket, filePath);
    return c.json({ data: { path: filePath, publicUrl }, error: null });
  } catch (error: any) {
    return c.json({ data: null, error: { message: error?.message || "Upload failed" } }, 400);
  }
});

functionsRouter.post("/storage/remove", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const bucket = String(body?.bucket ?? "default");
  const paths = Array.isArray(body?.paths) ? (body.paths as unknown[]).map((p: unknown) => String(p)) : [];
  const removed = paths.map((p) => ({ path: p, removed: deleteFile(bucket, p) }));
  return c.json({ data: removed, error: null });
});

functionsRouter.get("/profiles", async (c) => {
  const limit = Number(c.req.query("limit") ?? 100);
  const offset = Number(c.req.query("offset") ?? 0);
  const profiles = await listProfiles(limit, offset);
  return c.json({ profiles, count: profiles.length });
});

functionsRouter.get("/profiles/:id", async (c) => {
  const id = c.req.param("id");
  const profile = await getProfileById(id);
  if (!profile) return c.json({ error: "Profile not found" }, 404);
  return c.json(profile);
});

functionsRouter.post("/profiles/upsert", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const profile = body?.profile;
  if (!profile?.id || !profile?.name) {
    return c.json({ error: "profile.id and profile.name are required" }, 400);
  }

  const result = await upsertProfiles([profile]);
  await persistLog("profiles/upsert", body, result);
  return c.json({ ok: true, ...result });
});

functionsRouter.post("/profiles/import-csv", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const csv = body?.csv;
  if (typeof csv !== "string" || !csv.trim()) {
    return c.json({ error: "csv text is required" }, 400);
  }

  const profiles = parseProfilesCsv(csv);
  if (!profiles.length) {
    return c.json({ error: "No valid profile rows found in CSV" }, 400);
  }

  const result = await upsertProfiles(profiles);
  const response = { ok: true, parsed: profiles.length, ...result };
  await persistLog("profiles/import-csv", { rows: profiles.length }, response);
  return c.json(response);
});

functionsRouter.post("/ai-chat", async (c) => {
  const body = await c.req.json();
  const messages = body?.messages ?? [];
  const chatType = body?.chatType ?? "mentor";
  const system = `You are UPSC-focused AI mentor. Keep answers concise and exam-ready. Chat type: ${chatType}.`;
  const text = await withCache("ai-chat", body, () =>
    generateText([{ role: "system", content: system }, ...messages]),
  );
  const response = { text };
  await persistLog("ai-chat", body, response);
  return c.json(response);
});

functionsRouter.post("/ai-generate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const messages = Array.isArray(body?.messages) ? body.messages : [];
  if (!messages.length) {
    return c.json({ text: "", error: { message: "messages are required" } }, 400);
  }

  try {
    const text = await generateText(messages, Number(body?.temperature ?? 0.2));
    const response = { text };
    await persistLog("ai-generate", { count: messages.length }, response);
    return c.json(response);
  } catch (error: any) {
    return c.json({ text: "", error: { message: error?.message || "AI generation failed" } }, 500);
  }
});

functionsRouter.get("/ai-health", async (c) => {
  return c.json({
    ok: true,
    provider: "xai",
    model: config.xaiModel || "grok-2-latest",
    hasXaiKey: hasXai,
  });
});

functionsRouter.get("/history-rag/stats", async (c) => {
  return c.json(getHistoryRagStats());
});

functionsRouter.post("/history-rag/ingest", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const chunks = Array.isArray(body?.chunks) ? body.chunks : [];
  const result = ingestHistoryChunks(chunks);
  return c.json({ ok: true, ...result });
});

functionsRouter.post("/history-rag/query", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const question = String(body?.question ?? "").trim();
  if (!question) return c.json({ error: "question is required" }, 400);
  const result = await queryHistoryRag(question);
  return c.json(result);
});

functionsRouter.get("/notes-rag/stats", async (c) => {
  const subjectId = String(c.req.query("subjectId") ?? "").trim();
  if (!subjectId) return c.json({ error: "subjectId is required" }, 400);
  const stats = await getSubjectRagStats(subjectId);
  return c.json(stats);
});

functionsRouter.post("/notes-rag/stats", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const subjectId = String(body?.subjectId ?? "").trim();
  if (!subjectId) return c.json({ error: "subjectId is required" }, 400);
  const stats = await getSubjectRagStats(subjectId);
  return c.json(stats);
});

functionsRouter.post("/notes-rag/ingest-pdf", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const subjectId = String(body?.subjectId ?? "").trim();
  const subjectName = String(body?.subjectName ?? "").trim();
  const sourceName = String(body?.sourceName ?? body?.fileName ?? "").trim() || `${subjectName || "Subject"} Book`;
  const pdfBase64 = String(body?.pdfBase64 ?? "").trim();
  const replaceExisting = body?.replaceExisting !== false;

  if (!subjectId || !subjectName || !pdfBase64) {
    return c.json({ ok: false, error: "subjectId, subjectName and pdfBase64 are required" }, 400);
  }

  const result = await ingestSubjectPdf({
    subjectId,
    subjectName,
    sourceName,
    pdfBase64,
    replaceExisting,
  });
  const status = result.ok ? 200 : 400;
  return c.json(result, status);
});

functionsRouter.post("/notes-rag/generate", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const subjectId = String(body?.subjectId ?? "").trim();
  const subjectName = String(body?.subjectName ?? "").trim();
  const topic = String(body?.topic ?? "").trim();
  const slides = Number(body?.slides ?? 18);

  if (!subjectId || !subjectName || !topic) {
    return c.json({ ok: false, error: "subjectId, subjectName and topic are required" }, 400);
  }

  const result = await generateSubjectRagNotes({
    subjectId,
    subjectName,
    topic,
    slideCount: slides,
  });
  if (!result.ok) return c.json(result, 400);
  return c.json(result);
});

functionsRouter.post("/notes-rag/answer", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const subjectId = String(body?.subjectId ?? "").trim();
  const subjectName = String(body?.subjectName ?? "").trim();
  const topic = String(body?.topic ?? "").trim();

  if (!subjectId || !subjectName || !topic) {
    return c.json({ ok: false, error: "subjectId, subjectName and topic are required" }, 400);
  }

  const result = await generateSubjectBookAnswer({ subjectId, subjectName, topic });
  if (!result.ok) return c.json(result, 400);
  return c.json(result);
});

functionsRouter.post("/generate-prelims-questions", async (c) => {
  const body = await c.req.json();
  const level = Number(body?.level ?? 1);
  const subject = body?.subject ?? "Indian Polity";
  const count = Number(body?.count ?? 5);

  const fallback = {
    questions: Array.from({ length: count }).map((_, i) => ({
      id: randomUUID(),
      question: `${subject} practice question ${i + 1} (Level ${level})`,
      option_a: "Option A",
      option_b: "Option B",
      option_c: "Option C",
      option_d: "Option D",
      correct_answer: "A",
      explanation: "This is a fallback explanation."
        + " Replace with your own source-backed explanation in production.",
      subject,
      topic: "General",
      difficulty: `Level ${level}`,
    })),
    level,
    subject,
  };

  const prompt = `Generate ${count} UPSC prelims MCQs for ${subject} at level ${level}. Return strict JSON:\n{"questions":[{"question":"","option_a":"","option_b":"","option_c":"","option_d":"","correct_answer":"A","explanation":"","subject":"","topic":"","difficulty":""}]}`;

  const result = await withCache("generate-prelims-questions", body, () =>
    generateJson([{ role: "system", content: "Return strict JSON only." }, { role: "user", content: prompt }], fallback, 0.7),
  );

  await persistLog("generate-prelims-questions", body, result);
  return c.json(result);
});

functionsRouter.post("/mains-question", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const category = body?.category ?? "General Studies";
  const questionText = await withCache("mains-question", body, () =>
    safeAi(
      "Generate one UPSC mains question only.",
      `Category: ${category}`,
      `Discuss a major contemporary issue in ${category} with suitable examples.`,
    ),
  );

  const response = {
    id: randomUUID(),
    question_text: questionText,
    category,
    word_limit: 250,
    date: nowIso().slice(0, 10),
  };
  await persistLog("mains-question", body, response);
  return c.json(response);
});

functionsRouter.post("/map-questions", async (c) => {
  const body = await c.req.json();
  const mapType = body?.mapType ?? "india";
  const level = Number(body?.level ?? 1);
  const count = Number(body?.count ?? 5);

  const seed = mapType === "world" ? "World" : "India";
  const questions = Array.from({ length: count }).map((_, i) => ({
    id: randomUUID(),
    question: `${seed} map question ${i + 1} (Level ${level})`,
    options: ["Option A", "Option B", "Option C", "Option D"],
    correct: i % 4,
    explanation: `Explanation for ${seed} map question ${i + 1}.`,
  }));

  const response = { questions, mapType, level };
  await persistLog("map-questions", body, response);
  return c.json(response);
});

functionsRouter.post("/mind-map-generator", async (c) => {
  const body = await c.req.json();
  const topic = body?.topic ?? "Indian Polity";

  const fallback = {
    mindMap: {
      id: "root",
      label: topic,
      children: [
        {
          id: "c1",
          label: "Core Concepts",
          children: [
            { id: "c1-1", label: "Definition" },
            { id: "c1-2", label: "Features" },
          ],
        },
        {
          id: "c2",
          label: "UPSC Relevance",
          children: [
            { id: "c2-1", label: "Prelims" },
            { id: "c2-2", label: "Mains" },
          ],
        },
      ],
    },
  };

  const response = await withCache("mind-map-generator", body, () =>
    generateJson(
      [
        { role: "system", content: "Return JSON with { mindMap: { id, label, children[] } } only." },
        { role: "user", content: `Create a UPSC mind map for ${topic}.` },
      ],
      fallback,
      0.3,
    ),
  );

  await persistLog("mind-map-generator", body, response);
  return c.json(response);
});

functionsRouter.post("/optional-professor", async (c) => {
  const body = await c.req.json();
  const mode = body?.mode ?? "explain";
  const subject = body?.subject ?? "Public Administration";

  let response: any;

  if (mode === "trends") {
    response = {
      recurringTopics: ["Governance", "Accountability", "Ethics in Administration"],
      predictions: ["Digital governance and public service delivery", "Civil service reforms"],
      ignoredTopics: ["Comparative Public Administration"],
      yearWiseBreakdown: [
        { topic: "Governance", frequency: 7 },
        { topic: "Administrative Thinkers", frequency: 5 },
      ],
      strategy: "Prioritize high-frequency themes, integrate current affairs, and practice 250-word answers.",
    };
  } else if (mode === "evaluate") {
    response = {
      score: 12,
      breakdown: { structure: 3, content: 3, analysis: 3, examples: 3 },
      strengths: ["Relevant introduction", "Balanced conclusion"],
      improvements: ["Add thinkers/case studies", "Improve sub-headings"],
      feedback: "Good attempt. Improve depth with optional-specific frameworks and examples.",
      modelAnswer: "Start with definition, explain dimensions, add case evidence, and conclude with way forward.",
    };
  } else if (mode === "daily-practice") {
    response = {
      question: `Discuss a contemporary issue in ${subject} with suitable illustrations.`,
      type: "Long Answer",
      marks: 20,
      hint: "Use intro-body-conclusion with one relevant case study.",
    };
  } else if (mode === "revision") {
    const topic = body?.topic ?? "General Topic";
    response = {
      topic,
      keyPoints: ["Definition", "Key dimensions", "Challenges", "Way forward"],
      mindMap: `${topic} -> Dimensions -> Issues -> Reforms`,
      oneLiners: ["Keep answer structured", "Use examples", "Conclude positively"],
      importantFacts: ["Committee recommendations", "Recent policy updates"],
      pyqConnection: "Often asked in analytical form with governance linkage.",
    };
  } else {
    const topic = body?.topic ?? "General topic";
    const overview = await withCache("optional-professor-explain", body, () =>
      safeAi(
        `You are optional subject professor for ${subject}.`,
        `Explain topic: ${topic}`,
        `${topic} is an important area in ${subject}. Cover meaning, dimensions, examples, and UPSC relevance.`,
      ),
    );

    response = {
      overview,
      keyPoints: ["Definition and scope", "Dimensions", "Debates", "Examples"],
      examples: ["Indian context", "Comparative case"],
      upscRelevance: "Useful for both conceptual and analytical optional questions.",
      diagram: `${topic}\n|- Core concept\n|- Dimensions\n|- Applications`,
    };
  }

  await persistLog("optional-professor", body, response);
  return c.json(response);
});

functionsRouter.post("/pyq-analysis", async (c) => {
  const body = await c.req.json();
  const examType = body?.examType ?? "prelims";
  const subject = body?.subject ?? "Indian Polity";
  const level = Number(body?.level ?? 1);

  const prelimQuestions = Array.from({ length: 20 }).map((_, i) => ({
    id: randomUUID(),
    year: 2000 + (i % 24),
    question: `${subject} PYQ style MCQ ${i + 1}`,
    options: ["Statement 1 only", "Statement 2 only", "Both 1 and 2", "Neither 1 nor 2"],
    correctAnswer: ["A", "B", "C", "D"][i % 4],
    explanation: "PYQ-style explanation with elimination logic.",
    subject,
    difficulty: i % 3 === 0 ? "hard" : i % 2 === 0 ? "medium" : "easy",
    level,
  }));

  const descriptiveQuestions = Array.from({ length: 8 }).map((_, i) => ({
    id: randomUUID(),
    year: 2005 + i,
    question: `${examType.toUpperCase()} descriptive PYQ ${i + 1} on ${subject}`,
    subject,
    difficulty: i % 2 === 0 ? "medium" : "hard",
    wordLimit: examType === "essay" ? 1000 : 250,
    expectedApproach: "Define, analyze, support with examples, conclude with way forward.",
  }));

  const response = {
    trends: [
      { subject, weightage: 24, trend: "rising", yearsAnalyzed: "2013-2025", keyInsight: "Conceptual + current-affairs blend." },
      { subject: "Governance", weightage: 18, trend: "stable", yearsAnalyzed: "2013-2025", keyInsight: "Applied questions continue." },
    ],
    predictions: [
      { topic: `${subject} basics with current context`, probability: "high", questionType: "Concept + application", reasoning: "Repeated PYQ pattern." },
      { topic: "Interdisciplinary linkage", probability: "medium", questionType: "Analytical", reasoning: "Growing trend in recent papers." },
    ],
    strategy: [
      { priority: 1, action: "Revise top PYQ clusters", reason: "High repetition probability", timeframe: "7 days" },
      { priority: 2, action: "Write 2 answers/day", reason: "Retention + articulation", timeframe: "14 days" },
    ],
    pyqQuestions: examType === "prelims" ? prelimQuestions : descriptiveQuestions,
  };

  await persistLog("pyq-analysis", body, response);
  return c.json(response);
});

functionsRouter.post("/upsc-notes-slides", async (c) => {
  const body = await c.req.json();
  const subject = body?.subject ?? "Indian Polity";
  const topic = body?.topic ?? "Fundamental Rights";
  const slideCountInput = Number(body?.slides ?? 18);
  const slideCount = Number.isFinite(slideCountInput) ? Math.min(20, Math.max(15, slideCountInput)) : 18;

  const fallback = {
    topicTitle: topic,
    chapterTitle: subject,
    slides: Array.from({ length: slideCount }).map((_, i) => ({
      slideNumber: i + 1,
      topicName: topic,
      subtopicTitle: `${topic} - Slide ${i + 1}`,
      structuredExplanation: `Structured explanation ${i + 1} for ${topic} with UPSC prelims + mains orientation.`,
      points: [
        `${topic}: core concept ${i + 1}`,
        `${topic}: relevant constitutional/factual linkage`,
        `${topic}: exam application (prelims + mains)`,
      ],
      keyTakeaway: `Key takeaway ${i + 1} for revision.`,
    })),
    checkpointQuestions: Array.from({ length: Math.floor(slideCount / 3) }).map((_, i) => ({
      afterSlide: (i + 1) * 3,
      type: "short",
      question: `Checkpoint ${i + 1}: Explain one core concept from slides ${(i + 1) * 3 - 2} to ${(i + 1) * 3}.`,
      correctAnswer: "core concept",
      acceptableAnswers: ["definition", "feature", "significance", "challenge"],
      explanation: "Mention meaning + one example + one exam-useful point.",
    })),
    practiceQuestions: Array.from({ length: 10 }).map((_, i) => ({
      questionText: `${topic} practice question ${i + 1}`,
      difficulty: i < 3 ? "Easy" : i < 7 ? "Medium" : "Hard",
      type: i < 4 ? "Prelims" : i < 8 ? "Mains" : "Analytical",
      answer: "Model answer with intro, body, and conclusion.",
      explanation: "Use factual anchors and analytical framing.",
      keyPoints: ["Definition", "Body points", "Examples", "Way forward"],
    })),
    revisionSummary: [
      `Revise the complete flow of ${topic}.`,
      "Separate prelims facts and mains analysis.",
      "Practice one short and one long answer.",
    ],
    generatedAt: nowIso(),
  };

  const response = await withCache("upsc-notes-slides", body, () =>
    generateJson(
      [
        {
          role: "system",
          content:
            "You are a UPSC notes generator. Return only strict JSON with keys: topicTitle, chapterTitle, slides, checkpointQuestions, practiceQuestions, revisionSummary, generatedAt.",
        },
        {
          role: "user",
          content:
            `Generate UPSC Smart Notes for subject "${subject}" and topic "${topic}". ` +
            `Create exactly ${slideCount} slides. For each slide include slideNumber, topicName, subtopicTitle, structuredExplanation, points (3 to 5 items), keyTakeaway. ` +
            `Add checkpointQuestions after every 3 slides with answerable correctAnswer, acceptableAnswers and explanation. ` +
            `Add exactly 10 practiceQuestions with type in [Prelims, Mains, Analytical], difficulty in [Easy, Medium, Hard], and include answer/explanation/keyPoints. ` +
            "Keep quality exam-ready for UPSC Prelims and Mains.",
        },
      ],
      fallback,
      0.2,
    ),
  );

  await persistLog("upsc-notes-slides", body, response);
  return c.json(response);
});

functionsRouter.post("/generate-current-affairs", async (c) => {
  const body = await c.req.json();
  const type = body?.type ?? "daily";
  const topic = body?.topic ?? "General";

  const affairs = Array.from({ length: type === "weekly" ? 12 : 8 }).map((_, i) => ({
    id: randomUUID(),
    title: `${type === "topic" ? topic : "UPSC"} Current Affair ${i + 1}`,
    summary: "Brief summary relevant for UPSC preparation.",
    full_content: "Detailed context, constitutional linkage, and exam relevance.",
    date: nowIso(),
    category: type === "topic" ? topic : ["Polity", "Economy", "Environment", "International Relations"][i % 4],
    importance_level: i % 3 === 0 ? "high" : "medium",
    tags: ["GS2", "Prelims", "Mains"],
  }));

  const response = { affairs, type };
  await persistLog("generate-current-affairs", body, response);
  return c.json(response);
});

functionsRouter.post("/daily-intel-report", async (c) => {
  const body = await c.req.json().catch(() => ({}));

  const fallback = {
    report: {
      date: nowIso(),
      sections: [
        {
          title: "Governance & Polity",
          icon: "shield",
          items: [
            { headline: "Policy update", detail: "Key governance update relevant for GS2.", upscTag: "GS2" },
            { headline: "Court development", detail: "Important constitutional angle for mains.", upscTag: "GS2" },
          ],
        },
        {
          title: "Economy & Development",
          icon: "trending",
          items: [
            { headline: "Economic indicator", detail: "Macro trend and UPSC implication.", upscTag: "GS3" },
          ],
        },
      ],
      oneLineNotes: ["Revise linked static concepts", "Prepare 150-word note", "Practice one MCQ set"],
    },
  };

  const response = await withCache("daily-intel-report", body, async () => fallback);
  await persistLog("daily-intel-report", body, response);
  return c.json(response);
});

functionsRouter.post("/check-subscription", async (c) => {
  const response = {
    is_subscribed: true,
    subscription: {
      id: randomUUID(),
      user_id: "local-user-1",
      razorpay_subscription_id: "sub_local_123",
      plan_type: "monthly",
      status: "active",
      start_date: nowIso(),
      end_date: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30).toISOString(),
      amount: 99,
      currency: "INR",
    },
    payments: [],
    user_email: "aspirant@local.app",
  };
  await persistLog("check-subscription", {}, response);
  return c.json(response);
});

functionsRouter.post("/create-subscription", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const response = {
    key_id: "rzp_test_local_key",
    subscription_id: `sub_${randomUUID().slice(0, 8)}`,
    user_email: "aspirant@local.app",
    plan_type: body?.plan_type || "monthly",
  };
  await persistLog("create-subscription", body, response);
  return c.json(response);
});

functionsRouter.post("/verify-subscription", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const response = { success: true, verified: true, ...body };
  await persistLog("verify-subscription", body, response);
  return c.json(response);
});

functionsRouter.post("/admin-stats", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const stats = await neonAdminStats();

  const users = [
    {
      id: "local-user-1",
      name: "Aspirant",
      created_at: nowIso(),
      is_subscribed: true,
      plan_type: "monthly",
      subscription_amount: 99,
    },
  ];

  const response = {
    total_users: users.length,
    free_users_count: users.filter((u) => !u.is_subscribed).length,
    subscribed_users_count: users.filter((u) => u.is_subscribed).length,
    users,
    logs_count: stats.logs,
    cache_entries: stats.cacheEntries,
    secret_checked: Boolean(body?.secret_code),
  };

  await persistLog("admin-stats", body, response);
  return c.json(response);
});
