import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pool, queryNeon } from "../db/neon.js";
import { generateText } from "../lib/gemini.js";

type SubjectChunk = {
  id: string;
  subject_id: string;
  subject_name: string;
  source_name: string;
  chunk_index: number;
  chunk_text: string;
  created_at?: string;
};

type NotesDeck = {
  topicTitle: string;
  chapterTitle: string;
  slides: Array<{
    slideNumber: number;
    topicName: string;
    subtopicTitle: string;
    structuredExplanation: string;
    points: string[];
    keyTakeaway: string;
  }>;
  checkpointQuestions: Array<{
    afterSlide: number;
    type: "mcq" | "short";
    question: string;
    options?: string[];
    correctAnswer: string;
    acceptableAnswers?: string[];
    explanation: string;
  }>;
  practiceQuestions: Array<{
    questionText: string;
    difficulty: "Easy" | "Medium" | "Hard";
    type: "Prelims" | "Mains" | "Analytical";
    answer: string;
    explanation: string;
    keyPoints: string[];
  }>;
  revisionSummary: string[];
  generatedAt: string;
  citations: string[];
};

type BookAnswer = {
  topic: string;
  subject: string;
  summary: string;
  keyPoints: string[];
  examFocus: string[];
  citations: string[];
  sourceSnippets: string[];
};

const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const scoreChunk = (chunkText: string, query: string) => {
  const q = clean(query);
  const t = clean(chunkText);
  if (!q || !t) return 0;
  const qTokens = q.split(" ").filter((x) => x.length > 2);
  let score = 0;
  qTokens.forEach((token) => {
    if (t.includes(token)) score += 1;
  });
  if (t.includes(q)) score += 5;
  return score;
};

const decodePdfLiteral = (input: string) =>
  input
    .replace(/\\\(/g, "(")
    .replace(/\\\)/g, ")")
    .replace(/\\n/g, " ")
    .replace(/\\r/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\\\\/g, "\\");

const extractTextFromContentStream = (content: string) => {
  const parts: string[] = [];
  const tjMatches = content.matchAll(/\(([\s\S]*?)\)\s*Tj/g);
  for (const m of tjMatches) {
    const txt = decodePdfLiteral(m[1] || "").trim();
    if (txt) parts.push(txt);
  }
  const tjArrayMatches = content.matchAll(/\[(.*?)\]\s*TJ/g);
  for (const m of tjArrayMatches) {
    const segment = m[1] || "";
    const tokens = [...segment.matchAll(/\(([\s\S]*?)\)/g)].map((x) => decodePdfLiteral(x[1] || "").trim()).filter(Boolean);
    if (tokens.length) parts.push(tokens.join(" "));
  }
  return parts.join(" ");
};

const tryInflate = (buf: Buffer): string => {
  try {
    return zlib.inflateSync(buf).toString("latin1");
  } catch {
    try {
      return zlib.inflateRawSync(buf).toString("latin1");
    } catch {
      return buf.toString("latin1");
    }
  }
};

export const extractTextFromPdfBase64 = (base64: string) => {
  const pdfBuffer = Buffer.from(base64, "base64");
  const pdfText = pdfBuffer.toString("latin1");
  const streamMatches = [...pdfText.matchAll(/stream[\r\n]+([\s\S]*?)endstream/g)];
  const collected: string[] = [];

  for (const match of streamMatches) {
    const streamRaw = match[1] || "";
    const streamBuf = Buffer.from(streamRaw, "latin1");
    const decoded = tryInflate(streamBuf);
    const chunkText = extractTextFromContentStream(decoded);
    if (chunkText.length > 20) collected.push(chunkText);
  }

  if (!collected.length) {
    const plain = pdfText.replace(/[^\x20-\x7E\n]/g, " ").replace(/\s+/g, " ").trim();
    return plain;
  }

  return collected.join(" ").replace(/\s+/g, " ").trim();
};

const splitIntoChunks = (text: string, size = 1000, overlap = 120) => {
  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return [];
  const chunks: string[] = [];
  let cursor = 0;
  while (cursor < cleaned.length) {
    const end = Math.min(cleaned.length, cursor + size);
    const piece = cleaned.slice(cursor, end).trim();
    if (piece.length > 80) chunks.push(piece);
    if (end >= cleaned.length) break;
    cursor = Math.max(cursor + 1, end - overlap);
  }
  return chunks;
};

const insertSubjectChunksNeon = async (
  subjectId: string,
  subjectName: string,
  sourceName: string,
  chunks: string[],
  replaceExisting: boolean,
) => {
  if (!pool) throw new Error("Neon unavailable");
  if (replaceExisting) {
    await queryNeon("DELETE FROM subject_rag_chunks WHERE subject_id = $1", [subjectId]);
  }
  for (let i = 0; i < chunks.length; i += 1) {
    await queryNeon(
      `INSERT INTO subject_rag_chunks (subject_id, subject_name, source_name, chunk_index, chunk_text)
       VALUES ($1, $2, $3, $4, $5)`,
      [subjectId, subjectName, sourceName, i, chunks[i]],
    );
  }
};

const getSubjectChunks = async (subjectId: string): Promise<SubjectChunk[]> => {
  if (!pool) throw new Error("Neon database is required for subject RAG.");
  const neonRows = await queryNeon<SubjectChunk>(
    `SELECT id::text, subject_id, subject_name, source_name, chunk_index, chunk_text, created_at::text
     FROM subject_rag_chunks
     WHERE subject_id = $1
     ORDER BY chunk_index ASC`,
    [subjectId],
  );
  return neonRows;
};

export const ingestSubjectPdf = async ({
  subjectId,
  subjectName,
  sourceName,
  pdfBase64,
  replaceExisting,
}: {
  subjectId: string;
  subjectName: string;
  sourceName: string;
  pdfBase64: string;
  replaceExisting?: boolean;
}) => {
  const text = extractTextFromPdfBase64(pdfBase64);
  const chunks = splitIntoChunks(text);
  if (!chunks.length) {
    return { ok: false, saved: 0, reason: "Could not extract readable text from PDF." };
  }
  const replace = replaceExisting !== false;
  await insertSubjectChunksNeon(subjectId, subjectName, sourceName, chunks, replace);
  return { ok: true, saved: chunks.length, extractedChars: text.length };
};

export const getSubjectRagStats = async (subjectId: string) => {
  const chunks = await getSubjectChunks(subjectId);
  const sources = Array.from(new Set(chunks.map((c) => c.source_name)));
  return { subjectId, chunks: chunks.length, sources };
};

const buildFallbackAnswer = (subjectName: string, topic: string, contextChunks: SubjectChunk[]): BookAnswer => {
  const snippets = contextChunks.map((c) => compactNote(c.chunk_text, 220)).filter(Boolean).slice(0, 6);
  return {
    topic,
    subject: subjectName,
    summary: snippets[0] || `Source-backed notes for ${topic}.`,
    keyPoints: snippets.slice(1, 6),
    examFocus: [
      "Prelims: factual anchors and chronology",
      "Mains: causes, effects, and analytical linkage",
      "Use source-backed terminology from the book",
    ],
    citations: Array.from(new Set(contextChunks.map((c) => c.source_name))),
    sourceSnippets: snippets,
  };
};

const extractJson = (raw: string) => {
  const text = raw.trim();
  if (text.startsWith("{")) return text;
  const fenced = text.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = text.indexOf("{");
  const last = text.lastIndexOf("}");
  if (first >= 0 && last > first) return text.slice(first, last + 1);
  return text;
};

const splitSentences = (text: string) =>
  text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 30);

const compactNote = (text: string, max = 180) => {
  const cleaned = text.replace(/\s+/g, " ").trim().replace(/^[\-\d.)\s]+/, "");
  if (cleaned.length <= max) return cleaned;
  return `${cleaned.slice(0, max - 3)}...`;
};

const buildDeckFromContext = (
  subjectName: string,
  topic: string,
  slideCount: number,
  contextChunks: SubjectChunk[],
  citations: string[],
): NotesDeck => {
  const sentences = contextChunks.flatMap((c) => splitSentences(c.chunk_text)).filter(Boolean);
  const pick = (index: number) => sentences[index % Math.max(1, sentences.length)] || contextChunks[index % contextChunks.length]?.chunk_text.slice(0, 240) || "";

  return {
    topicTitle: topic,
    chapterTitle: subjectName,
    slides: Array.from({ length: slideCount }).map((_, i) => ({
      slideNumber: i + 1,
      topicName: topic,
      subtopicTitle: `${topic} - Slide ${i + 1}`,
      structuredExplanation: compactNote(pick(i), 260),
      points: [pick(i + 1), pick(i + 2), pick(i + 3)]
        .filter(Boolean)
        .map((p) => compactNote(p, 150)),
      keyTakeaway: compactNote(pick(i + 4), 140),
    })),
    checkpointQuestions: Array.from({ length: Math.floor(slideCount / 3) }).map((_, i) => ({
      afterSlide: (i + 1) * 3,
      type: "short",
      question: `Checkpoint ${i + 1}: Explain the key idea from slides ${(i + 1) * 3 - 2} to ${(i + 1) * 3}.`,
      correctAnswer: "key idea",
      acceptableAnswers: ["cause", "impact", "feature", "significance"],
      explanation: "Answer from source slides.",
    })),
    practiceQuestions: Array.from({ length: 10 }).map((_, i) => ({
      questionText: `${topic} practice question ${i + 1}`,
      difficulty: i < 3 ? "Easy" : i < 7 ? "Medium" : "Hard",
      type: i < 4 ? "Prelims" : i < 8 ? "Mains" : "Analytical",
      answer: pick(i + 5),
      explanation: pick(i + 6),
      keyPoints: [pick(i + 7).slice(0, 90), pick(i + 8).slice(0, 90)].filter(Boolean),
    })),
    revisionSummary: [pick(0).slice(0, 140), pick(1).slice(0, 140), pick(2).slice(0, 140)].filter(Boolean),
    generatedAt: new Date().toISOString(),
    citations,
  };
};

export const generateSubjectRagNotes = async ({
  subjectId,
  subjectName,
  topic,
  slideCount = 18,
}: {
  subjectId: string;
  subjectName: string;
  topic: string;
  slideCount?: number;
}) => {
  const chunks = await getSubjectChunks(subjectId);
  if (!chunks.length) {
    return {
      ok: false,
      reason: `No source book ingested for subject ${subjectName}. Please upload subject PDF first.`,
    };
  }

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk.chunk_text, topic) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 18);

  const selected = ranked.filter((x) => x.score > 0).map((x) => x.chunk);
  const contextChunks = selected.length ? selected : ranked.slice(0, 12).map((x) => x.chunk);
  const context = contextChunks
    .map((c, idx) => `Chunk ${idx + 1} [${c.source_name}] ${c.chunk_text}`)
    .join("\n\n");
  const citations = Array.from(new Set(contextChunks.map((c) => c.source_name)));
  const count = Math.min(20, Math.max(15, slideCount));

  let generated: NotesDeck;
  try {
    const raw = await generateText(
      [
        {
          role: "system",
          content:
            "You are a strict UPSC notes generator. Use ONLY provided source context. Never invent facts. Return ONLY JSON.",
        },
        {
          role: "user",
          content:
            `Subject: ${subjectName}\nTopic: ${topic}\n` +
            `Create exactly ${count} structured slides from source context. Add checkpointQuestions after each 3 slides and exactly 10 practiceQuestions.\n` +
            "Schema keys required: topicTitle, chapterTitle, slides, checkpointQuestions, practiceQuestions, revisionSummary, generatedAt, citations.\n\n" +
            `Source context:\n${context}`,
        },
      ],
      0.1,
    );
    generated = JSON.parse(extractJson(raw)) as NotesDeck;
  } catch {
    generated = buildDeckFromContext(subjectName, topic, count, contextChunks, citations);
  }

  if (!Array.isArray(generated?.slides) || generated.slides.length < 10) {
    generated = buildDeckFromContext(subjectName, topic, count, contextChunks, citations);
  }

  return { ok: true, deck: { ...generated, citations } };
};

export const generateSubjectBookAnswer = async ({
  subjectId,
  subjectName,
  topic,
}: {
  subjectId: string;
  subjectName: string;
  topic: string;
}) => {
  const chunks = await getSubjectChunks(subjectId);
  if (!chunks.length) {
    return {
      ok: false,
      reason: `No source book available for ${subjectName} in database.`,
    };
  }

  const ranked = chunks
    .map((chunk) => ({ chunk, score: scoreChunk(chunk.chunk_text, topic) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 24);

  const selected = ranked.filter((x) => x.score > 0).map((x) => x.chunk);
  const contextChunks = selected.length ? selected : ranked.slice(0, 12).map((x) => x.chunk);
  const context = contextChunks
    .map((c, idx) => `Chunk ${idx + 1} [${c.source_name}]: ${c.chunk_text}`)
    .join("\n\n");

  let answer: BookAnswer | null = null;
  try {
    const raw = await generateText(
      [
        {
          role: "system",
          content:
            "You are a strict UPSC tutor. Use ONLY given source context. Return only JSON. Do not invent facts.",
        },
        {
          role: "user",
          content:
            `Subject: ${subjectName}\nTopic: ${topic}\n` +
            "Return JSON exactly with keys: topic, subject, summary, keyPoints (5-10), examFocus (3-6), citations, sourceSnippets (3-6).\n" +
            "Keep answer specific to source text and UPSC-ready.\n\n" +
            `Source context:\n${context}`,
        },
      ],
      0.1,
    );
    answer = JSON.parse(extractJson(raw)) as BookAnswer;
  } catch {
    answer = null;
  }

  const safeAnswer = answer && Array.isArray(answer.keyPoints) && answer.keyPoints.length
    ? {
        ...answer,
        citations: Array.from(new Set([...(answer.citations || []), ...contextChunks.map((c) => c.source_name)])),
        sourceSnippets: (answer.sourceSnippets || []).slice(0, 6),
      }
    : buildFallbackAnswer(subjectName, topic, contextChunks);

  return { ok: true, answer: safeAnswer };
};

const DEFAULT_HISTORY_PATHS = [
  process.env.HISTORY_BOOK_PDF_PATH || "",
  String.raw`C:\Users\Chandrashekar\Downloads\COPY - A Brief History of Modern India Spectrum 2019-20 Edition Rajiv Ahir .pdf`,
  path.resolve(process.cwd(), "..", "COPY - A Brief History of Modern India Spectrum 2019-20 Edition Rajiv Ahir .pdf"),
].filter(Boolean);

const DEFAULT_POLITY_PATHS = [
  process.env.POLITY_BOOK_PDF_PATH || "",
  String.raw`C:\Users\Chandrashekar\Downloads\[ENGLISH] M. LAXMIKANT INDIAN POLITY 8TH EDITION.pdf`,
  path.resolve(process.cwd(), "..", "[ENGLISH] M. LAXMIKANT INDIAN POLITY 8TH EDITION.pdf"),
].filter(Boolean);

const DEFAULT_GEOGRAPHY_PATHS = [
  process.env.GEOGRAPHY_BOOK_PDF_PATH || "",
  process.env.GEOGRAPHY_6TH_BOOK_PDF_PATH || "",
  String.raw`C:\Users\Chandrashekar\Downloads\6th.pdf`,
  path.resolve(process.cwd(), "..", "6th.pdf"),
].filter(Boolean);

const firstExistingPath = (candidates: string[]) => {
  for (const candidate of candidates) {
    try {
      if (fs.existsSync(candidate)) return candidate;
    } catch {
      // ignore
    }
  }
  return "";
};

const parsePathList = (raw: string) =>
  raw
    .split(/[,\n;|]/g)
    .map((p) => p.trim())
    .filter(Boolean);

const existingSourceNames = async (subjectId: string) => {
  const chunks = await getSubjectChunks(subjectId);
  return new Set(chunks.map((c) => c.source_name));
};

export const seedHistoryBookIfMissing = async () => {
  if (!pool) return { seeded: false, reason: "Neon unavailable" };
  const existing = await getSubjectChunks("history");
  if (existing.length > 0) return { seeded: false, reason: "History chunks already present", count: existing.length };

  const pdfPath = firstExistingPath(DEFAULT_HISTORY_PATHS);
  if (!pdfPath) {
    return {
      seeded: false,
      reason: "History PDF path not found. Set HISTORY_BOOK_PDF_PATH in backend .env.",
    };
  }

  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const result = await ingestSubjectPdf({
    subjectId: "history",
    subjectName: "History",
    sourceName: path.basename(pdfPath),
    pdfBase64,
    replaceExisting: true,
  });
  return { seeded: Boolean(result.ok), ...result };
};

export const seedPolityBookIfMissing = async () => {
  if (!pool) return { seeded: false, reason: "Neon unavailable" };
  const existing = await getSubjectChunks("polity");
  if (existing.length > 0) return { seeded: false, reason: "Polity chunks already present", count: existing.length };

  const pdfPath = firstExistingPath(DEFAULT_POLITY_PATHS);
  if (!pdfPath) {
    return {
      seeded: false,
      reason: "Polity PDF path not found. Set POLITY_BOOK_PDF_PATH in backend .env.",
    };
  }

  const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
  const result = await ingestSubjectPdf({
    subjectId: "polity",
    subjectName: "Indian Polity",
    sourceName: path.basename(pdfPath),
    pdfBase64,
    replaceExisting: true,
  });
  return { seeded: Boolean(result.ok), ...result };
};

export const seedGeographyBooksIfMissing = async () => {
  if (!pool) return { seeded: false, reason: "Neon unavailable" };

  const envList = parsePathList(process.env.GEOGRAPHY_BOOK_PDF_PATHS || "");
  const candidates = Array.from(new Set([...envList, ...DEFAULT_GEOGRAPHY_PATHS]));
  const existingNames = await existingSourceNames("geography");
  const foundPaths = candidates.filter((p) => {
    try {
      return fs.existsSync(p);
    } catch {
      return false;
    }
  });

  if (!foundPaths.length) {
    return {
      seeded: false,
      reason: "No geography PDF paths found. Set GEOGRAPHY_BOOK_PDF_PATHS or GEOGRAPHY_6TH_BOOK_PDF_PATH in backend .env.",
    };
  }

  let ingestedBooks = 0;
  let ingestedChunks = 0;
  const skippedSources: string[] = [];
  const errors: string[] = [];

  for (const pdfPath of foundPaths) {
    const sourceName = path.basename(pdfPath);
    if (existingNames.has(sourceName)) {
      skippedSources.push(sourceName);
      continue;
    }
    try {
      const pdfBase64 = fs.readFileSync(pdfPath).toString("base64");
      const result = await ingestSubjectPdf({
        subjectId: "geography",
        subjectName: "Geography",
        sourceName,
        pdfBase64,
        replaceExisting: false,
      });
      if (result.ok) {
        ingestedBooks += 1;
        ingestedChunks += Number(result.saved || 0);
        existingNames.add(sourceName);
      } else {
        errors.push(`${sourceName}: ${result.reason || "ingest failed"}`);
      }
    } catch (error: any) {
      errors.push(`${sourceName}: ${error?.message || "ingest failed"}`);
    }
  }

  return {
    seeded: ingestedBooks > 0,
    subjectId: "geography",
    ingestedBooks,
    ingestedChunks,
    skippedSources,
    errors,
  };
};
