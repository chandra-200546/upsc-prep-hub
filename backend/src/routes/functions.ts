import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { cacheGet, cacheSet, logRequest } from "../db/sqlite.js";
import { neonAdminStats, neonCacheGet, neonCacheSet, neonLogRequest } from "../db/neon.js";
import { generateJson, generateText } from "../lib/gemini.js";
import { hashPayload } from "../lib/utils.js";

type Bindings = { Variables: { fn: string } };
export const functionsRouter = new Hono<Bindings>();

const withCache = async <T>(fn: string, payload: unknown, compute: () => Promise<T>) => {
  const key = hashPayload(fn, payload);

  const neonCached = await neonCacheGet<T>(key);
  if (neonCached) return neonCached;

  const sqliteCached = cacheGet<T>(key);
  if (sqliteCached) {
    await neonCacheSet(key, fn, sqliteCached);
    return sqliteCached;
  }

  const fresh = await compute();
  cacheSet(key, fresh);
  await neonCacheSet(key, fn, fresh);
  return fresh;
};

const persistLog = async (fn: string, payload: unknown, response: unknown) => {
  const key = hashPayload(fn, payload);
  logRequest(fn, payload, response);
  await neonLogRequest(fn, key, payload, response);
};

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

functionsRouter.post("/generate-prelims-questions", async (c) => {
  const body = await c.req.json();
  const level = body?.level ?? 1;
  const subject = body?.subject ?? "Indian Polity";
  const count = body?.count ?? 5;

  const fallback = {
    questions: Array.from({ length: count }).map((_, i) => ({
      id: randomUUID(),
      question: `${subject} practice question ${i + 1} (Level ${level})`,
      option_a: "Option A",
      option_b: "Option B",
      option_c: "Option C",
      option_d: "Option D",
      correct_answer: "A",
      explanation: "Fallback explanation.",
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
  const body = await c.req.json();
  const category = body?.category ?? "General Studies";
  const text = await withCache("mains-question", body, () =>
    generateText([
      { role: "system", content: "Generate one UPSC mains question with marks and word limit." },
      { role: "user", content: `Category: ${category}` },
    ]),
  );
  const response = { question: text || `Discuss a key issue in ${category}. (15 marks, 250 words)` };
  await persistLog("mains-question", body, response);
  return c.json(response);
});

functionsRouter.post("/map-questions", async (c) => {
  const body = await c.req.json();
  const region = body?.region ?? "India";
  const response = await withCache("map-questions", body, () =>
    generateJson(
      [
        { role: "system", content: "Return JSON only." },
        { role: "user", content: `Generate 5 location-based UPSC map MCQs for ${region}.` },
      ],
      {
        questions: [
          { question: `Locate an important place in ${region}.`, options: ["A", "B", "C", "D"], correct: "A", explanation: "Fallback map explanation." },
        ],
      },
      0.4,
    ),
  );
  await persistLog("map-questions", body, response);
  return c.json(response);
});

functionsRouter.post("/mind-map-generator", async (c) => {
  const body = await c.req.json();
  const topic = body?.topic ?? "Indian Polity";
  const response = await withCache("mind-map-generator", body, () =>
    generateJson(
      [
        { role: "system", content: "Return JSON with nodes and edges arrays only." },
        { role: "user", content: `Create a UPSC mind map for: ${topic}` },
      ],
      {
        topic,
        nodes: [{ id: "root", label: topic }],
        edges: [],
      },
      0.3,
    ),
  );
  await persistLog("mind-map-generator", body, response);
  return c.json(response);
});

functionsRouter.post("/optional-professor", async (c) => {
  const body = await c.req.json();
  const question = body?.question ?? "Explain a key topic.";
  const optional = body?.optionalSubject ?? "Public Administration";
  const answer = await withCache("optional-professor", body, () =>
    generateText([
      { role: "system", content: `You are optional subject professor for ${optional}.` },
      { role: "user", content: question },
    ]),
  );
  const response = { explanation: answer || "Fallback optional explanation." };
  await persistLog("optional-professor", body, response);
  return c.json(response);
});

functionsRouter.post("/pyq-analysis", async (c) => {
  const body = await c.req.json();
  const subject = body?.subject ?? "Indian Polity";
  const response = await withCache("pyq-analysis", body, () =>
    generateJson(
      [
        { role: "system", content: "Return JSON only with trends, predictions, and strategy." },
        { role: "user", content: `Analyze UPSC PYQ trends for ${subject}.` },
      ],
      {
        subject,
        trends: ["Fallback trend"],
        predictions: ["Fallback prediction"],
        strategy: ["Fallback strategy"],
      },
      0.3,
    ),
  );
  await persistLog("pyq-analysis", body, response);
  return c.json(response);
});

functionsRouter.post("/upsc-notes-slides", async (c) => {
  const body = await c.req.json();
  const subject = body?.subject ?? "Indian Polity";
  const topic = body?.topic ?? "Fundamental Rights";

  const fallback = {
    topicTitle: topic,
    chapterTitle: subject,
    slides: [
      {
        heading: `${topic} - Introduction`,
        bullets: ["Fallback slide point 1", "Fallback slide point 2"],
        detailedExplanation: "Fallback detailed explanation.",
        example: "Fallback example.",
        visualTitle: "Fallback visual",
        visualLines: ["Line 1", "Line 2"],
      },
    ],
    quizzes: [{ afterSlide: 1, question: "Quick check?", acceptableAnswers: ["yes"] }],
    sources: ["Gemini"],
  };

  const response = await withCache("upsc-notes-slides", body, () =>
    generateJson(
      [
        { role: "system", content: "Return only valid JSON with topicTitle, chapterTitle, slides, quizzes, sources." },
        { role: "user", content: `Generate UPSC slide notes for subject ${subject}, topic ${topic}, 15 slides.` },
      ],
      fallback,
      0.25,
    ),
  );

  await persistLog("upsc-notes-slides", body, response);
  return c.json(response);
});

functionsRouter.post("/generate-current-affairs", async (c) => {
  const body = await c.req.json();
  const period = body?.period ?? "daily";
  const response = await withCache("generate-current-affairs", body, () =>
    generateJson(
      [
        { role: "system", content: "Return JSON array of current affairs items relevant for UPSC." },
        { role: "user", content: `Generate ${period} UPSC current affairs brief.` },
      ],
      {
        period,
        items: [{ title: "Fallback Affairs", summary: "Fallback summary", gsPaper: "GS2" }],
      },
      0.4,
    ),
  );
  await persistLog("generate-current-affairs", body, response);
  return c.json(response);
});

functionsRouter.post("/daily-intel-report", async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const text = await withCache("daily-intel-report", body, () =>
    generateText([
      { role: "system", content: "Create concise UPSC daily intel report by GS sections." },
      { role: "user", content: "Generate today's report." },
    ]),
  );
  const response = { report: text || "Fallback daily report." };
  await persistLog("daily-intel-report", body, response);
  return c.json(response);
});

functionsRouter.post("/check-subscription", (c) => c.json({ active: true, plan: "pro", source: "stub" }));
functionsRouter.post("/create-subscription", (c) => c.json({ ok: true, checkoutUrl: "/subscription/mock" }));
functionsRouter.post("/verify-subscription", (c) => c.json({ verified: true }));
functionsRouter.post("/admin-stats", async (c) => {
  const stats = await neonAdminStats();
  return c.json({
    users: 0,
    sessions: stats.logs,
    revenue: 0,
    cacheEntries: stats.cacheEntries,
    source: "neon",
  });
});
