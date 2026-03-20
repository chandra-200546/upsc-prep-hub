type ChatRole = "system" | "user" | "assistant";

export type GeminiMessage = {
  role: ChatRole;
  content: string;
};

const getGeminiKey = () => {
  const envKey = import.meta.env.VITE_GEMINI_API_KEY || "";
  if (envKey) return envKey;

  try {
    const local = window.localStorage.getItem("GEMINI_API_KEY") || "";
    if (local) return local;
  } catch {
    // ignore storage read errors
  }

  return "";
};

export const streamGeminiText = async ({
  messages,
  onDelta,
  model = "gemini-2.0-flash",
}: {
  messages: GeminiMessage[];
  onDelta?: (delta: string) => void;
  model?: string;
}) => {
  let apiKey = getGeminiKey();
  if (!apiKey && typeof window !== "undefined") {
    const entered = window.prompt("Enter Gemini API Key to continue AI features:");
    if (entered && entered.trim()) {
      apiKey = entered.trim();
      try {
        window.localStorage.setItem("GEMINI_API_KEY", apiKey);
      } catch {
        // ignore storage errors
      }
    }
  }

  if (!apiKey) {
    throw new Error("Gemini API key is not configured");
  }

  const systemMessage = messages.find((m) => m.role === "system")?.content || "";
  const conversation = messages
    .filter((m) => m.role !== "system")
    .map((m) => `${m.role.toUpperCase()}: ${m.content}`)
    .join("\n\n");
  const fullPrompt = `${systemMessage}\n\n${conversation}`.trim();

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature: 0.2,
      },
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    let message = raw || "Gemini request failed";
    try {
      const parsed = JSON.parse(raw);
      message =
        parsed?.error?.message ||
        parsed?.message ||
        message;
    } catch {
      // keep raw message
    }
    throw new Error(`Gemini ${response.status}: ${message}`);
  }

  const parsed = await response.json();
  const fullText = parsed?.candidates?.[0]?.content?.parts?.map((p: any) => p?.text || "").join("") || "";
  if (!fullText) throw new Error("Gemini returned empty response");
  onDelta?.(fullText);

  return fullText;
};
