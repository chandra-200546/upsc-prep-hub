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

    const systemPrompt = `You are a UPSC expert mind map generator. Given a topic, create a comprehensive mind map structure.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, no explanations.

The JSON structure must be:
{
  "id": "root",
  "label": "Main Topic",
  "children": [
    {
      "id": "unique_id_1",
      "label": "Subtopic 1",
      "children": [
        { "id": "unique_id_1_1", "label": "Detail 1" },
        { "id": "unique_id_1_2", "label": "Detail 2" }
      ]
    }
  ]
}

Rules:
- Root node should be the main concept
- Create 4-6 main branches (subtopics)
- Each branch should have 2-4 leaf nodes
- Labels should be concise (2-5 words)
- Cover: definitions, causes, effects, examples, significance, current affairs links
- Make it UPSC-relevant with exam-focused points
- Use unique IDs for each node`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Create a detailed UPSC-focused mind map for: "${topic}"` }
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
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
