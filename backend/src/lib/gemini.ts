import { config, hasGemini } from "../config.js";

const endpoint = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export const generateText = async (messages: ChatMessage[], temperature = 0.2) => {
  if (!hasGemini) throw new Error("GEMINI_API_KEY is missing");

  const response = await fetch(endpoint, {
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
    throw new Error(`Gemini ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw) as any;
  return parsed?.choices?.[0]?.message?.content?.trim?.() || "";
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
