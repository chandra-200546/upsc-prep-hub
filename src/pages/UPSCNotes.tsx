import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronLeft, ChevronRight, Download, Loader2, Search, Trash2 } from "lucide-react";
import { streamOpenAIText } from "@/lib/openai-client";

type Subject = { id: string; name: string; description: string; examFocus: string };
type Slide = { slideNumber: number; topicName: string; subtopicTitle: string; structuredExplanation: string; points: string[]; keyTakeaway: string };
type CheckpointQuestion = { afterSlide: number; type: "mcq" | "short"; question: string; options?: string[]; correctAnswer: string; acceptableAnswers?: string[]; explanation: string };
type PracticeQuestion = { questionText: string; difficulty: "Easy" | "Medium" | "Hard"; type: "Prelims" | "Mains" | "Analytical"; answer: string; explanation: string; keyPoints: string[] };
type Deck = { topicTitle: string; chapterTitle: string; slides: Slide[]; checkpointQuestions: CheckpointQuestion[]; practiceQuestions: PracticeQuestion[]; revisionSummary: string[]; generatedAt: string };
type SavedNote = { id: string; subjectId: string; subjectName: string; topic: string; slidesCount: number; savedAt: string; deck: Deck; currentSlide: number; passedCheckpoints: number[]; source: "db" | "local" };
type ViewMode = "subjects" | "topic" | "study" | "practice" | "saved";

const SUBJECTS: Subject[] = [
  { id: "history", name: "History", examFocus: "GS I + Prelims", description: "Ancient to Modern trends and continuity." },
  { id: "geography", name: "Geography", examFocus: "GS I + Prelims", description: "Physical, Indian, and world geography." },
  { id: "indian-polity", name: "Indian Polity", examFocus: "GS II + Prelims", description: "Constitution, governance, institutions." },
  { id: "economy", name: "Economy", examFocus: "GS III + Prelims", description: "Macro, policy, sectors, and reforms." },
  { id: "environment-ecology", name: "Environment & Ecology", examFocus: "GS III + Prelims", description: "Ecology, climate, biodiversity, conventions." },
  { id: "science-tech", name: "Science & Technology", examFocus: "GS III + Prelims", description: "UPSC-relevant technologies and applications." },
  { id: "art-culture", name: "Art & Culture", examFocus: "GS I + Prelims", description: "Architecture, literature, dances, schools." },
  { id: "international-relations", name: "International Relations", examFocus: "GS II", description: "India and global strategic affairs." },
  { id: "ethics", name: "Ethics", examFocus: "GS IV", description: "Ethics concepts, thinkers, and case framing." },
  { id: "social-issues", name: "Social Issues", examFocus: "GS I/II", description: "Inclusion, justice, and welfare dimensions." },
  { id: "internal-security", name: "Internal Security", examFocus: "GS III", description: "Security challenges and policy responses." },
  { id: "disaster-management", name: "Disaster Management", examFocus: "GS III", description: "Risk, response, and resilience governance." },
  { id: "agriculture", name: "Agriculture", examFocus: "GS III", description: "Agri economy, technology, and reforms." },
  { id: "ancient-history", name: "Ancient History", examFocus: "GS I + Prelims", description: "Sources, dynasties, and culture." },
  { id: "medieval-history", name: "Medieval History", examFocus: "GS I + Prelims", description: "State formation, society, culture." },
  { id: "modern-history", name: "Modern History", examFocus: "GS I + Prelims", description: "Colonial policy and freedom struggle." },
  { id: "world-history", name: "World History", examFocus: "GS I", description: "Revolutions, wars, and global transitions." },
  { id: "physical-geography", name: "Physical Geography", examFocus: "GS I + Prelims", description: "Geomorphology, climatology, oceanography." },
  { id: "indian-geography", name: "Indian Geography", examFocus: "GS I + Prelims", description: "Resources, regions, and location dynamics." },
  { id: "current-affairs", name: "Current Affairs", examFocus: "GS I/II/III + Essay", description: "Issue-wise analytical current updates." },
  { id: "csat", name: "CSAT", examFocus: "Prelims Paper II", description: "Reasoning, numeracy, and comprehension." },
  { id: "essay", name: "Essay", examFocus: "Mains Essay", description: "Theme development and balanced arguments." },
  { id: "optional-placeholder", name: "Optional Subject", examFocus: "Optional Papers", description: "Placeholder for optional modules." },
];

const extractJson = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  return first >= 0 && last > first ? trimmed.slice(first, last + 1) : trimmed;
};

const lk = (u: string) => `upsc_smart_notes_${u}`;
const rk = (u: string) => `upsc_smart_notes_resume_${u}`;
const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY || "";

const normalizeDeck = (input: any, topic: string, subjectName: string): Deck => {
  const slidesRaw = Array.isArray(input?.slides) ? input.slides : [];
  const slides = slidesRaw.slice(0, 20).map((s: any, i: number) => ({
    slideNumber: i + 1,
    topicName: s?.topicName || topic,
    subtopicTitle: s?.subtopicTitle || s?.heading || `Slide ${i + 1}`,
    structuredExplanation: s?.structuredExplanation || s?.detailedExplanation || "",
    points: Array.isArray(s?.points) ? s.points : Array.isArray(s?.bullets) ? s.bullets : [],
    keyTakeaway: s?.keyTakeaway || "Revise with Prelims and Mains lens.",
  }));
  const filledSlides = slides.length >= 15 ? slides : [...slides, ...Array.from({ length: 15 - slides.length }).map((_, i) => ({ slideNumber: slides.length + i + 1, topicName: topic, subtopicTitle: `Depth ${i + 1}`, structuredExplanation: `Additional depth for ${topic}.`, points: ["Concept linkage", "UPSC framing", "Example/Case"], keyTakeaway: "Use this for quick revision." }))];
  const checkpointsRaw = Array.isArray(input?.checkpointQuestions) ? input.checkpointQuestions : [];
  const checkpointQuestions = checkpointsRaw.length > 0
    ? checkpointsRaw.map((q: any, i: number) => ({ afterSlide: Number(q?.afterSlide) || (i + 1) * 3, type: q?.type === "mcq" ? "mcq" : "short", question: q?.question || `Checkpoint ${i + 1}`, options: Array.isArray(q?.options) ? q.options : undefined, correctAnswer: q?.correctAnswer || "", acceptableAnswers: Array.isArray(q?.acceptableAnswers) ? q.acceptableAnswers : [], explanation: q?.explanation || "Review and retry." }))
    : Array.from({ length: Math.floor(filledSlides.length / 3) }).map((_, i) => ({ afterSlide: (i + 1) * 3, type: "short" as const, question: `Summarize slides ${(i + 1) * 3 - 2} to ${(i + 1) * 3}.`, correctAnswer: "concept", acceptableAnswers: ["concept", "definition", "feature"], explanation: "Checkpoint ensures retention." }));
  const practiceRaw = Array.isArray(input?.practiceQuestions) ? input.practiceQuestions : [];
  const practiceQuestions = practiceRaw.length >= 10
    ? practiceRaw.slice(0, 10).map((q: any) => ({ questionText: q?.questionText || q?.question || "", difficulty: q?.difficulty === "Easy" || q?.difficulty === "Hard" ? q.difficulty : "Medium", type: q?.type === "Mains" || q?.type === "Analytical" ? q.type : "Prelims", answer: q?.answer || "", explanation: q?.explanation || "", keyPoints: Array.isArray(q?.keyPoints) ? q.keyPoints : [] }))
    : Array.from({ length: 10 }).map((_, i) => ({ questionText: `Practice Q${i + 1} on ${topic}`, difficulty: i < 3 ? "Easy" : i < 7 ? "Medium" : "Hard", type: i < 4 ? "Prelims" : i < 8 ? "Mains" : "Analytical", answer: "Model answer: concept + relevance + way forward.", explanation: "Use structured answer writing.", keyPoints: ["Definition", "Body points", "Conclusion"] }));
  return { topicTitle: input?.topicTitle || topic, chapterTitle: input?.chapterTitle || subjectName, slides: filledSlides, checkpointQuestions, practiceQuestions, revisionSummary: Array.isArray(input?.revisionSummary) ? input.revisionSummary : ["Revise definitions.", "Map prelims with mains.", "Add examples and case references."], generatedAt: new Date().toISOString() };
};

const buildDeckFromAiText = (subjectName: string, topic: string, aiText: string) => {
  const cleaned = aiText
    .replace(/\*\*/g, "")
    .replace(/[_`#>-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const parts = cleaned
    .split(/(?<=[.!?])\s+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 30);

  const slides = Array.from({ length: 15 }).map((_, i) => {
    const base = parts[i % Math.max(1, parts.length)] || `${topic} concept in ${subjectName}.`;
    const next = parts[(i + 1) % Math.max(1, parts.length)] || base;
    return {
      slideNumber: i + 1,
      topicName: topic,
      subtopicTitle: `AI Notes Slide ${i + 1}`,
      structuredExplanation: base,
      points: [base, next, `${topic} exam linkage for Prelims + Mains.`],
      keyTakeaway: `Revision takeaway ${i + 1}: ${topic} - core conceptual clarity.`,
    };
  });

  const checkpointQuestions = [3, 6, 9, 12, 15].map((afterSlide, idx) => ({
    afterSlide,
    type: "short" as const,
    question: `Checkpoint ${idx + 1}: What is the core idea from slides ${afterSlide - 2} to ${afterSlide}?`,
    correctAnswer: "core concept",
    acceptableAnswers: ["concept", "feature", "significance", "challenge"],
    explanation: "Mention definition, one key point, and one exam-useful linkage.",
  }));

  const practiceQuestions = Array.from({ length: 10 }).map((_, i) => ({
    questionText: `Practice Q${i + 1}: ${topic} (${subjectName})`,
    difficulty: i < 3 ? ("Easy" as const) : i < 7 ? ("Medium" as const) : ("Hard" as const),
    type: i < 4 ? ("Prelims" as const) : i < 8 ? ("Mains" as const) : ("Analytical" as const),
    answer: "Answer using intro, structured body points, and balanced conclusion.",
    explanation: "Highlight constitutional/factual anchors and one current linkage.",
    keyPoints: ["Definition", "Core dimension", "Example", "Way forward"],
  }));

  return {
    topicTitle: topic,
    chapterTitle: subjectName,
    slides,
    checkpointQuestions,
    practiceQuestions,
    revisionSummary: [
      `Revise ${topic} using 5-point summary.`,
      "Separate prelims facts and mains analysis.",
      "Write one practice answer for retention.",
    ],
  };
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [userId, setUserId] = useState("");
  const [view, setView] = useState<ViewMode>("subjects");
  const [subjectId, setSubjectId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [passed, setPassed] = useState<number[]>([]);
  const [ans, setAns] = useState("");
  const [mcq, setMcq] = useState("");
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [saved, setSaved] = useState<SavedNote[]>([]);
  const [q, setQ] = useState("");

  const subject = useMemo(() => SUBJECTS.find((s) => s.id === subjectId) || null, [subjectId]);
  const slide = deck?.slides[slideIndex] || null;
  const cp = deck?.checkpointQuestions.find((x) => x.afterSlide === slideIndex + 1) || null;
  const cpPassed = cp ? passed.includes(cp.afterSlide) : true;
  const progress = deck ? Math.round(((slideIndex + 1) / deck.slides.length) * 100) : 0;

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return navigate("/auth");
      setUserId(user.id);
      await loadSaved(user.id);
      const resumeRaw = localStorage.getItem(rk(user.id));
      if (!resumeRaw) return;
      try {
        const r = JSON.parse(resumeRaw);
        if (r?.deck?.slides?.length) { setSubjectId(r.subjectId); setTopic(r.topic); setDeck(r.deck); setSlideIndex(r.slideIndex || 0); setPassed(r.passed || []); setView("study"); }
      } catch {}
    };
    init();
  }, [navigate]);

  const loadSaved = async (uid: string) => {
    const local = (() => { try { return JSON.parse(localStorage.getItem(lk(uid)) || "[]"); } catch { return []; } })();
    try {
      const db = supabase as any;
      const { data, error } = await db.from("upsc_smart_notes").select("*").eq("user_id", uid).order("created_at", { ascending: false });
      if (error) throw error;
      const dbMapped: SavedNote[] = (data || []).map((r: any) => ({ id: r.id, subjectId: r.subject_id, subjectName: r.subject_name, topic: r.topic, slidesCount: r.slides_count || r.deck_json?.slides?.length || 0, savedAt: r.created_at, deck: r.deck_json, currentSlide: r.current_slide || 0, passedCheckpoints: r.passed_checkpoints || [], source: "db" }));
      setSaved([...dbMapped, ...local.filter((x: SavedNote) => !dbMapped.some((d) => d.id === x.id))]);
    } catch { setSaved(local); }
  };

  const persistLocal = (notes: SavedNote[]) => { if (userId) localStorage.setItem(lk(userId), JSON.stringify(notes.filter((n) => n.source === "local"))); };
  const saveResume = () => { if (deck && userId) localStorage.setItem(rk(userId), JSON.stringify({ subjectId, topic, deck, slideIndex, passed })); toast({ title: "Progress saved", description: "Resume later from same module." }); };

  const generate = async () => {
    if (!subject || !topic.trim()) return;
    setLoading(true); setDeck(null); setSlideIndex(0); setPassed([]); setAns(""); setMcq(""); setFeedback(null);
    const prompt = `Create UPSC Smart Notes JSON.\nSubject: ${subject.name}\nTopic: ${topic.trim()}\nSchema: {"topicTitle":"","chapterTitle":"","slides":[{"slideNumber":1,"topicName":"","subtopicTitle":"","structuredExplanation":"","points":[""],"keyTakeaway":""}],"checkpointQuestions":[{"afterSlide":3,"type":"mcq or short","question":"","options":[""],"correctAnswer":"","acceptableAnswers":[""],"explanation":""}],"practiceQuestions":[{"questionText":"","difficulty":"Easy or Medium or Hard","type":"Prelims or Mains or Analytical","answer":"","explanation":"","keyPoints":[""]}],"revisionSummary":[""]}\nRules: 15-20 slides, checkpoint after each 3 slides, exactly 10 practice questions, UPSC prelims+mains quality.`;
    try {
      let txt = "";
      let parsed: any = null;
      let openAiError = "";
      try {
        if (!OPENAI_API_KEY) throw new Error("OpenAI key missing");
        const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.2,
            messages: [
              { role: "system", content: "Return only valid JSON for UPSC smart notes schema." },
              { role: "user", content: prompt },
            ],
          }),
        });
        if (!openaiRes.ok) {
          const errText = await openaiRes.text();
          openAiError = errText || String(openaiRes.status);
          throw new Error(`OpenAI failed: ${errText || openaiRes.status}`);
        }
        const openaiData = await openaiRes.json();
        txt = openaiData?.choices?.[0]?.message?.content || "";
        if (!txt) throw new Error("OpenAI returned empty content");
        parsed = JSON.parse(extractJson(txt));
      } catch {
        // fallback to direct OpenAI streaming
        try {
          txt = await streamOpenAIText({
            messages: [
              { role: "system", content: "Return only valid JSON for UPSC smart notes schema." },
              { role: "user", content: prompt },
            ],
          });

          try {
            parsed = JSON.parse(extractJson(txt));
          } catch {
            parsed = buildDeckFromAiText(subject.name, topic.trim(), txt);
          }
          if (openAiError) {
            toast({
              title: "OpenAI unavailable",
              description: "Using streaming OpenAI fallback for generation.",
            });
          }
        } catch {
          throw new Error("OpenAI generation failed. Please check API key/billing and retry.");
        }
      }
      setDeck(normalizeDeck(parsed, topic.trim(), subject.name));
      setView("study");
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message || "Could not generate.", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const validateCheckpoint = () => {
    if (!cp) return true;
    const answer = cp.type === "mcq" ? mcq : ans;
    const norm = answer.trim().toLowerCase();
    const accepted = [cp.correctAnswer, ...(cp.acceptableAnswers || [])].map((x) => (x || "").toLowerCase()).filter(Boolean);
    const ok = accepted.some((x) => norm.includes(x) || x.includes(norm));
    if (ok) { setPassed((p) => (p.includes(cp.afterSlide) ? p : [...p, cp.afterSlide])); setFeedback({ ok: true, text: "Correct. Next block unlocked." }); return true; }
    setFeedback({ ok: false, text: `Wrong. Correct: ${cp.correctAnswer}. ${cp.explanation}` }); return false;
  };

  const next = () => {
    if (!deck) return;
    if (cp && !cpPassed) return toast({ title: "Checkpoint pending", description: "Answer correctly to continue.", variant: "destructive" });
    if (slideIndex < deck.slides.length - 1) { setSlideIndex((n) => n + 1); setAns(""); setMcq(""); setFeedback(null); } else setView("practice");
  };

  const saveNote = async () => {
    if (!deck || !subject || !userId) return;
    const id = crypto.randomUUID();
    const note: SavedNote = { id, subjectId: subject.id, subjectName: subject.name, topic: deck.topicTitle, slidesCount: deck.slides.length, savedAt: new Date().toISOString(), deck, currentSlide: slideIndex, passedCheckpoints: passed, source: "local" };
    let dbOk = false;
    try {
      const db = supabase as any;
      const { error } = await db.from("upsc_smart_notes").insert({ id, user_id: userId, subject_id: note.subjectId, subject_name: note.subjectName, topic: note.topic, slides_count: note.slidesCount, deck_json: note.deck, current_slide: note.currentSlide, passed_checkpoints: note.passedCheckpoints });
      if (!error) dbOk = true;
    } catch {}
    const merged = [{ ...note, source: dbOk ? "db" : "local" }, ...saved];
    setSaved(merged); persistLocal(merged);
    toast({ title: "Saved", description: dbOk ? "Saved to cloud notes." : "Saved locally." });
  };

  const remove = async (note: SavedNote) => {
    if (note.source === "db") {
      try { const db = supabase as any; await db.from("upsc_smart_notes").delete().eq("id", note.id); } catch {}
    }
    const nextNotes = saved.filter((n) => n.id !== note.id);
    setSaved(nextNotes); persistLocal(nextNotes);
  };

  const open = (n: SavedNote) => { setSubjectId(n.subjectId); setTopic(n.topic); setDeck(n.deck); setSlideIndex(n.currentSlide || 0); setPassed(n.passedCheckpoints || []); setView("study"); };
  const dl = (n: SavedNote) => {
    const out: string[] = [`# ${n.subjectName} - ${n.topic}`, `Saved: ${new Date(n.savedAt).toLocaleString()}`, "", "## Slides"];
    n.deck.slides.forEach((s) => { out.push(`### Slide ${s.slideNumber}: ${s.subtopicTitle}`); out.push(s.structuredExplanation); s.points.forEach((p) => out.push(`- ${p}`)); out.push(`Key Takeaway: ${s.keyTakeaway}`, ""); });
    out.push("## Checkpoints");
    n.deck.checkpointQuestions.forEach((x, i) => { out.push(`${i + 1}. After slide ${x.afterSlide}: ${x.question}`); out.push(`Answer: ${x.correctAnswer}`); out.push(`Explanation: ${x.explanation}`, ""); });
    out.push("## Practice");
    n.deck.practiceQuestions.forEach((x, i) => { out.push(`${i + 1}. [${x.type}] (${x.difficulty}) ${x.questionText}`); out.push(`Answer: ${x.answer}`); out.push(`Explanation: ${x.explanation}`); if (x.keyPoints.length) out.push(`Key Points: ${x.keyPoints.join(", ")}`); out.push(""); });
    const blob = new Blob([out.join("\n")], { type: "text/markdown;charset=utf-8;" }); const url = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = url; a.download = `${n.subjectName}-${n.topic}-upsc-smart-notes.md`.replace(/\s+/g, "-"); a.click(); URL.revokeObjectURL(url);
  };

  const filtered = saved.filter((n) => { const t = q.toLowerCase().trim(); return !t || n.topic.toLowerCase().includes(t) || n.subjectName.toLowerCase().includes(t); });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => (view === "subjects" ? navigate("/dashboard") : setView("subjects"))}><ArrowLeft className="h-5 w-5" /></Button>
            <div><h1 className="text-3xl font-bold text-primary">UPSC Smart Notes Module</h1><p className="text-sm text-muted-foreground">AI slides + checkpoints + practice + My Notes storage</p></div>
          </div>
          <div className="flex gap-2">
            <Button variant={view === "subjects" ? "default" : "outline"} onClick={() => setView("subjects")}>Subjects</Button>
            <Button variant={view === "saved" ? "default" : "outline"} onClick={() => setView("saved")}>My Notes</Button>
          </div>
        </div>

        {view === "subjects" && (
          <Card><CardHeader><CardTitle>Subject Selection</CardTitle><CardDescription>Select a subject and open topic input.</CardDescription></CardHeader><CardContent><div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">{SUBJECTS.map((s) => <Card key={s.id} className="border-primary/20"><CardHeader><CardTitle className="text-lg">{s.name}</CardTitle><CardDescription>{s.examFocus}</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm text-muted-foreground">{s.description}</p><Button className="w-full" onClick={() => { setSubjectId(s.id); setView("topic"); }}>Open Subject</Button></CardContent></Card>)}</div></CardContent></Card>
        )}

        {view === "topic" && subject && (
          <Card><CardHeader><CardTitle>{subject.name} Topic Input</CardTitle><CardDescription>Enter specific topic and generate 15-20 slides.</CardDescription></CardHeader><CardContent className="space-y-4"><Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Example: Fundamental Rights, Governor, Monsoon in India" /><div className="flex gap-2"><Button onClick={generate} disabled={loading || !topic.trim()}>{loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate Smart Slides"}</Button><Button variant="outline" onClick={() => setView("subjects")}>Back</Button></div></CardContent></Card>
        )}

        {view === "study" && deck && slide && (
          <Card className="border-primary/30">
            <CardHeader><div className="flex items-center justify-between"><div><CardTitle>{deck.topicTitle}</CardTitle><CardDescription>{deck.chapterTitle}</CardDescription></div><Badge variant="outline">Slide {slideIndex + 1}/{deck.slides.length}</Badge></div><div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${progress}%` }} /></div><div className="flex justify-between text-xs text-muted-foreground"><span>{progress}% complete</span><span>{passed.length}/{deck.checkpointQuestions.length} checkpoints</span></div></CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-primary/5 p-4"><p className="text-xs font-semibold text-primary">SLIDE {slide.slideNumber}</p><h3 className="text-lg font-bold">{slide.subtopicTitle}</h3><p className="mt-2 text-sm text-muted-foreground">{slide.structuredExplanation}</p></div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2"><Card><CardHeader className="pb-2"><CardTitle className="text-base">Point-wise Notes</CardTitle></CardHeader><CardContent><ul className="space-y-2">{slide.points.map((p, i) => <li key={`${slide.slideNumber}-${i}`} className="text-sm text-muted-foreground">{i + 1}. {p}</li>)}</ul></CardContent></Card><Card><CardHeader className="pb-2"><CardTitle className="text-base">Key Takeaway</CardTitle></CardHeader><CardContent><p className="text-sm text-muted-foreground">{slide.keyTakeaway}</p></CardContent></Card></div>
              {cp && !cpPassed && (
                <Card className="border-warning/30 bg-warning/5"><CardHeader className="pb-2"><CardTitle className="text-base">Checkpoint Question</CardTitle><CardDescription>Must answer correctly to unlock next block.</CardDescription></CardHeader><CardContent className="space-y-3"><p className="text-sm font-medium">{cp.question}</p>{cp.type === "mcq" && cp.options?.length ? <div className="space-y-2">{cp.options.map((o) => <button key={o} onClick={() => setMcq(o)} className={`w-full rounded-md border p-2 text-left text-sm ${mcq === o ? "border-primary bg-primary/10" : "border-border"}`}>{o}</button>)}</div> : <Input value={ans} onChange={(e) => setAns(e.target.value)} placeholder="Type short answer" />}<Button onClick={validateCheckpoint} disabled={cp.type === "mcq" ? !mcq : !ans.trim()}>Submit</Button>{feedback && <p className={`text-sm ${feedback.ok ? "text-green-600" : "text-red-600"}`}>{feedback.text}</p>}</CardContent></Card>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2"><Button variant="outline" onClick={() => setSlideIndex((n) => Math.max(0, n - 1))} disabled={slideIndex === 0}><ChevronLeft className="mr-1 h-4 w-4" />Previous</Button><div className="flex gap-2"><Button variant="outline" onClick={saveResume}>Resume Later</Button><Button variant="outline" onClick={saveNote}>Save to My Notes</Button><Button onClick={next}>{slideIndex === deck.slides.length - 1 ? "Go to Practice" : "Next"}<ChevronRight className="ml-1 h-4 w-4" /></Button></div></div>
            </CardContent>
          </Card>
        )}

        {view === "practice" && deck && (
          <Card><CardHeader><CardTitle>End-of-Topic Practice (10 Questions)</CardTitle><CardDescription>Prelims + Mains + Analytical mix for {deck.topicTitle}</CardDescription></CardHeader><CardContent className="space-y-4">{deck.practiceQuestions.map((x, i) => <Card key={`pq-${i}`} className="border-border/60"><CardHeader className="pb-2"><CardTitle className="text-base">Q{i + 1}. {x.questionText}</CardTitle><CardDescription><Badge variant="secondary" className="mr-2">{x.type}</Badge><Badge variant="outline">{x.difficulty}</Badge></CardDescription></CardHeader><CardContent className="space-y-2"><p className="text-sm"><span className="font-semibold">Answer: </span>{x.answer}</p><p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Explanation: </span>{x.explanation}</p>{x.keyPoints.length > 0 && <ul className="list-disc pl-5 text-sm text-muted-foreground">{x.keyPoints.map((k, ki) => <li key={`k-${i}-${ki}`}>{k}</li>)}</ul>}</CardContent></Card>)}<Card className="border-primary/30"><CardHeader><CardTitle className="text-base">Revision Summary</CardTitle></CardHeader><CardContent><ul className="list-disc pl-5 text-sm text-muted-foreground">{deck.revisionSummary.map((r, i) => <li key={`r-${i}`}>{r}</li>)}</ul></CardContent></Card><div className="flex gap-2"><Button onClick={saveNote}>Save to My Notes</Button><Button variant="outline" onClick={() => setView("saved")}>Open My Notes</Button><Button variant="outline" onClick={() => setView("subjects")}>Start New Topic</Button></div></CardContent></Card>
        )}

        {view === "saved" && (
          <Card><CardHeader><CardTitle>My Notes</CardTitle><CardDescription>Search, open, download, delete saved notes.</CardDescription></CardHeader><CardContent className="space-y-4"><div className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input className="pl-9" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search by subject or topic..." /></div>{filtered.length === 0 ? <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No saved notes found.</CardContent></Card> : <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">{filtered.map((n) => <Card key={n.id}><CardContent className="p-4"><div className="flex items-start justify-between gap-2"><div><p className="font-semibold">{n.topic}</p><p className="text-xs text-muted-foreground">{n.subjectName}</p><p className="text-xs text-muted-foreground">{n.slidesCount} slides | {new Date(n.savedAt).toLocaleString()}</p></div><Badge variant={n.source === "db" ? "secondary" : "outline"}>{n.source === "db" ? "Cloud" : "Local"}</Badge></div><div className="mt-3 flex gap-2"><Button size="sm" onClick={() => open(n)}>Open</Button><Button size="sm" variant="outline" onClick={() => dl(n)}><Download className="mr-1 h-3 w-3" />Download</Button><Button size="sm" variant="destructive" onClick={() => remove(n)}><Trash2 className="mr-1 h-3 w-3" />Delete</Button></div></CardContent></Card>)}</div>}</CardContent></Card>
        )}
      </div>
    </div>
  );
};

export default UPSCNotes;


