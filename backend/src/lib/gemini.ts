import { config, hasXai } from "../config.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const xaiEndpoint = "https://api.x.ai/v1/chat/completions";
const fallbackModels = [
  "grok-beta",
  "grok-2-1212",
  "grok-2",
  "grok-3-mini",
  "grok-3-mini-fast",
  "grok-3-fast",
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
  if (!hasXai) throw new Error("XAI_API_KEY is missing");
  const normalizedMessages = normalizeMessages(messages);
  if (normalizedMessages.length === 0) throw new Error("messages are required");

  const candidates = Array.from(
    new Set([config.xaiModel, ...fallbackModels].map((m) => String(m || "").trim()).filter(Boolean)),
  );

  const errors: string[] = [];
  for (const model of candidates) {
    try {
      const response = await fetch(xaiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${config.xaiApiKey}`,
        },
        body: JSON.stringify({
          model,
          temperature,
          messages: normalizedMessages,
        }),
      });

      const raw = await response.text();
      if (!response.ok) {
        errors.push(`${model}: xAI ${response.status}: ${raw}`);
        if (response.status === 400 && raw.toLowerCase().includes("model not found")) {
          continue;
        }
        continue;
      }

      const parsed = JSON.parse(raw) as any;
      const text = String(parsed?.choices?.[0]?.message?.content || "").trim();
      if (!text) {
        errors.push(`${model}: empty response`);
        continue;
      }
      return text;
    } catch (error: any) {
      errors.push(`${model}: ${error?.message || "request failed"}`);
    }
  }

  throw new Error(`xAI generation failed. Tried models: ${candidates.join(", ")}. Errors: ${errors.join(" | ")}`);
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
