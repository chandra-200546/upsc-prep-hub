import { config, hasGemini } from "../config.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const openAiCompatEndpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";
const nativeEndpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent";

const toNativeRole = (role: ChatMessage["role"]) => {
  if (role === "assistant") return "model";
  return "user";
};

const tryOpenAiCompat = async (messages: ChatMessage[], temperature: number) => {
  const response = await fetch(openAiCompatEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.geminiApiKey}`,
    },
    body: JSON.stringify({
      model: "gemini-2.0-flash",
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

const tryNativeGemini = async (messages: ChatMessage[], temperature: number) => {
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
  if (!Array.isArray(messages) || messages.length === 0) throw new Error("messages are required");

  const errors: string[] = [];

  try {
    const text = await tryOpenAiCompat(messages, temperature);
    if (text) return text;
    errors.push("openai-compat returned empty response");
  } catch (error: any) {
    errors.push(error?.message || "openai-compat request failed");
  }

  try {
    const text = await tryNativeGemini(messages, temperature);
    if (text) return text;
    errors.push("native gemini returned empty response");
  } catch (error: any) {
    errors.push(error?.message || "native gemini request failed");
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
