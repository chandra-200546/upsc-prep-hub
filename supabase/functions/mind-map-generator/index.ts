import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const systemPrompt = `You are a UPSC expert mind map generator. Create concise, visually-optimized mind maps.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks.

Structure:
{
  "id": "root",
  "label": "Short Topic Name",
  "children": [
    {
      "id": "1",
      "label": "Branch Name",
      "children": [
        { "id": "1_1", "label": "Point 1" },
        { "id": "1_2", "label": "Point 2" }
      ]
    }
  ]
}

CRITICAL RULES:
- Root label: 2-4 words max (the core concept)
- Main branches: EXACTLY 5-6 branches
- Each branch: 2-3 leaf nodes only
- ALL labels: 2-4 words max, never longer
- Focus on: Key aspects, causes, effects, significance, examples
- Be UPSC-specific and exam-relevant
- Use simple, memorable phrases`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a concise UPSC mind map for: "${topic}". Keep labels SHORT (2-4 words).` }
        ],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded. Please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "AI credits exhausted. Please add credits." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in response");
    }

    // Parse the JSON from the response
    let mindMap;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "");
      }
      mindMap = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse mind map JSON:", content);
      // Fallback structure
      mindMap = {
        id: "root",
        label: topic,
        children: [
          { id: "1", label: "Definition & Concept", children: [{ id: "1_1", label: "Key terms" }] },
          { id: "2", label: "Causes & Factors", children: [{ id: "2_1", label: "Primary causes" }] },
          { id: "3", label: "Effects & Impact", children: [{ id: "3_1", label: "Short-term" }, { id: "3_2", label: "Long-term" }] },
          { id: "4", label: "Examples", children: [{ id: "4_1", label: "Indian context" }] },
          { id: "5", label: "UPSC Relevance", children: [{ id: "5_1", label: "Previous questions" }] },
        ]
      };
    }

    return new Response(JSON.stringify({ mindMap }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in mind-map-generator:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
