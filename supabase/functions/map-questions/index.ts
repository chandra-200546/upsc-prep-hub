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
    const { mapType } = await req.json();
    const GOOGLE_API_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    
    if (!GOOGLE_API_KEY) {
      throw new Error("GOOGLE_GEMINI_API_KEY is not configured");
    }

    const prompt = mapType === "india" 
      ? "Generate 5 multiple-choice geography questions about India. Include questions about states, capitals, rivers, mountains, and important cities. Return ONLY a valid JSON array without any markdown formatting or extra text. Format: [{\"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct\": 0, \"explanation\": \"...\"}]"
      : "Generate 5 multiple-choice geography questions about World geography. Include questions about countries, capitals, continents, oceans, and major landmarks. Return ONLY a valid JSON array without any markdown formatting or extra text. Format: [{\"question\": \"...\", \"options\": [\"A\", \"B\", \"C\", \"D\"], \"correct\": 0, \"explanation\": \"...\"}]";

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GOOGLE_API_KEY}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }]
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "Failed to generate questions" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    
    // Clean up the response - remove markdown code blocks if present
    let cleanedText = generatedText.trim();
    if (cleanedText.startsWith("```json")) {
      cleanedText = cleanedText.replace(/```json\n?/g, "").replace(/```\n?/g, "");
    } else if (cleanedText.startsWith("```")) {
      cleanedText = cleanedText.replace(/```\n?/g, "");
    }
    
    const questions = JSON.parse(cleanedText);

    return new Response(JSON.stringify({ questions }), {
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
