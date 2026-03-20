import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UPSC_REFUSAL_TEXT = "Sorry Aspirant, I focus only on UPSC-related topics. Let's stay on track! 📘";

const createSSETextResponse = (text: string) => {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    start(controller) {
      const chunk = `data: ${JSON.stringify({
        choices: [{ delta: { content: text } }],
      })}\n\n`;
      controller.enqueue(encoder.encode(chunk));
      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
  });
};

const isWithinUpscScope = (input: string): boolean => {
  const text = input.toLowerCase();
  const hasConstitutionArticlePattern = /\barticle\s*\d{1,3}\b/.test(text);
  const hasGsPaperPattern = /\bgs\s*[- ]?(1|2|3|4)\b/.test(text);

  const upscKeywords = [
    "upsc", "ias", "ips", "ifos", "civil services", "prelims", "mains", "gs", "essay", "interview",
    "polity", "constitution", "parliament", "federal", "fundamental rights", "dpsp", "governor", "president",
    "history", "ancient", "medieval", "modern history", "freedom struggle",
    "geography", "monsoon", "climate", "soil", "plate tectonics", "river system",
    "economy", "gdp", "inflation", "fiscal", "monetary", "budget", "banking", "frbm",
    "environment", "ecology", "biodiversity", "conservation", "climate change",
    "science and technology", "science & tech", "space", "biotechnology", "cyber security",
    "ethics", "integrity", "aptitude", "case study",
    "current affairs", "international relations", "foreign policy", "governance", "social justice",
    "ncert", "laxmikanth", "spectrum"
  ];

  const explicitlyOutOfScopeKeywords = [
    "python", "javascript", "java", "c++", "coding", "programming", "debug", "algorithm",
    "movie", "cinema", "series", "song", "music", "celebrity",
    "relationship", "dating", "breakup", "marriage advice", "career advice outside upsc",
    "gaming", "cricket score", "football score"
  ];

  if (explicitlyOutOfScopeKeywords.some((k) => text.includes(k))) {
    return false;
  }

  return hasConstitutionArticlePattern || hasGsPaperPattern || upscKeywords.some((k) => text.includes(k));
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, chatType } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("AI_API_KEY is not configured (set GEMINI_API_KEY or OPENAI_API_KEY)");
    }

    const lastUserMessage = [...(messages || [])].reverse().find((m: { role: string; content: string }) => m.role === "user")?.content || "";
    if (!isWithinUpscScope(lastUserMessage)) {
      return createSSETextResponse(UPSC_REFUSAL_TEXT);
    }

    const upscInstructionPrompt = `You are an AI Chatbot designed ONLY for UPSC (Union Public Service Commission) aspirants.

ROLE AND PERSONALITY:
- Always start with: "Hello Aspirant! 👋 Let's dive into your UPSC preparation."
- Maintain a friendly, supportive, teacher-like tone.
- Be motivating but not overly casual.
- Speak clearly and confidently like a mentor.

STRICT SCOPE:
- Answer ONLY UPSC syllabus areas:
  - Polity
  - History (Ancient, Medieval, Modern)
  - Geography
  - Economy
  - Environment & Ecology
  - Science & Tech (UPSC relevant)
  - Ethics (GS4)
  - Current Affairs (UPSC relevant)

- If user asks anything outside UPSC syllabus, reply exactly:
"Sorry Aspirant, I focus only on UPSC-related topics. Let's stay on track! 📘"

ANSWER STYLE:
- Keep responses clear, concise, and UPSC answer-writing oriented.
- Use this structure:
  1) 🔵 **Heading**
  2) 🟢 **Subheadings**
  3) 🔸 Point-wise explanation
  4) ✔ Examples (if needed)
  5) 📌 Conclusion (short)

UPSC WRITING FORMAT:
- For mains-type questions:
  1. Introduction (2-3 lines)
  2. Body (points with subheadings)
  3. Conclusion (balanced and forward-looking)

- For prelims-type questions:
  - Direct factual answer first, then short explanation.

FORMATTING:
- Highlight key terms with **bold** and CAPS where needed.
- Use emojis only for structure and keep usage minimal.
- Use bullets/numbering to keep answers exam-ready.

EXTRA:
- Add mnemonics where useful.
- Use relevant current affairs examples where appropriate.

FINAL RULE:
- Never go beyond UPSC syllabus even if user insists.
- If the query is outside UPSC syllabus, respond ONLY with:
"Sorry Aspirant, I focus only on UPSC-related topics. Let's stay on track! 📘"
`;

    // Apply same UPSC behavior for both Mentor and Voice AI modes
    let systemPrompt = upscInstructionPrompt;
    if (chatType === "voice-assistant") {
      systemPrompt += `

VOICE MODE ADD-ON:
- Keep language spoken-friendly and natural while preserving the same UPSC structure.
- Avoid very long blocks; keep each section compact for listening clarity.
`;
    }

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages
        ],
        stream: true,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits to continue." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(response.body, {
      headers: { ...corsHeaders, "Content-Type": "text/event-stream" },
    });
  } catch (error) {
    console.error("ai-chat error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

