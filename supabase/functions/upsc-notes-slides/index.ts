import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Slide = {
  heading: string;
  bullets: string[];
  detailedExplanation: string;
  example: string;
  visualTitle: string;
  visualLines: string[];
};

type QuizCheckpoint = {
  afterSlide: number;
  question: string;
  acceptableAnswers: string[];
};

type DeckResponse = {
  topicTitle: string;
  chapterTitle: string;
  slides: Slide[];
  quizzes: QuizCheckpoint[];
  sources?: string[];
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic } = await req.json();
    if (!subject || typeof subject !== "string") {
      return new Response(JSON.stringify({ error: "Subject is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify({ error: "AI_API_KEY is not configured (set GEMINI_API_KEY or OPENAI_API_KEY)" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemInstruction = `You are an expert UPSC teacher and instructional designer.
Generate structured, high-quality exam-ready notes as slide data.
Strictly return JSON only.

Rules:
- Topic is UPSC-oriented.
- Generate 10 to 15 slides.
- Each slide must include:
  heading, bullets (3 to 6), detailedExplanation, example, visualTitle, visualLines (3 to 6).
- Keep language clear and beginner friendly.
- Cover fundamentals to advanced.
- Add prelims + mains angle where relevant.
- Create quiz checkpoints after every 3 slides to test what was studied.
- Each checkpoint must include:
  afterSlide (slide number), question, acceptableAnswers (2 to 4 short keyword answers).

Output schema:
{
  "topicTitle": "string",
  "chapterTitle": "string",
  "slides": [
    {
      "heading": "string",
      "bullets": ["string"],
      "detailedExplanation": "string",
      "example": "string",
      "visualTitle": "string",
      "visualLines": ["string"]
    }
  ],
  "quizzes": [
    {
      "afterSlide": 3,
      "question": "string",
      "acceptableAnswers": ["string"]
    }
  ],
  "sources": ["string"]
}`;

    const userPrompt = `Subject: ${subject}
Topic: ${topic.trim()}
Create complete notes slides with checkpoints.`;

    const GeminiRes = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${GEMINI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemInstruction },
          { role: "user", content: userPrompt },
        ],
      }),
    });

    if (!GeminiRes.ok) {
      const errorText = await GeminiRes.text();
      console.error("Gemini error:", GeminiRes.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate slides from Gemini" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const GeminiData = await GeminiRes.json();
    const rawText = GeminiData?.choices?.[0]?.message?.content;
    if (!rawText) {
      return new Response(JSON.stringify({ error: "Gemini returned empty response" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const parsed = JSON.parse(rawText) as DeckResponse;
    if (!Array.isArray(parsed.slides) || parsed.slides.length < 10) {
      return new Response(JSON.stringify({ error: "Generated slide deck is incomplete" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(
      JSON.stringify({
        topicTitle: parsed.topicTitle || topic.trim(),
        chapterTitle: parsed.chapterTitle || subject,
        slides: parsed.slides.slice(0, 15),
        quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : ["Gemini generated UPSC study deck"],
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("upsc-notes-slides exception:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
