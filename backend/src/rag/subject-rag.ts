import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";
import { pool, queryNeon } from "../db/neon.js";
import { generateJson } from "../lib/gemini.js";

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

const fallbackDeck = (subjectName: string, topic: string, slideCount: number, citations: string[]): NotesDeck => ({
  topicTitle: topic,
  chapterTitle: subjectName,
  slides: Array.from({ length: slideCount }).map((_, i) => ({
    slideNumber: i + 1,
    topicName: topic,
    subtopicTitle: `${topic} - Source Notes ${i + 1}`,
    structuredExplanation: "Source context was limited. Please ingest a cleaner PDF/text source for richer output.",
    points: ["Definition", "Core features", "Exam relevance"],
    keyTakeaway: "Revise with source-backed facts.",
  })),
  checkpointQuestions: Array.from({ length: Math.floor(slideCount / 3) }).map((_, i) => ({
    afterSlide: (i + 1) * 3,
    type: "short",
    question: `Checkpoint ${i + 1}: What are the key points from slides ${(i + 1) * 3 - 2}-${(i + 1) * 3}?`,
    correctAnswer: "core points",
    acceptableAnswers: ["definition", "feature", "significance"],
    explanation: "Answer from source notes only.",
  })),
  practiceQuestions: Array.from({ length: 10 }).map((_, i) => ({
    questionText: `${topic} practice question ${i + 1}`,
    difficulty: i < 3 ? "Easy" : i < 7 ? "Medium" : "Hard",
    type: i < 4 ? "Prelims" : i < 8 ? "Mains" : "Analytical",
    answer: "Use source-backed answer.",
    explanation: "Focus on facts and structure.",
    keyPoints: ["Concept", "Evidence", "Conclusion"],
  })),
  revisionSummary: ["Revise key definitions.", "Map facts to UPSC syllabus.", "Practice one mains answer."],
  generatedAt: new Date().toISOString(),
  citations,
});

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
  const contextChunks = selected.length ? selected : chunks.slice(0, 12);
  const context = contextChunks
    .map((c, idx) => `Chunk ${idx + 1} [${c.source_name}] ${c.chunk_text}`)
    .join("\n\n");
  const citations = Array.from(new Set(contextChunks.map((c) => c.source_name)));
  const count = Math.min(20, Math.max(15, slideCount));

  const fallback = fallbackDeck(subjectName, topic, count, citations);
  const generated = await generateJson<NotesDeck>(
    [
      {
        role: "system",
        content:
          "You are a strict UPSC notes generator. Use ONLY provided source context. Do not invent facts. Return only valid JSON in requested schema.",
      },
      {
        role: "user",
        content:
          `Subject: ${subjectName}\nTopic: ${topic}\n` +
          `Create exactly ${count} structured slides from source context. Add checkpointQuestions after each 3 slides and 10 practiceQuestions.\n` +
          "Schema keys required: topicTitle, chapterTitle, slides, checkpointQuestions, practiceQuestions, revisionSummary, generatedAt, citations.\n\n" +
          `Source context:\n${context}`,
      },
    ],
    fallback,
    0.1,
  );

  return { ok: true, deck: { ...generated, citations } };
};

const DEFAULT_HISTORY_PATHS = [
  process.env.HISTORY_BOOK_PDF_PATH || "",
  String.raw`C:\Users\Chandrashekar\Downloads\COPY - A Brief History of Modern India Spectrum 2019-20 Edition Rajiv Ahir .pdf`,
  path.resolve(process.cwd(), "..", "COPY - A Brief History of Modern India Spectrum 2019-20 Edition Rajiv Ahir .pdf"),
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
