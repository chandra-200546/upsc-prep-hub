import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const UPSC_SUBJECTS = [
  "Indian History",
  "Indian Polity",
  "Geography",
  "Economy",
  "Environment & Ecology",
  "Science & Technology",
  "Current Affairs",
  "Art & Culture"
];

const normalizeQuestionText = (text: string): string =>
  text.toLowerCase().replace(/\s+/g, " ").trim();

const getLevelDescription = (level: number): string => {
  switch (level) {
    case 1: return "Basic factual questions. Direct recall from NCERT books. Single concept questions.";
    case 2: return "Moderate difficulty. Requires understanding of concepts. May involve 2 related concepts.";
    case 3: return "Intermediate level. Application-based questions. Requires connecting multiple concepts.";
    case 4: return "Advanced level. Analytical questions. Requires deep understanding and current affairs linkage.";
    case 5: return "Expert level. Complex multi-dimensional questions. Requires critical thinking, elimination skills, and comprehensive knowledge.";
    default: return "Standard UPSC Prelims level question.";
  }
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { level = 1, count = 5, subject, excludeQuestions = [] } = await req.json();
    
    const OPENAI_API_KEY = Deno.env.get('OPENAI_API_KEY');
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not configured');
    }

    const selectedSubject = subject || UPSC_SUBJECTS[Math.floor(Math.random() * UPSC_SUBJECTS.length)];
    const levelDescription = getLevelDescription(level);

    const parseQuestions = (content: string): any[] => {
      let cleanContent = content.trim();
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      else if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      cleanContent = cleanContent.trim();

      const parsed = JSON.parse(cleanContent);
      if (!Array.isArray(parsed)) {
        throw new Error('AI did not return a question array');
      }
      return parsed;
    };

    const excludedSet = new Set(
      (Array.isArray(excludeQuestions) ? excludeQuestions : [])
        .filter((q: unknown) => typeof q === 'string')
        .map((q: string) => normalizeQuestionText(q))
        .filter((q: string) => q.length > 0)
    );

    const generatedUniqueSet = new Set<string>();
    const collectedQuestions: any[] = [];
    const maxAttempts = 3;

    for (let attempt = 1; attempt <= maxAttempts && collectedQuestions.length < count; attempt++) {
      const remaining = count - collectedQuestions.length;
      const requestedCount = Math.min(remaining + 2, count + 2);
      const exclusionPreview = [...excludedSet].slice(0, 30);

      const systemPrompt = `You are a UPSC Prelims question generator. Generate exactly ${requestedCount} multiple choice questions for the subject: ${selectedSubject}.

Difficulty Level: ${level}/5
Level Description: ${levelDescription}

IMPORTANT RULES:
1. Each question must have exactly 4 options (A, B, C, D)
2. Only ONE option should be correct
3. Questions should be UPSC Prelims style - factual, analytical, and elimination-based
4. Include questions from various topics within the subject
5. Make wrong options plausible but clearly incorrect upon analysis
6. For higher levels (4-5), include statement-based questions, match the following, or assertion-reason type
7. Explanations should be educational and cite sources where applicable
8. Avoid repeating or paraphrasing previously asked questions

Previously asked question stems to avoid:
${exclusionPreview.length ? exclusionPreview.map((q) => `- ${q}`).join('\n') : '- none provided'}

You must respond with a valid JSON array of questions in this exact format:
[
  {
    "question": "The question text here?",
    "option_a": "First option",
    "option_b": "Second option",
    "option_c": "Third option",
    "option_d": "Fourth option",
    "correct_answer": "A",
    "explanation": "Detailed explanation of why the answer is correct and why others are wrong.",
    "subject": "${selectedSubject}",
    "topic": "Specific topic within subject",
    "difficulty": "Level ${level}"
  }
]`;

      const userPrompt = `Generate ${requestedCount} UPSC Prelims questions for ${selectedSubject} at difficulty Level ${level}. Questions must be different from any previously asked questions and should include variety in question types and topics.`;

      console.log(`Generating questions for ${selectedSubject} at Level ${level}, attempt ${attempt}`);

      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'google/gemini-3-flash-preview',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt }
          ],
          temperature: 0.8,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
            status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        if (response.status === 402) {
          return new Response(JSON.stringify({ error: 'AI credits exhausted. Please add credits.' }), {
            status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }
        const errorText = await response.text();
        console.error('AI Gateway error:', response.status, errorText);
        throw new Error(`AI Gateway error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices?.[0]?.message?.content;
      if (!content) {
        throw new Error('No content in AI response');
      }

      let parsedQuestions: any[] = [];
      try {
        parsedQuestions = parseQuestions(content);
      } catch (parseError) {
        console.error('Failed to parse AI response:', content);
        throw new Error('Failed to parse questions from AI response');
      }

      parsedQuestions.forEach((q: any) => {
        if (!q || typeof q.question !== 'string') return;
        const normalized = normalizeQuestionText(q.question);
        if (!normalized) return;
        if (excludedSet.has(normalized) || generatedUniqueSet.has(normalized)) return;
        if (!q.option_a || !q.option_b || !q.option_c || !q.option_d) return;

        generatedUniqueSet.add(normalized);
        excludedSet.add(normalized);
        collectedQuestions.push(q);
      });
    }

    if (collectedQuestions.length < count) {
      throw new Error('Unable to generate enough unique questions for this level. Please retry.');
    }

    // Save questions to the database so we have real UUIDs for attempt tracking
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

    const questionsToInsert = collectedQuestions.slice(0, count).map((q: any) => ({
      question: q.question,
      option_a: q.option_a,
      option_b: q.option_b,
      option_c: q.option_c,
      option_d: q.option_d,
      correct_answer: q.correct_answer?.toUpperCase() || 'A',
      explanation: q.explanation || 'No explanation provided.',
      subject: q.subject || selectedSubject,
      topic: q.topic || 'General',
      difficulty: q.difficulty || `Level ${level}`,
    }));

    const { data: savedQuestions, error: insertError } = await supabaseAdmin
      .from('prelims_questions')
      .insert(questionsToInsert)
      .select();

    if (insertError) {
      console.error('Error saving questions to DB:', insertError);
      throw new Error('Failed to save questions');
    }

    // Return saved questions with real DB UUIDs
    const validatedQuestions = savedQuestions.map((q: any) => ({
      ...q,
      level: level,
    }));

    console.log(`Successfully generated and saved ${validatedQuestions.length} questions`);

    return new Response(JSON.stringify({ 
      questions: validatedQuestions,
      level,
      subject: selectedSubject 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating questions:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to generate questions' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

