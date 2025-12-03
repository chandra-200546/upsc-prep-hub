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
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const today = new Date().toISOString().split("T")[0];

    const systemPrompt = `You are an intelligence analyst creating a UPSC Daily Intelligence Report. Generate a comprehensive, officer-style brief covering today's most important developments relevant to UPSC preparation.

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks.

The JSON structure must be:
{
  "date": "${today}",
  "sections": [
    {
      "title": "India's Internal Affairs",
      "icon": "shield",
      "items": [
        {
          "headline": "Short headline",
          "detail": "2-3 sentence explanation",
          "upscTag": "GS2 Polity" 
        }
      ]
    },
    {
      "title": "Global Geo-Political Brief",
      "icon": "globe",
      "items": [...]
    },
    {
      "title": "Economic Intelligence",
      "icon": "trending",
      "items": [...]
    },
    {
      "title": "Environment & Disaster Alerts",
      "icon": "leaf",
      "items": [...]
    }
  ],
  "oneLineNotes": [
    "IMF revised India's growth forecast to 6.5% → GS3 Economy",
    "India-US 2+2 Dialogue concluded → GS2 IR"
  ]
}

Rules:
- Include 3-4 items per section
- Each item MUST have a upscTag (e.g., "GS1 History", "GS2 Polity", "GS2 IR", "GS3 Economy", "GS3 Environment", "GS4 Ethics", "Prelims", "Essay")
- Headlines should be crisp and factual
- Details should explain significance for UPSC
- One-line notes should be quick-reference style with arrows (→) showing UPSC relevance
- Include 6-8 one-line notes covering all important developments
- Focus on recent/current developments that are UPSC relevant
- Be specific with data, names, and dates where applicable`;

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
          { role: "user", content: `Generate today's (${today}) UPSC Daily Intelligence Report with the latest important developments across all categories.` }
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

    let report;
    try {
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.replace(/```json?\n?/g, "").replace(/```\n?/g, "");
      }
      report = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("Failed to parse report JSON:", content);
      // Fallback structure
      report = {
        date: today,
        sections: [
          {
            title: "India's Internal Affairs",
            icon: "shield",
            items: [
              { headline: "Government Policy Update", detail: "Check back for latest updates on government policies and decisions.", upscTag: "GS2 Polity" }
            ]
          },
          {
            title: "Global Geo-Political Brief",
            icon: "globe",
            items: [
              { headline: "International Relations Update", detail: "Check back for latest updates on international affairs.", upscTag: "GS2 IR" }
            ]
          },
          {
            title: "Economic Intelligence",
            icon: "trending",
            items: [
              { headline: "Economic Development Update", detail: "Check back for latest economic indicators and policies.", upscTag: "GS3 Economy" }
            ]
          },
          {
            title: "Environment & Disaster Alerts",
            icon: "leaf",
            items: [
              { headline: "Environment Update", detail: "Check back for latest environmental news and alerts.", upscTag: "GS3 Environment" }
            ]
          }
        ],
        oneLineNotes: [
          "Stay updated with daily news for comprehensive UPSC preparation",
          "Focus on connecting current events to syllabus topics"
        ]
      };
    }

    return new Response(JSON.stringify({ report }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error in daily-intel-report:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
