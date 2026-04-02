import { Hono } from "hono";
import { randomUUID } from "node:crypto";
import { cacheGet, cacheSet, logRequest } from "../db/sqlite.js";
import { neonAdminStats, neonCacheGet, neonCacheSet, neonLogRequest } from "../db/neon.js";
import { generateJson, generateText } from "../lib/gemini.js";
import { hashPayload } from "../lib/utils.js";

type Bindings = { Variables: { fn: string } };
export const functionsRouter = new Hono<Bindings>();

const nowIso = () => new Date().toISOString();

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

  const fallback = {
    topicTitle: topic,
    chapterTitle: subject,
    slides: Array.from({ length: 10 }).map((_, i) => ({
      heading: `${topic} - Slide ${i + 1}`,
      bullets: ["Point 1", "Point 2", "Point 3"],
      detailedExplanation: "Structured explanation for UPSC prep.",
      example: "Relevant example.",
      visualTitle: "Visual cue",
      visualLines: ["Step 1", "Step 2", "Step 3"],
    })),
    quizzes: [{ afterSlide: 3, question: "Quick checkpoint?", acceptableAnswers: ["yes"] }],
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
