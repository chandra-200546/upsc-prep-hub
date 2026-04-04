import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { dbDelete, dbInsert, dbSelect, dbUpdate, dbUpsert, loginOrCreateGoogleUser, loginUser, resolveSession, revokeSession, signUpUser } from "../db/app-db.js";
import { cacheGet, cacheSet, logRequest } from "../db/sqlite.js";
import { neonAdminStats, neonCacheGet, neonCacheSet, neonLogRequest } from "../db/neon.js";
import { getProfileById, listProfiles, parseProfilesCsv, upsertProfiles } from "../db/profiles.js";
import { getHistoryRagStats, ingestHistoryChunks, queryHistoryRag } from "../rag/history-rag.js";
import { generateSubjectBookAnswer, generateSubjectRagNotes, getSubjectRagStats, ingestSubjectPdf } from "../rag/subject-rag.js";
import { generateJson, generateText } from "../lib/gemini.js";
import { config, hasGemini } from "../config.js";
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
    provider: "gemini",
    hasGeminiKey: hasGemini,
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
