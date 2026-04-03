import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2 } from "lucide-react";

type Slide = {
  slideNumber: number;
  topicName: string;
  subtopicTitle: string;
  structuredExplanation: string;
  points: string[];
  keyTakeaway: string;
};

type PracticeQuestion = {
  questionText: string;
  difficulty: "Easy" | "Medium" | "Hard";
  type: "Prelims" | "Mains" | "Analytical";
  answer: string;
  explanation: string;
  keyPoints: string[];
};

type Deck = {
  topicTitle: string;
  chapterTitle: string;
  slides: Slide[];
  practiceQuestions: PracticeQuestion[];
  revisionSummary: string[];
  generatedAt: string;
  citations?: string[];
};

type ViewMode = "subject" | "topic" | "study" | "practice";

const SUBJECT = {
  id: "history",
  name: "History",
  description: "Modern History notes from your stored source book (Spectrum).",
};

const toCleanBullet = (value: string) => value.replace(/\s+/g, " ").trim().replace(/^[\-\d.)\s]+/, "");

const toBulletList = (slide: any): string[] => {
  const fromPoints = Array.isArray(slide?.points)
    ? slide.points.map((p: string) => toCleanBullet(String(p))).filter((p: string) => p.length > 20)
    : [];
  if (fromPoints.length >= 3) return fromPoints.slice(0, 6).map((p) => (p.length > 170 ? `${p.slice(0, 167)}...` : p));

  const fallbackText = String(slide?.structuredExplanation || "");
  const split = fallbackText
    .split(/(?<=[.!?])\s+/)
    .map((s) => toCleanBullet(s))
    .filter((s) => s.length > 20)
    .slice(0, 6);
  return split.map((p) => (p.length > 170 ? `${p.slice(0, 167)}...` : p));
};

const normalizeDeck = (input: any, topic: string): Deck => {
  const slidesRaw = Array.isArray(input?.slides) ? input.slides : [];
  const slides = slidesRaw.map((s: any, i: number) => ({
    slideNumber: i + 1,
    topicName: s?.topicName || topic,
    subtopicTitle: s?.subtopicTitle || `Slide ${i + 1}`,
    structuredExplanation: String(s?.structuredExplanation || "").replace(/\s+/g, " ").trim(),
    points: toBulletList(s),
    keyTakeaway: String(s?.keyTakeaway || "Revise key facts.").replace(/\s+/g, " ").trim(),
  }));

  return {
    topicTitle: input?.topicTitle || topic,
    chapterTitle: input?.chapterTitle || "History",
    slides,
    practiceQuestions: Array.isArray(input?.practiceQuestions) ? input.practiceQuestions : [],
    revisionSummary: Array.isArray(input?.revisionSummary) ? input.revisionSummary : [],
    generatedAt: input?.generatedAt || new Date().toISOString(),
    citations: Array.isArray(input?.citations) ? input.citations : [],
  };
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [view, setView] = useState<ViewMode>("subject");
  const [topic, setTopic] = useState("");
  const [loading, setLoading] = useState(false);
  const [deck, setDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [sourceReady, setSourceReady] = useState(false);
  const [sourceMsg, setSourceMsg] = useState("Checking source status...");

  const currentSlide = deck?.slides[slideIndex] || null;
  const progress = deck ? Math.round(((slideIndex + 1) / Math.max(1, deck.slides.length)) * 100) : 0;

  const citationText = useMemo(() => (deck?.citations?.length ? deck.citations.join(", ") : "History source book"), [deck]);

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }
      try {
        const { data, error } = await (supabase as any).functions.invoke("notes-rag/stats", {
          body: { subjectId: SUBJECT.id },
        });
        if (error) throw error;
        const chunks = Number(data?.chunks || 0);
        if (chunks > 0) {
          setSourceReady(true);
          setSourceMsg(`History source ready (${chunks} chunks in database).`);
        } else {
          setSourceReady(false);
          setSourceMsg("History source missing in database. Contact admin to seed the book.");
        }
      } catch {
        setSourceReady(false);
        setSourceMsg("Could not verify history source in database.");
      }
    };
    init();
  }, [navigate]);

  const generateHistorySlides = async () => {
    if (!topic.trim()) return;
    if (!sourceReady) {
      toast({
        title: "History source not ready",
        description: "Book data is not available in DB yet.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    setDeck(null);
    setSlideIndex(0);

    try {
      const { data, error } = await (supabase as any).functions.invoke("notes-rag/generate", {
        body: {
          subjectId: SUBJECT.id,
          subjectName: SUBJECT.name,
          topic: topic.trim(),
          slides: 18,
        },
      });
      if (error || !data?.ok || !data?.deck) {
        throw new Error(data?.reason || error?.message || "Failed to generate history notes.");
      }
      const normalized = normalizeDeck(data.deck, topic.trim());
      if (!normalized.slides.length) {
        throw new Error("No source-backed slides generated for this topic.");
      }
      setDeck(normalized);
      setView("study");
    } catch (e: any) {
      toast({
        title: "Generation failed",
        description: e?.message || "Could not generate history notes.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const goNext = () => {
    if (!deck) return;
    if (slideIndex < deck.slides.length - 1) {
      setSlideIndex((prev) => prev + 1);
      return;
    }
    setView("practice");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-6xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => (view === "subject" ? navigate("/dashboard") : setView("subject"))}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold text-primary">UPSC Notes - History</h1>
              <p className="text-sm text-muted-foreground">Topic-wise slides generated only from stored history book data.</p>
            </div>
          </div>
        </div>

        {view === "subject" && (
          <Card>
            <CardHeader>
              <CardTitle>{SUBJECT.name}</CardTitle>
              <CardDescription>{SUBJECT.description}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-muted/20 p-3 text-sm">{sourceMsg}</div>
              <Button onClick={() => setView("topic")} disabled={!sourceReady}>Open History Notes</Button>
            </CardContent>
          </Card>
        )}

        {view === "topic" && (
          <Card>
            <CardHeader>
              <CardTitle>Enter History Topic</CardTitle>
              <CardDescription>Example: Revolt of 1857, Moderates vs Extremists, Government of India Act 1935</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Enter specific history topic" />
              <div className="flex gap-2">
                <Button onClick={generateHistorySlides} disabled={loading || !topic.trim() || !sourceReady}>
                  {loading ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Generating...</> : "Generate History Slides"}
                </Button>
                <Button variant="outline" onClick={() => setView("subject")}>Back</Button>
              </div>
            </CardContent>
          </Card>
        )}

        {view === "study" && deck && currentSlide && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{deck.topicTitle}</CardTitle>
                  <CardDescription>{deck.chapterTitle}</CardDescription>
                </div>
                <Badge variant="outline">Slide {slideIndex + 1}/{deck.slides.length}</Badge>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Source: {citationText}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-lg border bg-primary/5 p-4">
                <p className="text-xs font-semibold text-primary">SLIDE {currentSlide.slideNumber}</p>
                <h3 className="text-lg font-bold">{currentSlide.subtopicTitle}</h3>
                <p className="mt-2 text-sm text-foreground leading-relaxed">{currentSlide.structuredExplanation}</p>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Structured Notes</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {currentSlide.points.map((point, idx) => <li key={`${currentSlide.slideNumber}-${idx}`} className="leading-relaxed">{idx + 1}. {point}</li>)}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Quick Revision</CardTitle></CardHeader>
                  <CardContent><p className="text-sm text-muted-foreground leading-relaxed">{currentSlide.keyTakeaway}</p></CardContent>
                </Card>
              </div>

              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))} disabled={slideIndex === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous
                </Button>
                <Button onClick={goNext}>
                  {slideIndex === deck.slides.length - 1 ? "Go To Practice" : "Next"}<ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {view === "practice" && deck && (
          <Card>
            <CardHeader>
              <CardTitle>History Practice Questions</CardTitle>
              <CardDescription>Generated from source-backed history notes.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {deck.practiceQuestions.map((item, idx) => (
                <Card key={`pq-${idx}`}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Q{idx + 1}. {item.questionText}</CardTitle>
                    <CardDescription>
                      <Badge variant="secondary" className="mr-2">{item.type}</Badge>
                      <Badge variant="outline">{item.difficulty}</Badge>
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <p className="text-sm"><span className="font-semibold">Answer: </span>{item.answer}</p>
                    <p className="text-sm text-muted-foreground"><span className="font-semibold text-foreground">Explanation: </span>{item.explanation}</p>
                  </CardContent>
                </Card>
              ))}
              <div className="flex gap-2">
                <Button onClick={() => setView("topic")}>Generate Another Topic</Button>
                <Button variant="outline" onClick={() => setView("subject")}>Back To Subject</Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UPSCNotes;
