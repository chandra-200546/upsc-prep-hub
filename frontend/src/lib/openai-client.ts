type ChatRole = "system" | "user" | "assistant";

export type GeminiMessage = {
  role: ChatRole;
  content: string;
};

const resolveBackendBaseUrl = () => {
  const configured = (import.meta.env.VITE_BACKEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  if (typeof window !== "undefined" && window.location.port === "5173") return "http://localhost:8787";
  return "http://localhost:8787";
};

const BACKEND_BASE_URL = resolveBackendBaseUrl();

export const streamGeminiText = async ({
  messages,
  onDelta,
}: {
  messages: GeminiMessage[];
  onDelta?: (delta: string) => void;
  model?: string;
}) => {
  const response = await fetch(`${BACKEND_BASE_URL}/functions/v1/ai-generate`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ messages, temperature: 0.2 }),
  });

  const raw = await response.text();
  const payload = raw ? JSON.parse(raw) : {};
  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || "AI generation failed";
    throw new Error(message);
  }

  const text = payload?.text || "";
  if (!text) throw new Error("AI returned empty response");
  onDelta?.(text);
  return text;
};
