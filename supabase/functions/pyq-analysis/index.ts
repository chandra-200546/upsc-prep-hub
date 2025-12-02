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
    const { examType, analysisType } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    const examDescriptions: Record<string, string> = {
      prelims: "UPSC Civil Services Preliminary Examination (General Studies Paper I & II)",
      mains: "UPSC Civil Services Main Examination (GS Papers I-IV)",
      optional: "UPSC Optional Subject Papers",
      essay: "UPSC Essay Paper"
    };

    const prompt = `You are an expert UPSC analyst with deep knowledge of the last 40 years (1984-2024) of UPSC examination patterns.

Analyze the ${examDescriptions[examType] || examType} and provide a comprehensive JSON response with the following structure:

{
  "trends": [
    {
      "subject": "Subject/Topic Name",
      "weightage": <number 1-100 representing current percentage>,
      "trend": "rising" | "stable" | "declining",
      "yearsAnalyzed": "1984-2024",
      "keyInsight": "One line insight about this subject's trend"
    }
  ],
  "predictions": [
    {
      "topic": "Specific topic name",
      "probability": "high" | "medium" | "low",
      "questionType": "statement-based" | "fact-based" | "concept-based" | "application-based",
      "reasoning": "Why this topic is likely to appear"
    }
  ],
  "strategy": [
    {
      "priority": <1-5>,
      "action": "Specific action to take",
      "reason": "Why this is important",
      "timeframe": "Suggested timeframe"
    }
  ],
  "pyqQuestions": [
    {
      "id": "unique_id",
      "year": <year number>,
      "question": "The question text",
      "options": ["Option A text", "Option B text", "Option C text", "Option D text"],
      "correctAnswer": "A" | "B" | "C" | "D",
      "explanation": "Detailed explanation of why this is the correct answer",
      "subject": "Subject name",
      "difficulty": "easy" | "medium" | "hard"
    }
  ]
}

Generate:
- 8 trend items covering major subjects
- 6 predictions for upcoming examination
- 5 strategic recommendations
- 10 sample PYQ-style questions with proper UPSC-style formatting

Focus on accuracy and realistic patterns observed in UPSC exams. The questions should be authentic PYQ-style questions that could appear in ${examType}.

IMPORTANT: Return ONLY valid JSON, no markdown or additional text.`;

    console.log("Generating PYQ analysis for:", examType);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: "You are an expert UPSC analyst. Always respond with valid JSON only." },
          { role: "user", content: prompt }
        ],
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

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error("No content in AI response");
    }

    console.log("Raw AI response:", content.substring(0, 500));

    // Parse the JSON response
    let analysisData;
    try {
      // Clean up the response - remove markdown code blocks if present
      let cleanContent = content.trim();
      if (cleanContent.startsWith("```json")) {
        cleanContent = cleanContent.slice(7);
      } else if (cleanContent.startsWith("```")) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith("```")) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      analysisData = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error("JSON parse error:", parseError);
      console.error("Content that failed to parse:", content);
      throw new Error("Failed to parse AI response as JSON");
    }

    return new Response(JSON.stringify(analysisData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("pyq-analysis error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
