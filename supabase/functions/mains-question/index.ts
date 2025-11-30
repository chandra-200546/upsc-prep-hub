import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!LOVABLE_API_KEY || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      throw new Error("Required environment variables not configured");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Get today's date
    const today = new Date().toISOString().split('T')[0];

    // Check if question already exists for today
    const { data: existingQuestion } = await supabase
      .from('mains_questions')
      .select('*')
      .eq('date', today)
      .maybeSingle();

    if (existingQuestion) {
      console.log('Returning existing question for today');
      return new Response(JSON.stringify(existingQuestion), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Generating new question for today');

    // Generate new question using AI
    const categories = [
      'Governance', 'Ethics', 'Science & Technology', 'International Relations',
      'Social Issues', 'Environment', 'Economy', 'History & Culture'
    ];
    const randomCategory = categories[Math.floor(Math.random() * categories.length)];

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          {
            role: "system",
            content: "You are a UPSC Mains question generator. Generate a single high-quality essay question for UPSC Civil Services Mains exam. Return ONLY the question text, nothing else."
          },
          {
            role: "user",
            content: `Generate a UPSC Mains essay question on the topic of ${randomCategory}. The question should be thought-provoking, relevant to current affairs, and suitable for a 250-word answer. Return only the question text.`
          }
        ],
      }),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const aiData = await response.json();
    const questionText = aiData.choices[0].message.content.trim();

    // Insert new question into database
    const { data: newQuestion, error: insertError } = await supabase
      .from('mains_questions')
      .insert({
        question_text: questionText,
        category: randomCategory,
        word_limit: 250,
        date: today
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error inserting question:', insertError);
      throw insertError;
    }

    console.log('Successfully generated and stored new question');
    return new Response(JSON.stringify(newQuestion), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in mains-question function:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});