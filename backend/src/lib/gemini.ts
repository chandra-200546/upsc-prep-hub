import { config, hasGemini } from "../config.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const geminiBase = "https://generativelanguage.googleapis.com/v1beta/models";
const geminiBaseV1 = "https://generativelanguage.googleapis.com/v1/models";
const geminiFallbackModels = [
  "gemini-2.0-flash",
  "gemini-1.5-flash",
  "gemini-1.5-pro",
  "gemini-1.5-flash-8b",
];

const normalizeMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => {
      const role = m?.role === "assistant" || m?.role === "system" ? m.role : "user";
      const content = typeof m?.content === "string" ? m.content.trim() : String(m?.content ?? "").trim();
      return { role, content } as ChatMessage;
    })
    .filter((m) => Boolean(m.content));
};

export const generateText = async (messages: ChatMessage[], temperature = 0.2) => {
  if (!hasGemini) throw new Error("GEMINI_API_KEY is missing");

  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) throw new Error("messages are required");

  const candidates = Array.from(
    new Set([config.geminiModel, ...geminiFallbackModels].map((m) => String(m || "").trim()).filter(Boolean)),
  );
  const errors: string[] = [];

  const systemText = normalizedMessages
    .filter((m) => m.role === "system")
    .map((m) => m.content)
    .join("\n")
    .trim();

  const chatMessages = normalizedMessages.filter((m) => m.role !== "system");
  const contents = chatMessages.length
    ? chatMessages.map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }))
    : [{ role: "user", parts: [{ text: "Provide a valid response." }] }];

  for (const model of candidates) {
    try {
      const urls = [
        `${geminiBase}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
        `${geminiBaseV1}/${encodeURIComponent(model)}:generateContent?key=${encodeURIComponent(config.geminiApiKey)}`,
      ];

      for (const url of urls) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 25000);
        try {
          const response = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-goog-api-key": config.geminiApiKey,
            },
            body: JSON.stringify({
              contents,
              systemInstruction: systemText ? { parts: [{ text: systemText }] } : undefined,
              generationConfig: { temperature },
            }),
            signal: controller.signal,
          });

          const raw = await response.text();
          if (!response.ok) {
            errors.push(`${model}: Gemini ${response.status}: ${raw}`);
            continue;
          }

          const parsed = JSON.parse(raw) as any;
          const text = String(parsed?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
          if (!text) {
            errors.push(`${model}: empty response`);
            continue;
          }
          return text;
        } finally {
          clearTimeout(timer);
        }
      }
    } catch (error: any) {
      const causeMessage = String(error?.cause?.message || "").trim();
      const suffix = causeMessage ? ` (${causeMessage})` : "";
      errors.push(`${model}: ${error?.message || "request failed"}${suffix}`);
    }
  }

  throw new Error(`Gemini generation failed. Tried models: ${candidates.join(", ")}. Errors: ${errors.join(" | ")}`);
};

export const generateJson = async <T>(messages: ChatMessage[], fallback: T, temperature = 0.2): Promise<T> => {
  const parseBestEffortJson = (rawText: string): T => {
    const cleaned = String(rawText || "")
      .replace(/^```json/i, "")
      .replace(/^```/, "")
      .replace(/```$/, "")
      .trim();

    try {
      return JSON.parse(cleaned) as T;
    } catch {
      // Continue with extraction attempts.
    }

    const firstObj = cleaned.indexOf("{");
    const lastObj = cleaned.lastIndexOf("}");
    if (firstObj >= 0 && lastObj > firstObj) {
      const objSlice = cleaned.slice(firstObj, lastObj + 1);
      try {
        return JSON.parse(objSlice) as T;
      } catch {
        // Continue with array extraction.
      }
    }

    const firstArr = cleaned.indexOf("[");
    const lastArr = cleaned.lastIndexOf("]");
    if (firstArr >= 0 && lastArr > firstArr) {
      const arrSlice = cleaned.slice(firstArr, lastArr + 1);
      return JSON.parse(arrSlice) as T;
    }

    throw new Error("Unable to parse AI JSON response");
  };

  try {
    const text = await generateText(messages, temperature);
    return parseBestEffortJson(text);
  } catch {
    return fallback;
  }
};
