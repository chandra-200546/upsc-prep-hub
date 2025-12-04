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
    const { mode, subject, topic, question, answer } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    let systemPrompt = "";
    let userPrompt = "";

    switch (mode) {
      case "explain":
        systemPrompt = `You are an expert UPSC professor specializing in ${subject}. You have deep knowledge of standard textbooks, coaching institute notes, topper answer patterns, and 40 years of UPSC question trends.

Your explanations should be:
- UPSC-oriented (not generic internet content)
- Include relevant diagrams/structures where applicable
- Provide real examples and case studies
- Highlight UPSC relevance and how this topic has been asked before

Respond in JSON format:
{
  "overview": "Clear conceptual explanation in 200-300 words",
  "keyPoints": ["Array of 5-7 key points to remember"],
  "examples": ["Array of 2-3 relevant examples or case studies with UPSC context"],
  "upscRelevance": "How this topic is important for UPSC, past questions references",
  "diagram": "ASCII art or structured representation of the concept if applicable"
}`;
        userPrompt = `Explain the topic "${topic}" in ${subject} for UPSC preparation.`;
        break;

      case "trends":
        systemPrompt = `You are a UPSC exam analyst with access to 40 years of ${subject} optional paper data. Analyze question patterns and provide strategic insights.

Respond in JSON format:
{
  "recurringTopics": ["Array of 8-10 most frequently asked topics"],
  "predictions": ["Array of 5-7 high-probability questions for upcoming exam"],
  "ignoredTopics": ["Array of 5-6 topics not asked in last 10-15 years but important"],
  "yearWiseBreakdown": [{"topic": "Topic name", "frequency": number}],
  "strategy": "Detailed preparation strategy for ${subject} based on trends"
}`;
        userPrompt = `Analyze the PYQ trends for ${subject} optional subject and provide predictions and strategy.`;
        break;

      case "evaluate":
        systemPrompt = `You are a strict UPSC answer evaluator and mentor for ${subject}. Evaluate answers based on UPSC standards:
- Structure (Introduction, Body, Conclusion)
- Content depth and accuracy
- Use of examples, case studies, scholars
- Presentation and flow
- UPSC-specific requirements

Respond in JSON format:
{
  "score": number (out of 20),
  "breakdown": {
    "structure": number (out of 5),
    "content": number (out of 5),
    "examples": number (out of 5),
    "presentation": number (out of 5)
  },
  "strengths": ["Array of 2-3 strong points"],
  "improvements": ["Array of 3-4 specific improvements needed"],
  "feedback": "Detailed feedback paragraph",
  "modelAnswer": "Brief outline of how a model answer should be structured"
}`;
        userPrompt = `Question: ${question}

Student's Answer: ${answer}

Evaluate this ${subject} optional answer.`;
        break;

      case "daily-practice":
        systemPrompt = `You are a UPSC question setter for ${subject} optional. Generate practice questions that:
- Are at UPSC Mains level
- Cover important topics
- Test conceptual understanding
- Are diverse in type (analytical, comparative, evaluate, discuss)

Respond in JSON format:
{
  "question": "The practice question",
  "type": "Question type (Analytical/Comparative/Evaluate/Discuss)",
  "marks": 20,
  "hint": "Brief hint or approach to answer this question",
  "relatedTopics": ["Array of related topics to study"]
}`;
        userPrompt = `Generate a practice question for ${subject} optional at UPSC Mains level.`;
        break;

      case "revision":
        systemPrompt = `You are creating rapid revision material for ${subject} UPSC optional. Create comprehensive but concise revision content that can be revised in 15-20 minutes.

Respond in JSON format:
{
  "topic": "${topic}",
  "keyPoints": ["Array of 8-10 most important points"],
  "mindMap": "ASCII representation of mind map connecting concepts",
  "oneLiners": ["Array of 10-12 crisp one-liner facts for quick recall"],
  "importantFacts": ["Array of 6-8 important facts, dates, figures"],
  "pyqConnection": "How this topic has been asked in UPSC and expected questions"
}`;
        userPrompt = `Create a rapid revision sheet for the topic "${topic}" in ${subject}.`;
        break;

      default:
        throw new Error("Invalid mode");
    }

    console.log(`Processing ${mode} request for ${subject}`);

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("AI gateway error:", response.status, errorText);
      
      if (response.status === 429) {
        return new Response(
          JSON.stringify({ error: "Rate limit exceeded. Please try again in a moment." }),
          { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      if (response.status === 402) {
        return new Response(
          JSON.stringify({ error: "AI credits exhausted. Please add more credits." }),
          { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      throw new Error(`AI gateway error: ${response.status}`);
    }

    const data = await response.json();
    let content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error("No content in AI response");
    }

    // Parse JSON from response
    content = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();
    
    let result;
    try {
      result = JSON.parse(content);
    } catch (e) {
      console.error("JSON parse error:", e, "Content:", content);
      throw new Error("Failed to parse AI response");
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error: unknown) {
    console.error("Error in optional-professor:", error);
    const message = error instanceof Error ? error.message : "An error occurred";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
