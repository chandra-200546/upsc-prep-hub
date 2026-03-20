import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { ArrowLeft, ChevronLeft, ChevronRight, Loader2, Presentation } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Slide = {
  heading: string;
  bullets: string[];
  detailedExplanation: string;
  example: string;
  visualTitle: string;
  visualLines: string[];
};

type QuizCheckpoint = {
  afterSlide: number;
  question: string;
  acceptableAnswers: string[];
};

type Deck = {
  topicTitle: string;
  chapterTitle: string;
  slides: Slide[];
  quizzes?: QuizCheckpoint[];
  sources?: string[];
};

type Subject = {
  id: string;
  name: string;
  examFocus: string;
  description: string;
};

const SUBJECTS: Subject[] = [
  { id: "polity", name: "Polity", examFocus: "GS Paper II + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "history", name: "History", examFocus: "GS Paper I + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "geography", name: "Geography", examFocus: "GS Paper I + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "economy", name: "Economy", examFocus: "GS Paper III + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "environment", name: "Environment & Ecology", examFocus: "GS Paper III + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "science-tech", name: "Science & Tech", examFocus: "GS Paper III + Prelims", description: "AI generated PPT-style notes + checkpoints" },
  { id: "ethics", name: "Ethics", examFocus: "GS Paper IV", description: "AI generated PPT-style notes + checkpoints" },
  { id: "current-affairs", name: "Current Affairs", examFocus: "GS I/II/III + Essay + Interview", description: "AI generated PPT-style notes + checkpoints" }
];

const REFERENCE_SOURCE = "AI deck generation with in-between revision checkpoints";

const extractJson = (raw: string) => {
  const trimmed = raw.trim();
  if (trimmed.startsWith("{")) return trimmed;
  const fenced = trimmed.match(/```json\s*([\s\S]*?)```/i);
  if (fenced?.[1]) return fenced[1].trim();
  const first = trimmed.indexOf("{");
  const last = trimmed.lastIndexOf("}");
  if (first >= 0 && last > first) return trimmed.slice(first, last + 1);
  return trimmed;
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [topicInput, setTopicInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);
  const [checkpointAnswer, setCheckpointAnswer] = useState("");
  const [checkpointPassed, setCheckpointPassed] = useState<number[]>([]);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  const selectedSubject = useMemo(
    () => SUBJECTS.find((s) => s.id === selectedSubjectId) || null,
    [selectedSubjectId]
  );

  const goBack = () => {
    if (activeDeck) {
      setActiveDeck(null);
      setSlideIndex(0);
      setCheckpointAnswer("");
      return;
    }
    if (selectedSubjectId) {
      setSelectedSubjectId(null);
      return;
    }
    navigate("/dashboard");
  };

  const generateTopicSlides = async () => {
    if (!topicInput.trim()) return;
    if (!selectedSubjectId) return;
    setLoading(true);
    setActiveDeck(null);
    setSlideIndex(0);
    setCheckpointPassed([]);
    setCheckpointAnswer("");

    try {
      const { data, error } = await supabase.functions.invoke("upsc-notes-slides", {
        body: { subject: selectedSubjectId, topic: topicInput.trim() }
      });

      if (error) throw error;

      const parsed = typeof data === "string" ? JSON.parse(extractJson(data)) : data;
      if (!parsed?.slides || !Array.isArray(parsed.slides) || parsed.slides.length === 0) {
        throw new Error("No slides generated");
      }

      setActiveDeck({
        topicTitle: parsed.topicTitle || topicInput.trim(),
        chapterTitle: parsed.chapterTitle || selectedSubject?.name || "UPSC",
        slides: parsed.slides,
        quizzes: Array.isArray(parsed.quizzes) ? parsed.quizzes : [],
        sources: Array.isArray(parsed.sources) ? parsed.sources : []
      });
    } catch (err: any) {
      toast({
        title: "Generation failed",
        description: err?.message || "Could not generate slides",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const activeSlide = activeDeck ? activeDeck.slides[slideIndex] : null;
  const progress = activeDeck ? ((slideIndex + 1) / activeDeck.slides.length) * 100 : 0;
  const currentCheckpoint = activeDeck?.quizzes?.find((quiz) => quiz.afterSlide === slideIndex + 1) || null;
  const isCheckpointPassed = currentCheckpoint ? checkpointPassed.includes(currentCheckpoint.afterSlide) : true;

  const checkCheckpointAnswer = () => {
    if (!currentCheckpoint) return true;
    const answer = checkpointAnswer.trim().toLowerCase();
    const ok = currentCheckpoint.acceptableAnswers.some((a) => answer.includes(a.toLowerCase()));
    if (!ok) {
      toast({
        title: "Try again",
        description: "Revise the previous slides and answer the checkpoint correctly to continue.",
        variant: "destructive"
      });
      return false;
    }
    setCheckpointPassed((prev) => (prev.includes(currentCheckpoint.afterSlide) ? prev : [...prev, currentCheckpoint.afterSlide]));
    toast({
      title: "Correct",
      description: "Great. Moving to next slide block."
    });
    return true;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">UPSC Notes</h1>
            <p className="text-muted-foreground">Topic input -> instant PPT style slide generation</p>
          </div>
        </div>

        <Card className="mb-6 border-primary/20 bg-gradient-to-r from-primary/10 to-accent/10">
          <CardContent className="flex items-center justify-between gap-3 p-4">
            <div>
              <p className="text-sm font-semibold">Reference Source</p>
              <p className="text-xs text-muted-foreground">{REFERENCE_SOURCE}</p>
            </div>
            <Badge variant="secondary">Stored in /references</Badge>
          </CardContent>
        </Card>

        {!selectedSubject && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Subject</CardTitle>
              <CardDescription>First choose subject, then generate topic slides</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {SUBJECTS.map((s) => (
                  <button
                    key={s.id}
                    onClick={() => setSelectedSubjectId(s.id)}
                    className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/20"
                  >
                    <p className="font-semibold">{s.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{s.examFocus}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{s.description}</p>
                  </button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {selectedSubject && !activeDeck && (
          <Card>
            <CardHeader>
              <CardTitle>{selectedSubject.name} Topic Generator</CardTitle>
              <CardDescription>
                Enter any specific topic. AI will generate 10-15 PPT-style slides and ask checkpoint questions after every 3 slides.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Input
                value={topicInput}
                onChange={(e) => setTopicInput(e.target.value)}
                placeholder={`Enter topic in ${selectedSubject.name} (example: Fundamental Rights, Monsoon, Inflation, Biodiversity)`}
              />
              <div className="flex items-center gap-2">
                <Button onClick={generateTopicSlides} disabled={loading || !topicInput.trim()}>
                  {loading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Generating Slides...
                    </>
                  ) : (
                    "Generate PPT Style Notes"
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setTopicInput("");
                    setSelectedSubjectId(null);
                  }}
                >
                  Back to Subjects
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {activeDeck && activeSlide && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">{activeDeck.topicTitle}</CardTitle>
                  <CardDescription>{activeDeck.chapterTitle}</CardDescription>
                </div>
                <Badge variant="outline">Slide {slideIndex + 1} / {activeDeck.slides.length}</Badge>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeDeck.sources && activeDeck.sources.length > 0 && (
                <Card className="border-border/60">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">RAG Sources Used</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex flex-wrap gap-2">
                      {activeDeck.sources.map((source, idx) => (
                        <Badge key={`${source}-${idx}`} variant="secondary">
                          {source}
                        </Badge>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/10 to-background p-4">
                <p className="text-xs font-semibold tracking-wide text-primary">SLIDE TITLE</p>
                <h3 className="mt-1 text-lg font-bold">{activeSlide.heading}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Bullet Points</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2">
                      {activeSlide.bullets.map((b, i) => <li key={i} className="text-sm leading-relaxed text-muted-foreground">{b}</li>)}
                    </ul>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Detailed Explanation</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{activeSlide.detailedExplanation}</p></CardContent>
                </Card>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Example</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{activeSlide.example}</p></CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">{activeSlide.visualTitle}</CardTitle></CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-muted/20 p-3">
                      {activeSlide.visualLines.map((v, i) => <p key={i} className="text-sm leading-relaxed text-muted-foreground">{v}</p>)}
                    </div>
                  </CardContent>
                </Card>
              </div>
              {currentCheckpoint && !isCheckpointPassed && (
                <Card className="border-primary/30 bg-primary/5">
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Checkpoint Quiz</CardTitle>
                    <CardDescription>Answer this to continue after slide {currentCheckpoint.afterSlide}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <p className="text-sm font-medium">{currentCheckpoint.question}</p>
                    <Input
                      value={checkpointAnswer}
                      onChange={(e) => setCheckpointAnswer(e.target.value)}
                      placeholder="Type your answer"
                    />
                    <Button onClick={checkCheckpointAnswer} disabled={!checkpointAnswer.trim()}>
                      Submit Answer
                    </Button>
                  </CardContent>
                </Card>
              )}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setSlideIndex((p) => Math.max(0, p - 1))} disabled={slideIndex === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Previous Slide
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setActiveDeck(null); setSlideIndex(0); }}>
                    New Topic
                  </Button>
                  {slideIndex < activeDeck.slides.length - 1 ? (
                    <Button
                      onClick={() => {
                        if (currentCheckpoint && !isCheckpointPassed) {
                          toast({
                            title: "Checkpoint pending",
                            description: "Answer the checkpoint question first.",
                            variant: "destructive"
                          });
                          return;
                        }
                        setCheckpointAnswer("");
                        setSlideIndex((p) => Math.min(activeDeck.slides.length - 1, p + 1));
                      }}
                    >
                      Next Slide
                      <ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button onClick={() => { setActiveDeck(null); setSlideIndex(0); }}>
                      Finish
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};

export default UPSCNotes;
