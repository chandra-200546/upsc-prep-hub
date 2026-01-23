import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { type = 'daily', topic = null, forceRefresh = false } = await req.json();
    
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY is not configured');
    }

    const today = new Date().toISOString().split('T')[0];
    
    // For daily type, check cache first (unless force refresh)
    if (type === 'daily' && !forceRefresh && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { data: cached } = await supabase
        .from('daily_current_affairs_cache')
        .select('affairs')
        .eq('date', today)
        .maybeSingle();
      
      if (cached) {
        console.log('Returning cached current affairs for', today);
        return new Response(JSON.stringify({ affairs: cached.affairs, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }
    
    let systemPrompt = `You are an expert UPSC current affairs analyst. Generate current affairs news items that are highly relevant for UPSC Civil Services Examination preparation.

Today's date is ${today}.

Each news item should include:
- A clear, concise title
- A detailed summary (2-3 sentences)
- Category (one of: Polity, Economy, Environment, Science & Technology, International Relations, Art & Culture, Social Issues, Security, Geography)
- Importance level for UPSC (high, medium, low)
- Relevant tags for easy filtering
- Full content with UPSC perspective and potential exam angles

Generate realistic, educational current affairs that would be valuable for UPSC aspirants. Focus on:
- Government policies and schemes
- Constitutional developments
- Economic indicators and reforms
- International treaties and relations
- Environmental issues and climate action
- Scientific achievements and technology
- Social welfare programs
- Security and defense matters

IMPORTANT: Return ONLY a valid JSON array with no markdown formatting, no code blocks, just the raw JSON.`;

    let userPrompt = '';
    
    if (type === 'daily') {
      userPrompt = `Generate exactly 20 current affairs news items for today (${today}) that are most relevant for UPSC preparation. 

Return a JSON array with this exact structure:
[
  {
    "title": "News Title",
    "summary": "Brief 2-3 sentence summary",
    "category": "Category Name",
    "importance_level": "high|medium|low",
    "tags": ["tag1", "tag2", "tag3"],
    "full_content": "Detailed content with UPSC perspective, key points, and exam relevance (200-300 words)",
    "date": "${today}"
  }
]

Ensure variety across all categories and include at least 5 high-importance items.`;
    } else if (type === 'weekly') {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      userPrompt = `Generate a comprehensive weekly digest of 25 most important current affairs from ${weekAgo} to ${today} for UPSC preparation.

Return a JSON array with this exact structure:
[
  {
    "title": "News Title",
    "summary": "Brief 2-3 sentence summary",
    "category": "Category Name",
    "importance_level": "high|medium|low",
    "tags": ["tag1", "tag2", "tag3"],
    "full_content": "Detailed content with UPSC perspective, key points, and exam relevance (200-300 words)",
    "date": "YYYY-MM-DD"
  }
]

Focus on major developments that are likely to appear in UPSC exams.`;
    } else if (type === 'topic' && topic) {
      userPrompt = `Generate 15 current affairs news items specifically about "${topic}" that are relevant for UPSC preparation.

Return a JSON array with this exact structure:
[
  {
    "title": "News Title",
    "summary": "Brief 2-3 sentence summary",
    "category": "${topic}",
    "importance_level": "high|medium|low",
    "tags": ["tag1", "tag2", "tag3"],
    "full_content": "Detailed content with UPSC perspective, key points, and exam relevance (200-300 words)",
    "date": "${today}"
  }
]

Include both recent developments and important background context for this topic.`;
    }

    console.log(`Generating ${type} current affairs${topic ? ` for topic: ${topic}` : ''}`);

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-3-flash-preview',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }), {
          status: 429,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: 'API credits exhausted. Please try again later.' }), {
          status: 402,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
      const errorText = await response.text();
      console.error('AI API error:', response.status, errorText);
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from AI');
    }

    console.log('Raw AI response received, parsing...');

    // Clean up the response - remove markdown code blocks if present
    let cleanedContent = content.trim();
    if (cleanedContent.startsWith('```json')) {
      cleanedContent = cleanedContent.slice(7);
    } else if (cleanedContent.startsWith('```')) {
      cleanedContent = cleanedContent.slice(3);
    }
    if (cleanedContent.endsWith('```')) {
      cleanedContent = cleanedContent.slice(0, -3);
    }
    cleanedContent = cleanedContent.trim();

    // Parse the JSON
    let affairs;
    try {
      affairs = JSON.parse(cleanedContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.log('Content that failed to parse:', cleanedContent.substring(0, 500));
      throw new Error('Failed to parse AI response as JSON');
    }

    // Validate and ensure proper structure
    if (!Array.isArray(affairs)) {
      throw new Error('AI response is not an array');
    }

    // Add IDs and ensure all required fields
    const processedAffairs = affairs.map((item: any, index: number) => ({
      id: `ai-${Date.now()}-${index}`,
      title: item.title || 'Untitled',
      summary: item.summary || '',
      category: item.category || 'General',
      importance_level: item.importance_level || 'medium',
      tags: Array.isArray(item.tags) ? item.tags : [],
      full_content: item.full_content || item.summary || '',
      date: item.date || today,
    }));

    console.log(`Successfully generated ${processedAffairs.length} current affairs items`);

    // Cache daily affairs in database
    if (type === 'daily' && SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
      const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
      
      const { error: upsertError } = await supabase
        .from('daily_current_affairs_cache')
        .upsert({
          date: today,
          affairs: processedAffairs,
          generated_at: new Date().toISOString()
        }, { onConflict: 'date' });
      
      if (upsertError) {
        console.error('Failed to cache current affairs:', upsertError);
      } else {
        console.log('Cached current affairs for', today);
      }
    }

    return new Response(JSON.stringify({ affairs: processedAffairs }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error generating current affairs:', error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : 'Failed to generate current affairs' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});