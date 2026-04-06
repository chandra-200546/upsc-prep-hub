import { config, hasXai } from "../config.js";

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

const xaiEndpoint = "https://api.x.ai/v1/chat/completions";

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

  const response = await fetch(xaiEndpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.xaiApiKey}`,
    },
    body: JSON.stringify({
      model: config.xaiModel || "grok-2-latest",
      temperature,
      messages: normalizedMessages,
    }),
  });

  const raw = await response.text();
  if (!response.ok) {
    throw new Error(`xAI ${response.status}: ${raw}`);
  }

  const parsed = JSON.parse(raw) as any;
  const text = String(parsed?.choices?.[0]?.message?.content || "").trim();
  if (!text) throw new Error("xAI returned empty response");
  return text;
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
