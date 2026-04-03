import { config, hasGemini } from "../config.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const openAiCompatEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const models = ["gemini-2.0-flash", "gemini-1.5-flash"];

const toNativeRole = (role: ChatMessage["role"]) => {
  if (role === "assistant") return "model";
  return "user";
};

const normalizeMessages = (messages: ChatMessage[]): ChatMessage[] => {
  return (Array.isArray(messages) ? messages : [])
    .map((m) => {
      const role = m?.role === "assistant" || m?.role === "system" ? m.role : "user";
      const content = typeof m?.content === "string" ? m.content.trim() : String(m?.content ?? "").trim();
      return { role, content } as ChatMessage;
    })
    .filter((m) => Boolean(m.content));
};

const tryOpenAiCompat = async (messages: ChatMessage[], model: string, temperature: number) => {
  const response = await fetch(openAiCompatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.geminiApiKey}`,
    },
    body: JSON.stringify({
      model,
      temperature,
      messages,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`openai-compat ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw) as any;
  return String(parsed?.choices?.[0]?.message?.content || "").trim();
};

const tryNativeGemini = async (messages: ChatMessage[], model: string, temperature: number) => {
  const nativeEndpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const response = await fetch(`${nativeEndpoint}?key=${encodeURIComponent(config.geminiApiKey)}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": config.geminiApiKey,
    },
    body: JSON.stringify({
      generationConfig: {
        temperature,
      },
      contents: messages.map((m) => ({
        role: toNativeRole(m.role),
        parts: [{ text: m.content }],
      })),
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`native ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw) as any;
  const text = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("\n") || "";
  return String(text).trim();
};

export const generateText = async (messages: ChatMessage[], temperature = 0.2) => {
  if (!hasGemini) throw new Error("GEMINI_API_KEY is missing");
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) throw new Error("messages are required");

  const errors: string[] = [];

  for (const model of models) {
    try {
      const text = await tryOpenAiCompat(normalizedMessages, model, temperature);
      if (text) return text;
      errors.push(`openai-compat(${model}) returned empty response`);
    } catch (error: any) {
      errors.push(error?.message || `openai-compat(${model}) request failed`);
    }
  }

  for (const model of models) {
    try {
      const text = await tryNativeGemini(normalizedMessages, model, temperature);
      if (text) return text;
      errors.push(`native gemini(${model}) returned empty response`);
    } catch (error: any) {
      errors.push(error?.message || `native gemini(${model}) request failed`);
    }
  }

  throw new Error(`Gemini failed: ${errors.join(" | ")}`);
};

export const generateJson = async <T>(messages: ChatMessage[], fallback: T, temperature = 0.2): Promise<T> => {
  try {
    const text = await generateText(messages, temperature);
    const normalized = text.replace(/^```json/i, "").replace(/^```/, "").replace(/```$/, "").trim();
    return JSON.parse(normalized) as T;
  } catch {
    return fallback;
  }
};
