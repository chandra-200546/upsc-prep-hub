type ChatRole = "system" | "user" | "assistant";

export type OpenAIMessage = {
  role: ChatRole;
  content: string;
};

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

export const streamOpenAIText = async ({
  messages,
  onDelta,
  model = "gpt-4o-mini",
}: {
  messages: OpenAIMessage[];
  onDelta?: (delta: string) => void;
  model?: string;
}) => {
  if (!OPENAI_API_KEY) {
    throw new Error("OpenAI API key is not configured");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      temperature: 0.2,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "OpenAI request failed");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No response stream");

  const decoder = new TextDecoder();
  let fullText = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const chunk = decoder.decode(value, { stream: true });
    const lines = chunk.split("\n");

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const data = line.slice(6).trim();
      if (!data || data === "[DONE]") continue;

      try {
        const parsed = JSON.parse(data);
        const delta = parsed?.choices?.[0]?.delta?.content;
        if (delta) {
          fullText += delta;
          onDelta?.(delta);
        }
      } catch {
        // Ignore transient partial SSE lines
      }
    }
  }

  return fullText;
};
