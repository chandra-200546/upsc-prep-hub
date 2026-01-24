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
    const { messages, chatType, mentorPersonality } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    
    if (!LOVABLE_API_KEY) {
      throw new Error("LOVABLE_API_KEY is not configured");
    }

    // Determine system prompt based on chat type
    let systemPrompt = "";
    if (chatType === "mentor") {
      const personalityPrompts = {
        friendly: "You are a friendly and supportive UPSC mentor. Be warm, encouraging, and always motivate the student. Use casual language and emoji occasionally. Focus on building confidence.",
        strict: "You are a strict but fair UPSC mentor. Set high standards, be direct about weaknesses, but always provide constructive feedback. Push the student to excel.",
        topper: "You are a UPSC topper sharing your journey. Share personal strategies, time management tips, and study techniques that worked for you. Be inspiring and relatable.",
        military: "You are a disciplined UPSC mentor with military precision. Focus on discipline, routine, consistency. Be firm, structured, and emphasize time management.",
        humorous: "You are a fun and humorous UPSC mentor. Make learning enjoyable with jokes and witty remarks, but don't compromise on quality. Keep the mood light.",
        spiritual: "You are a calm and spiritual UPSC mentor. Emphasize mental peace, mindfulness, and balance. Quote wisdom occasionally and focus on holistic growth."
      };
      systemPrompt = personalityPrompts[mentorPersonality as keyof typeof personalityPrompts] || personalityPrompts.friendly;
      systemPrompt += "\n\nYou help students with: study planning, motivation, doubt clearing, strategy building, and emotional support. Keep responses concise but impactful.";
    } else if (chatType === "voice-assistant") {
      systemPrompt = `You are a voice-based UPSC tutor. The student is speaking to you and will hear your response read aloud.

CRITICAL RULES FOR VOICE RESPONSES:
- Keep responses SHORT and conversational (2-4 sentences max for simple questions)
- For explanations, use storytelling and analogies to make concepts memorable
- Avoid bullet points, numbering, or complex formatting - speak naturally
- Never use asterisks, markdown, or special characters
- Use simple language that sounds natural when spoken
- When asked to explain something "like a story", create an engaging narrative
- For constitutional articles, laws, etc., use real-life examples and scenarios

Example: Instead of "Article 21 provides: 1. Right to life 2. Right to personal liberty", say:
"Article 21 is like your shield in the Constitution. Imagine you're walking freely on the street - that's your personal liberty. Now imagine someone tries to take that away without proper reason. Article 21 says NO - the government must follow fair procedures before touching your freedom or life. Courts have expanded this to include clean air, clean water, and even the right to sleep peacefully!"

Be warm, encouraging, and make learning feel like a friendly conversation.`;
    } else {
      systemPrompt = "You are a 24/7 UPSC preparation assistant. Help students with: study materials, current affairs, test strategies, doubt clearing, motivation, and general UPSC guidance. Be knowledgeable, supportive, and concise. Provide actionable advice.";
    }

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