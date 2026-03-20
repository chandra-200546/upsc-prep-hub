import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RagChunk = {
  id: string;
  chapter: string;
  topic: string;
  text: string;
};

const LAXMIKANT_RAG_CHUNKS: RagChunk[] = [
  { id: "c01", chapter: "Constitutional Framework", topic: "Historical Background", text: "Indian constitutional evolution moved from Company control to Crown governance and then democratic self-rule. Key milestones include Regulating Act 1773, Pitt's India Act 1784, Charter Acts, Government of India Act 1919, Government of India Act 1935, and Independence framework of 1947." },
  { id: "c02", chapter: "Constitutional Framework", topic: "Making of Constitution", text: "Constituent Assembly worked through committees, debates, and drafting rounds. The Constitution blended legal continuity with transformative goals: justice, liberty, equality, fraternity, and democratic accountability." },
  { id: "c03", chapter: "Constitutional Framework", topic: "Salient Features", text: "Core features include a detailed written Constitution, parliamentary government, federal system with unitary tilt, independent judiciary, judicial review, integrated services, and constitutional supremacy." },
  { id: "c04", chapter: "Constitutional Framework", topic: "Preamble", text: "The Preamble declares India as sovereign, socialist, secular, democratic republic and commits to justice, liberty, equality, and fraternity. It acts as interpretive guidance in constitutional adjudication." },
  { id: "c05", chapter: "Constitutional Framework", topic: "Union and Territory", text: "The Constitution allows reorganization of states and territories through parliamentary law. It preserves unity while enabling administrative adaptation over time." },
  { id: "c06", chapter: "Constitutional Framework", topic: "Citizenship", text: "Citizenship provisions at commencement were constitutional, while acquisition and termination are governed by statute. Citizenship links civil-political rights and constitutional membership." },
  { id: "c07", chapter: "Constitutional Framework", topic: "Fundamental Rights", text: "Fundamental Rights protect individual liberty and equality against arbitrary state action. Rights are enforceable through constitutional remedies and interpreted dynamically by courts." },
  { id: "c08", chapter: "Constitutional Framework", topic: "DPSP", text: "Directive Principles guide state policy toward social and economic justice. Though non-justiciable, they shape legislation and welfare governance priorities." },
  { id: "c09", chapter: "Constitutional Framework", topic: "Fundamental Duties", text: "Fundamental Duties emphasize civic responsibility and constitutional culture. They support social discipline, national integration, and public ethics." },
  { id: "c10", chapter: "Constitutional Framework", topic: "Amendment", text: "Amendment procedures combine flexibility and rigidity. Different provisions require simple majority, special majority, or special majority with state ratification." },
  { id: "c11", chapter: "Constitutional Framework", topic: "Basic Structure", text: "Basic Structure doctrine limits amendment power and protects constitutional identity. It preserves supremacy of Constitution, separation of powers, judicial review, and core democratic values." },
  { id: "c12", chapter: "System of Government", topic: "Parliamentary System", text: "India follows parliamentary executive responsibility where real authority rests in the Council of Ministers headed by PM. Cabinet accountability to lower house is central." },
  { id: "c13", chapter: "System of Government", topic: "Federal System", text: "Indian federalism has dual polity and constitutional division of powers, but stronger Union capabilities in emergencies and national integration matters." },
  { id: "c14", chapter: "System of Government", topic: "Centre-State Relations", text: "Relations are legislative, administrative, and financial. Coordination bodies and finance architecture affect cooperative federal performance." },
  { id: "c15", chapter: "System of Government", topic: "Inter-State Relations", text: "Inter-state mechanisms include councils, tribunals, and constitutional coordination frameworks for disputes and policy alignment." },
  { id: "c16", chapter: "System of Government", topic: "Emergency Provisions", text: "Emergency framework includes national emergency, state emergency, and financial emergency. Safeguards exist to balance security with constitutional liberty." },
  { id: "c17", chapter: "Central Government", topic: "President", text: "President is constitutional head, acts on aid and advice except narrow discretionary spaces. Key powers include legislative assent, ordinance, and pardon." },
  { id: "c18", chapter: "Central Government", topic: "Prime Minister and Council", text: "PM leads council, policy direction, and parliamentary coordination. Collective responsibility is the operating principle." },
  { id: "c19", chapter: "Central Government", topic: "Parliament", text: "Parliament performs legislation, representation, and executive accountability. Financial control and committee scrutiny are crucial institutional tools." },
  { id: "c20", chapter: "Central Government", topic: "Parliamentary Committees", text: "Committees provide specialized scrutiny, technical review, and accountability depth beyond floor debates." },
  { id: "c21", chapter: "State Government", topic: "Governor", text: "Governor is state constitutional head. Role involves assent, constitutional reporting, and limited discretion under constitutional conventions." },
  { id: "c22", chapter: "State Government", topic: "Chief Minister and Council", text: "CM is real executive at state level, leading policy and administration through council responsibility to legislature." },
  { id: "c23", chapter: "State Government", topic: "High Court and Subordinate Courts", text: "High Courts exercise constitutional supervision, writ jurisdiction, and judicial review in state context. Subordinate judiciary forms justice delivery backbone." },
  { id: "c24", chapter: "Local Government", topic: "Panchayati Raj", text: "73rd Amendment constitutionalized rural local self-governance. Effective devolution depends on funds, functions, and functionaries." },
  { id: "c25", chapter: "Local Government", topic: "Municipalities", text: "74th Amendment structured urban local governance with elected representation, planning responsibilities, and service delivery mandates." },
  { id: "c26", chapter: "Constitutional Bodies", topic: "Election Commission", text: "Election Commission ensures free and fair elections through constitutional mandate. Institutional neutrality and enforcement credibility are key." },
  { id: "c27", chapter: "Constitutional Bodies", topic: "UPSC and SPSC", text: "Public service commissions uphold merit-based recruitment and advisory integrity in administrative appointments." },
  { id: "c28", chapter: "Constitutional Bodies", topic: "Finance Commission", text: "Finance Commission recommends tax devolution and grants to maintain fiscal balance across Union and states." },
  { id: "c29", chapter: "Constitutional Bodies", topic: "CAG", text: "CAG audits public finance and strengthens legislative accountability over executive expenditure." },
  { id: "c30", chapter: "Non-Constitutional Bodies", topic: "NITI Aayog", text: "NITI Aayog functions as policy think-tank and cooperative federal platform replacing centralized planning model." },
  { id: "c31", chapter: "Non-Constitutional Bodies", topic: "Lokpal and Lokayuktas", text: "Anti-corruption ombudsman institutions investigate public corruption concerns through statutory design." },
  { id: "c32", chapter: "Political Dynamics", topic: "Anti-Defection Law", text: "Anti-defection law aims to stabilize legislatures but raises questions about deliberative freedom and intra-party democracy." },
  { id: "c33", chapter: "Political Dynamics", topic: "Election Laws and RPA", text: "Election laws and Representation of People framework regulate candidature, conduct, disqualification, and electoral fairness." },
  { id: "c34", chapter: "Extra Chapters", topic: "Landmark Judgments", text: "Landmark judgments shaped constitutional interpretation in areas like rights, federalism, secularism, judicial review, and institutional balance." },
];

const tokenize = (input: string) =>
  input
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

const retrieveChunks = (query: string, limit = 6): RagChunk[] => {
  const qTokens = new Set(tokenize(query));
  const scored = LAXMIKANT_RAG_CHUNKS.map((chunk) => {
    const tokens = tokenize(`${chunk.chapter} ${chunk.topic} ${chunk.text}`);
    let overlap = 0;
    for (const t of tokens) {
      if (qTokens.has(t)) overlap += 1;
    }
    const titleBoost = qTokens.has(chunk.topic.toLowerCase()) ? 5 : 0;
    return { chunk, score: overlap + titleBoost };
  })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((x) => x.chunk);

  if (scored.length > 0) return scored;
  return LAXMIKANT_RAG_CHUNKS.slice(0, limit);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subject, topic } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!topic || typeof topic !== "string" || !topic.trim()) {
      return new Response(JSON.stringify({ error: "Topic is required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (subject !== "polity") {
      return new Response(JSON.stringify({ error: "Only polity is enabled right now" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const retrieved = retrieveChunks(topic.trim(), 8);
    const ragContext = retrieved
      .map((c, i) => `[${i + 1}] Chapter: ${c.chapter} | Topic: ${c.topic}\n${c.text}`)
      .join("\n\n");

    const systemPrompt = `You are an expert UPSC Polity teacher and instructional designer.
Generate complete PPT-style notes for the given topic, aligned to Indian Polity preparation depth.

IMPORTANT:
- Use the provided RAG context chunks as primary reference knowledge.
- Keep the explanation faithful to the reference but in original paraphrased wording.
- Do NOT quote copyrighted text verbatim. Use faithful paraphrase.
- Cover basics to advanced, no major concept skipping.
- Include exam orientation (Prelims + Mains + Interview).
- Keep language beginner-friendly and classroom style.

Output STRICT JSON only with this exact schema:
{
  "topicTitle": "string",
  "chapterTitle": "string",
  "sources": ["Chapter - Topic"],
  "slides": [
    {
      "heading": "string",
      "bullets": ["string", "string"],
      "detailedExplanation": "string",
      "example": "string",
      "visualTitle": "string",
      "visualLines": ["string", "string"]
    }
  ]
}

Generate exactly 10 slides, in this order:
1) Introduction
2) Why Important
3) Fundamentals
4) Constitutional/Legal Anchor
5) Process Flow
6) Intermediate Analysis
7) Advanced Issues and Reforms
8) Memory Tricks + Common Mistakes
9) Exam-Oriented Questions
10) Summary + Quick Revision

RAG CONTEXT:
${ragContext}
`;

    const userPrompt = `Subject: Polity
Topic: ${topic.trim()}
Create the full 10-slide deck now.
Include a "sources" array in output using the provided context labels.`;

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
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        stream: false,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("upsc-notes-slides error:", response.status, errorText);
      return new Response(JSON.stringify({ error: "AI gateway request failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const content = data?.choices?.[0]?.message?.content;
    if (!content) {
      return new Response(JSON.stringify({ error: "No content returned" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const cleaned = String(content).trim();
    const jsonMatch = cleaned.match(/```json\s*([\s\S]*?)```/i);
    let rawJson = jsonMatch?.[1]?.trim() || cleaned;
    if (!rawJson.startsWith("{")) {
      const first = rawJson.indexOf("{");
      const last = rawJson.lastIndexOf("}");
      if (first >= 0 && last > first) {
        rawJson = rawJson.slice(first, last + 1);
      }
    }
    const parsed = JSON.parse(rawJson);

    return new Response(JSON.stringify(parsed), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("upsc-notes-slides exception:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
