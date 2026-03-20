import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { mapType = "india", level = 1, count = 5 } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("OPENAI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("AI_API_KEY is not configured (set GEMINI_API_KEY or OPENAI_API_KEY)");
    }

    const levelDescription = (() => {
      switch (level) {
        case 1:
          return "Beginner: basic factual questions and direct map identification.";
        case 2:
          return "Elementary: concept-based location and feature recognition.";
        case 3:
          return "Intermediate: application-oriented map reasoning questions.";
        case 4:
          return "Advanced: analytical map questions with multi-step reasoning.";
        case 5:
          return "Expert: UPSC-style elimination and integrated geography reasoning.";
        default:
          return "Standard difficulty map questions.";
      }
    })();

    const domainPrompt = mapType === "india"
      ? "India geography only. Cover states, capitals, rivers, mountain ranges, biosphere reserves, ports, and major cities."
      : "World geography only. Cover countries, capitals, oceans, straits, mountain ranges, climate zones, and major landmarks.";

    const prompt = `Generate exactly ${count} multiple-choice questions for ${mapType} map practice.
Difficulty Level: ${level}/5
Level Description: ${levelDescription}
Scope: ${domainPrompt}

Rules:
1. Return ONLY a valid JSON array (no markdown, no extra text)
2. Each item must be: {"question":"...","options":["...","...","...","..."],"correct":0,"explanation":"..."}
3. "correct" must be an integer index from 0 to 3
4. Make wrong options plausible
5. Explanations must clearly state why the answer is correct`;

    console.log(`Calling Lovable AI gateway for map questions (${mapType}, level ${level})...`);

    const response = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GEMINI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gemini-2.0-flash",
        messages: [
          { role: "system", content: "You are a geography quiz generator. Always return valid JSON arrays only, no markdown formatting." },
          { role: "user", content: prompt }
        ],
        temperature: 0.8,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Lovable AI error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      
      return new Response(JSON.stringify({ error: "Failed to generate questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedText = data.choices?.[0]?.message?.content || "";
    
    console.log("Generated text:", generatedText);
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }
    
    const questions = JSON.parse(cleanedText);
    if (!Array.isArray(questions) || questions.length === 0) {
      throw new Error("No questions parsed from AI response");
    }

    const sanitizedQuestions = questions
      .filter((q) => q && typeof q.question === "string" && Array.isArray(q.options) && q.options.length === 4)
      .map((q) => ({
        question: q.question,
        options: q.options,
        correct: Number.isInteger(q.correct) ? q.correct : 0,
        explanation: q.explanation || "No explanation provided.",
      }))
      .filter((q) => q.correct >= 0 && q.correct <= 3)
      .slice(0, count);

    if (sanitizedQuestions.length < count) {
      throw new Error("Insufficient valid questions generated");
    }

    return new Response(JSON.stringify({ questions: sanitizedQuestions }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("map-questions error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

