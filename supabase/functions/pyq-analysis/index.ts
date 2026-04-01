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
    const { examType, analysisType, subject, level = 1, count = 20 } = await req.json();
    const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY");
    
    if (!GEMINI_API_KEY) {
      throw new Error("GEMINI_API_KEY is not configured");
    }

    const examDescriptions: Record<string, string> = {
      prelims: "UPSC Civil Services Preliminary Examination (General Studies Paper I & II)",
      mains: "UPSC Civil Services Main Examination (GS Papers I-IV)",
      optional: "UPSC Optional Subject Papers",
      essay: "UPSC Essay Paper"
    };

    const questionSchemaByExam = examType === "prelims"
      ? `"pyqQuestions": [
    {
      "id": "unique_id",
      "year": <year number>,
      "question": "Exact previous-year prelims question text",
      "options": ["Exact option A text", "Exact option B text", "Exact option C text", "Exact option D text"],
      "correctAnswer": "A" | "B" | "C" | "D",
      "explanation": "Detailed explanation of why this is the correct answer",
      "subject": "Subject name",
      "difficulty": "easy" | "medium" | "hard",
      "level": <integer 1-5>
    }
  ]`
      : `"pyqQuestions": [
    {
      "id": "unique_id",
      "year": <year number>,
      "question": "Exact previous-year descriptive question text",
      "subject": "Paper/Subject area",
      "difficulty": "easy" | "medium" | "hard",
      "level": <integer 1-5>,
      "wordLimit": <recommended word limit>,
      "expectedApproach": "What a high-quality answer should include"
    }
  ]`;

    if (analysisType === "practice_only" && examType === "prelims") {
      const practicePrompt = `Return ONLY valid JSON with this exact shape:
{
  "trends": [],
  "predictions": [],
  "strategy": [],
  "pyqQuestions": [
    {
      "id": "unique_id",
      "year": <year number>,
      "question": "Exact previous-year prelims question text",
      "options": ["Exact option A text", "Exact option B text", "Exact option C text", "Exact option D text"],
      "correctAnswer": "A" | "B" | "C" | "D",
      "explanation": "Detailed explanation",
      "subject": "${subject || "Indian Polity"}",
      "difficulty": "easy" | "medium" | "hard",
      "level": ${level}
    }
  ]
}

Generate exactly ${count} real previous-year UPSC Prelims PYQs for:
Subject: ${subject || "Indian Polity"}
Level: ${level}

Rules:
1. Every question must belong to this exact subject.
2. Every question must have level ${level}.
3. Keep original PYQ wording/options as close as possible.
4. No markdown, no extra text, JSON only.`;

      const focusedResponse = await fetch("https://generativelanguage.googleapis.com/v1beta/openai/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${GEMINI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert UPSC analyst. Always respond with valid JSON only." },
            { role: "user", content: practicePrompt }
          ],
          temperature: 0.4,
        }),
      });

      if (!focusedResponse.ok) {
        return new Response(JSON.stringify({ error: "Failed to generate practice set" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const focusedData = await focusedResponse.json();
      const focusedContent = focusedData.choices?.[0]?.message?.content;
      if (!focusedContent) {
        return new Response(JSON.stringify({ error: "No content in practice response" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      let cleanFocused = focusedContent.trim();
      if (cleanFocused.startsWith("```json")) cleanFocused = cleanFocused.slice(7);
      else if (cleanFocused.startsWith("```")) cleanFocused = cleanFocused.slice(3);
      if (cleanFocused.endsWith("```")) cleanFocused = cleanFocused.slice(0, -3);
      cleanFocused = cleanFocused.trim();

      const parsed = JSON.parse(cleanFocused);
      return new Response(JSON.stringify(parsed), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const practiceGuidanceByExam = examType === "prelims"
      ? `For PYQ questions, use only real previous-year UPSC Prelims questions and retain original wording/options as closely as possible.
Each prelims question must include a subject and level (1-5).
Cover all these subjects with balanced distribution:
- Indian Economy
- Indian Polity
- Ancient History
- Modern History
- Geography
- Current Events / General Knowledge
- Social Development / Government Schemes
- Environment & Ecology
- Science & Technology
Ensure all levels 1 to 5 are represented.`
      : `For PYQ questions, use only real previous-year UPSC descriptive questions for this exam type.
Questions must be answer-writing friendly and include wordLimit and expectedApproach.`;

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
  ${questionSchemaByExam}
}

Generate:
- 8 trend items covering major subjects
- 6 predictions for upcoming examination
- 5 strategic recommendations
- 24 sample PYQs for prelims OR 15 sample PYQs for other exam types, with proper UPSC-style formatting

Focus on accuracy and realistic patterns observed in UPSC exams. The questions should be authentic PYQ-style questions that could appear in ${examType}.
${practiceGuidanceByExam}

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
      const fallbackPrompt = `Return ONLY valid JSON with this shape:
{
  "trends": [],
  "predictions": [],
  "strategy": [],
  ${questionSchemaByExam}
}

Exam type: ${examType}
Keep response compact. Use 12 PYQs for prelims or 8 PYQs for other exam types.
No markdown.`;

      const fallbackResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an expert UPSC analyst. Always respond with valid JSON only." },
            { role: "user", content: fallbackPrompt }
          ],
          temperature: 0.3,
        }),
      });

      if (!fallbackResponse.ok) {
        throw new Error("Failed to parse AI response as JSON");
      }

      const fallbackData = await fallbackResponse.json();
      const fallbackContent = fallbackData.choices?.[0]?.message?.content;
      if (!fallbackContent) {
        throw new Error("Failed to parse AI response as JSON");
      }

      let cleanFallback = fallbackContent.trim();
      if (cleanFallback.startsWith("```json")) cleanFallback = cleanFallback.slice(7);
      else if (cleanFallback.startsWith("```")) cleanFallback = cleanFallback.slice(3);
      if (cleanFallback.endsWith("```")) cleanFallback = cleanFallback.slice(0, -3);
      cleanFallback = cleanFallback.trim();

      analysisData = JSON.parse(cleanFallback);
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
