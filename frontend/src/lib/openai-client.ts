type ChatRole = "system" | "user" | "assistant";

export type GeminiMessage = {
  role: ChatRole;
  content: string;
};

const backendCandidates = () => {
  const configured = (import.meta.env.VITE_BACKEND_URL || "").trim();
  const hostDerived =
    typeof window !== "undefined" && window.location?.hostname
      ? `${window.location.protocol}//${window.location.hostname}:8787`
      : "";
  const fromWindow = typeof window !== "undefined" ? window.location.origin.replace(/\/$/, "") : "";
  const local = "http://localhost:8787";
  const localAlt = "http://127.0.0.1:8787";
  return Array.from(
    new Set([configured, hostDerived, local, localAlt, fromWindow].filter(Boolean).map((x) => x.replace(/\/$/, ""))),
  );
};

export const streamGeminiText = async ({
  messages,
  onDelta,
}: {
  messages: GeminiMessage[];
  onDelta?: (delta: string) => void;
  model?: string;
}) => {
  const attempts = backendCandidates();
  let lastErr = "Failed to fetch backend API";
  for (const base of attempts) {
    try {
      const response = await fetch(`${base}/functions/v1/ai-generate`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ messages, temperature: 0.2 }),
      });

      const raw = await response.text();
      let payload: any = {};
      try {
        payload = raw ? JSON.parse(raw) : {};
      } catch {
        payload = {};
      }
      if (!response.ok) {
        lastErr = payload?.error?.message || payload?.message || "AI generation failed";
        if (response.status === 404) continue;
        throw new Error(lastErr);
      }

      const text = payload?.text || "";
      if (!text) throw new Error("AI returned empty response");
      onDelta?.(text);
      return text;
    } catch (error: any) {
      lastErr = error?.message || lastErr;
    }
  }
  throw new Error(lastErr);
};
