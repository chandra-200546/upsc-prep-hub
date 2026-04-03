import fs from "node:fs";
import path from "node:path";
import { generateText } from "../lib/gemini.js";

type HistoryChunk = {
  id: string;
  source: string;
  text: string;
};

const storeDir = path.resolve(process.cwd(), "data", "rag");
const storeFile = path.resolve(storeDir, "history-book.json");

const ensureStore = () => {
  if (!fs.existsSync(storeDir)) fs.mkdirSync(storeDir, { recursive: true });
  if (!fs.existsSync(storeFile)) {
    fs.writeFileSync(storeFile, JSON.stringify({ chunks: [] as HistoryChunk[] }, null, 2), "utf-8");
  }
};

const loadChunks = (): HistoryChunk[] => {
  ensureStore();
  try {
    const raw = fs.readFileSync(storeFile, "utf-8");
    const parsed = JSON.parse(raw) as { chunks?: HistoryChunk[] };
    return Array.isArray(parsed.chunks) ? parsed.chunks : [];
  } catch {
    return [];
  }
};

const saveChunks = (chunks: HistoryChunk[]) => {
  ensureStore();
  fs.writeFileSync(storeFile, JSON.stringify({ chunks }, null, 2), "utf-8");
};

const clean = (v: string) => v.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();

const scoreChunk = (chunk: HistoryChunk, query: string) => {
  const cq = clean(query);
  const ct = clean(chunk.text);
  if (!cq || !ct) return 0;
  const tokens = cq.split(" ").filter((x) => x.length > 2);
  let score = 0;
  tokens.forEach((t) => {
    if (ct.includes(t)) score += 1;
  });
  if (ct.includes(cq)) score += 5;
  return score;
};

export const ingestHistoryChunks = (inputChunks: Array<{ source?: string; text?: string }>) => {
  const chunks: HistoryChunk[] = inputChunks
    .map((c, i) => ({
      id: `${Date.now()}-${i}`,
      source: c.source?.trim() || "History Book",
      text: c.text?.trim() || "",
    }))
    .filter((c) => c.text.length > 30);

  saveChunks(chunks);
  return { saved: chunks.length };
};

export const getHistoryRagStats = () => {
  const chunks = loadChunks();
  return { chunks: chunks.length };
};

export const queryHistoryRag = async (question: string) => {
  const chunks = loadChunks();
  if (!chunks.length) {
    return {
      answer: "History book is not ingested yet. Please upload/ingest the History PDF first.",
      citations: [],
    };
  }

  const ranked = [...chunks]
    .map((c) => ({ chunk: c, score: scoreChunk(c, question) }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .filter((x) => x.score > 0);

  const contextChunks: HistoryChunk[] = ranked.length
    ? ranked.map((x) => x.chunk)
    : chunks.slice(0, 3);
  const context = contextChunks
    .map((c, i) => `Source ${i + 1} (${c.source}): ${c.text}`)
    .join("\n\n");

  let answer = "";
  try {
    answer = await generateText(
      [
        {
          role: "system",
          content:
            "You are UPSC History mentor. Answer only from provided context. If context is insufficient, say so clearly.",
        },
        {
          role: "user",
          content: `Question: ${question}\n\nContext:\n${context}\n\nReturn concise, exam-ready answer.`,
        },
      ],
      0.2,
    );
  } catch {
    answer = contextChunks.map((c) => c.text).join("\n\n");
  }

  return {
    answer,
    citations: contextChunks.map((c) => c.source),
  };
};
