import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, ChevronLeft, ChevronRight, Layers3, Presentation } from "lucide-react";

type Topic = { title: string };
type Chapter = { id: string; title: string; focus: string; topics: Topic[] };
type Subject = { id: string; name: string; examFocus: string; description: string; chapters: Chapter[] };
type Slide = {
  heading: string;
  bullets: string[];
  detailedExplanation: string;
  example: string;
  visualTitle: string;
  visualLines: string[];
};
type Deck = { topicTitle: string; chapterTitle: string; slides: Slide[] };

const makeTopics = (items: string[]): Topic[] => items.map((title) => ({ title }));

const POLITY_CHAPTERS: Chapter[] = [
  { id: "1", title: "1. Constitutional Framework", focus: "Foundations", topics: makeTopics(["Historical Background", "Making of the Constitution", "Salient Features of the Constitution", "Preamble of the Constitution", "Union and its Territory", "Citizenship", "Fundamental Rights", "Directive Principles of State Policy", "Fundamental Duties", "Amendment of the Constitution", "Basic Structure of the Constitution"]) },
  { id: "2", title: "2. System of Government", focus: "Constitution in operation", topics: makeTopics(["Parliamentary System", "Federal System", "Centre-State Relations", "Inter-State Relations", "Emergency Provisions", "President's Rule", "Financial Emergency"]) },
  { id: "3", title: "3. Central Government", focus: "Union institutions", topics: makeTopics(["President", "Vice-President", "Prime Minister", "Central Council of Ministers", "Cabinet Committees", "Parliament", "Parliamentary Committees", "Parliamentary Forums", "Attorney General of India"]) },
  { id: "4", title: "4. State Government", focus: "State institutions", topics: makeTopics(["Governor", "Chief Minister", "State Council of Ministers", "State Legislature", "High Court", "Subordinate Courts", "Advocate General of State"]) },
  { id: "5", title: "5. Local Government", focus: "Decentralization", topics: makeTopics(["Panchayati Raj", "Municipalities", "Scheduled and Tribal Areas"]) },
  { id: "6", title: "6. Union Territories and Special Areas", focus: "Asymmetrical design", topics: makeTopics(["Union Territories", "Special Status / Special Provisions for States", "Scheduled Areas", "Tribal Areas"]) },
  { id: "7", title: "7. Constitutional Bodies", focus: "Constitution-created institutions", topics: makeTopics(["Election Commission", "Union Public Service Commission", "State Public Service Commission", "Finance Commission", "CAG", "Attorney General", "Advocate General", "National Commissions for SCs, STs, BCs"]) },
  { id: "8", title: "8. Non-Constitutional Bodies", focus: "Statutory/executive institutions", topics: makeTopics(["NITI Aayog", "NHRC", "SHRC", "CIC", "CVC", "CBI", "Lokpal and Lokayuktas", "National Development Council (legacy context)"]) },
  { id: "9", title: "9. Other Constitutional Dimensions", focus: "Additional dimensions", topics: makeTopics(["Co-operative Societies", "Official Language", "Public Services", "Tribunals", "Rights and Liabilities of Government", "Special Officer for Linguistic Minorities"]) },
  { id: "10", title: "10. Political Dynamics", focus: "Constitution in politics", topics: makeTopics(["Anti-Defection Law", "Pressure Groups", "National Integration", "Foreign Policy", "Election Laws", "Representation of People Acts"]) },
  { id: "11", title: "11. New / Extra Chapters in Latest Edition", focus: "Advanced enrichment", topics: makeTopics(["Concept of the Constitution", "Constitutional Prescription", "World Constitutions", "Landmark Judgments and their Impact", "Important Doctrines of Constitutional Interpretation", "Law Commission of India", "Bar Council of India", "Delimitation Commission of India", "National Commission for Women", "National Commission for Protection of Child Rights", "National Commission for Minorities", "Consumer Commissions"]) }
];

const SUBJECTS: Subject[] = [
  { id: "polity", name: "Polity", examFocus: "GS Paper II + Prelims", description: "Complete slide module", chapters: POLITY_CHAPTERS },
  { id: "history", name: "History", examFocus: "GS Paper I + Prelims", description: "Will be added in same style", chapters: [] },
  { id: "geography", name: "Geography", examFocus: "GS Paper I + Prelims", description: "Will be added in same style", chapters: [] },
  { id: "economy", name: "Economy", examFocus: "GS Paper III + Prelims", description: "Will be added in same style", chapters: [] },
  { id: "environment", name: "Environment & Ecology", examFocus: "GS Paper III + Prelims", description: "Will be added in same style", chapters: [] },
  { id: "science-tech", name: "Science & Tech", examFocus: "GS Paper III + Prelims", description: "Will be added in same style", chapters: [] },
  { id: "ethics", name: "Ethics", examFocus: "GS Paper IV", description: "Will be added in same style", chapters: [] },
  { id: "current-affairs", name: "Current Affairs", examFocus: "GS I/II/III + Essay + Interview", description: "Will be added in same style", chapters: [] }
];

const buildDeck = (chapterTitle: string, topicTitle: string): Slide[] => {
  const memo = topicTitle.split(" ").map((w) => w[0]).join("");
  return [
    {
      heading: "Slide 1 - Introduction",
      bullets: [`Topic: ${topicTitle}`, `Chapter: ${chapterTitle}`, "Foundation to advanced flow"],
      detailedExplanation: `${topicTitle} ni beginner nundi advanced varaku complete ga cover cheyyadaniki structured sequence use chestham. This gives full conceptual clarity for UPSC.`,
      example: `${topicTitle} is repeatedly used in constitutional and governance analysis questions.`,
      visualTitle: "Entry Flowchart",
      visualLines: ["Topic", "-> Definition", "-> Constitutional Anchor", "-> Relevance"]
    },
    {
      heading: "Slide 2 - Importance",
      bullets: ["Prelims relevance", "Mains analytical relevance", "Interview relevance"],
      detailedExplanation: `${topicTitle} prelims lo factual ga, mains lo evaluative ga, interview lo practical application ga test avvachu.`,
      example: `Direct or indirect framing in GS answers frequently includes ${topicTitle}.`,
      visualTitle: "Importance Pyramid",
      visualLines: ["Exam relevance", "Governance relevance", "Citizen impact"]
    },
    {
      heading: "Slide 3 - Core Concepts",
      bullets: ["Definition", "Components", "Operational logic"],
      detailedExplanation: `${topicTitle} concept ni 3 parts lo clear ga break chestham: meaning, structure, process.`,
      example: `Answer skeleton: define -> explain structure -> show governance output.`,
      visualTitle: "Concept Map",
      visualLines: ["Definition", "Structure", "Process", "Outcome"]
    },
    {
      heading: "Slide 4 - Intermediate to Advanced",
      bullets: ["Institutional mechanics", "Constitutional checks", "Reform dimensions"],
      detailedExplanation: `${topicTitle} advanced understanding means strengths, limitations, and reform pathways ni constitutional lens lo evaluate cheyyadam.`,
      example: `Balanced mains line: constitutional intent vs implementation gap.`,
      visualTitle: "Issue-Reform Matrix",
      visualLines: ["Strength", "Limitation", "Impact", "Reform"]
    },
    {
      heading: "Slide 5 - Visual Comparison",
      bullets: ["Compare related concepts", "Table-based revision", "High-retention differentiation"],
      detailedExplanation: `Similar concepts ni table format lo pettadam valla confusion thaggutundi and answer clarity perugutundi.`,
      example: `Table format: Feature | Concept A | Concept B`,
      visualTitle: "Comparison Table",
      visualLines: ["Feature | Side A | Side B", "Basis | ... | ...", "Scope | ... | ...", "Limit | ... | ..."]
    },
    {
      heading: "Slide 6 - Memory Tricks and Mistakes",
      bullets: [`Mnemonic: ${memo} Framework`, "Common mistakes", "Correct handling"],
      detailedExplanation: `Fast revision kosam mnemonic use cheyyandi. Common mistakes lo article confusion and one-sided conclusions untayi.`,
      example: `Correction model: exact constitutional anchor + balanced evaluation.`,
      visualTitle: "Retention Block",
      visualLines: ["Mnemonic", "Mistake Alert", "Correct Pattern"]
    },
    {
      heading: "Slide 7 - Exam-Oriented Questions",
      bullets: ["Prelims style check", "Mains 10/15 marker", "Interview prompt"],
      detailedExplanation: `${topicTitle} ni exam framing lo practice chesthe response quality and speed rendu improve avutayi.`,
      example: `Mains sample: Critically examine ${topicTitle} in constitutional governance.`,
      visualTitle: "Question Ladder",
      visualLines: ["Prelims fact", "Mains analysis", "Interview application"]
    },
    {
      heading: "Slide 8 - Summary and Quick Revision",
      bullets: ["Key points", "One-page recall", "Answer writing formula"],
      detailedExplanation: `Final recall format: Intro (2 lines) -> Body (3 subheadings) -> Balanced conclusion (1 line).`,
      example: `Final formula: Define -> Explain -> Analyze -> Reform -> Conclude.`,
      visualTitle: "Revision Flow",
      visualLines: ["30s recall", "2 min structure", "5 min writing"]
    }
  ];
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<Deck | null>(null);
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  const selectedSubject = useMemo(() => SUBJECTS.find((s) => s.id === selectedSubjectId) || null, [selectedSubjectId]);
  const chapters = selectedSubject?.chapters || [];
  const totalTopics = chapters.reduce((acc, chapter) => acc + chapter.topics.length, 0);

  const goBack = () => {
    if (activeDeck) {
      setActiveDeck(null);
      setSlideIndex(0);
      return;
    }
    if (selectedSubjectId) {
      setSelectedSubjectId(null);
      return;
    }
    navigate("/dashboard");
  };

  const openDeck = (chapterTitle: string, topicTitle: string) => {
    setActiveDeck({ topicTitle, chapterTitle, slides: buildDeck(chapterTitle, topicTitle) });
    setSlideIndex(0);
  };

  const activeSlide = activeDeck ? activeDeck.slides[slideIndex] : null;
  const progress = activeDeck ? ((slideIndex + 1) / activeDeck.slides.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={goBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">UPSC Notes</h1>
            <p className="text-muted-foreground">Hardcoded visual slides for instant learning</p>
          </div>
        </div>

        {!selectedSubject && (
          <Card className="mb-6">
            <CardHeader><CardTitle>Select Subject</CardTitle><CardDescription>First choose subject, then chapter and subtopic</CardDescription></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {SUBJECTS.map((s) => (
                  <button key={s.id} onClick={() => setSelectedSubjectId(s.id)} className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/20">
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
          <>
            <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
              <Card><CardContent className="flex items-center gap-3 p-4"><Layers3 className="h-8 w-8 text-primary" /><div><p className="text-2xl font-bold">{chapters.length}</p><p className="text-xs text-muted-foreground">Chapters</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-3 p-4"><Presentation className="h-8 w-8 text-accent" /><div><p className="text-2xl font-bold">{totalTopics}</p><p className="text-xs text-muted-foreground">Subtopics</p></div></CardContent></Card>
              <Card><CardContent className="p-4"><p className="text-sm font-semibold">Slide Deck Mode</p><p className="text-xs text-muted-foreground">Every subtopic opens as complete slide notes</p></CardContent></Card>
            </div>
            {chapters.length === 0 ? (
              <Card><CardContent className="py-10 text-center"><p className="text-lg font-semibold">This subject will be added in the same complete slide format.</p></CardContent></Card>
            ) : (
              <Card>
                <CardHeader><CardTitle>{selectedSubject.name} Chapters</CardTitle><CardDescription>Click subtopic to open visual slides</CardDescription></CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-3">
                    {chapters.map((chapter) => (
                      <AccordionItem key={chapter.id} value={`chapter-${chapter.id}`} className="rounded-lg border px-4">
                        <AccordionTrigger className="text-left">
                          <div className="flex flex-wrap items-center gap-2"><span className="font-semibold">{chapter.title}</span><Badge variant="secondary">{chapter.topics.length} topics</Badge></div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="mb-3 text-sm text-muted-foreground">{chapter.focus}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {chapter.topics.map((topic) => (
                              <button key={`${chapter.id}-${topic.title}`} onClick={() => openDeck(chapter.title, topic.title)} className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/20">
                                <p className="font-medium">{topic.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Open complete slides</p>
                              </button>
                            ))}
                          </div>
                        </AccordionContent>
                      </AccordionItem>
                    ))}
                  </Accordion>
                </CardContent>
              </Card>
            )}
          </>
        )}

        {activeDeck && activeSlide && (
          <Card className="border-primary/20">
            <CardHeader>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div><CardTitle className="text-xl">{activeDeck.topicTitle}</CardTitle><CardDescription>{activeDeck.chapterTitle}</CardDescription></div>
                <Badge variant="outline">Slide {slideIndex + 1} / {activeDeck.slides.length}</Badge>
              </div>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary transition-all duration-300" style={{ width: `${progress}%` }} /></div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/10 to-background p-4">
                <p className="text-xs font-semibold tracking-wide text-primary">SLIDE TITLE</p>
                <h3 className="mt-1 text-lg font-bold">{activeSlide.heading}</h3>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">Bullet Points</CardTitle></CardHeader><CardContent><ul className="space-y-2">{activeSlide.bullets.map((b, i) => <li key={i} className="text-sm leading-relaxed text-muted-foreground">{b}</li>)}</ul></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">Detailed Explanation</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{activeSlide.detailedExplanation}</p></CardContent></Card>
              </div>
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">Example</CardTitle></CardHeader><CardContent><p className="text-sm leading-relaxed text-muted-foreground">{activeSlide.example}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-base">{activeSlide.visualTitle}</CardTitle></CardHeader><CardContent><div className="rounded-md border bg-muted/20 p-3">{activeSlide.visualLines.map((v, i) => <p key={i} className="text-sm leading-relaxed text-muted-foreground">{v}</p>)}</div></CardContent></Card>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setSlideIndex((p) => Math.max(0, p - 1))} disabled={slideIndex === 0}><ChevronLeft className="mr-1 h-4 w-4" />Previous Slide</Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setActiveDeck(null); setSlideIndex(0); }}>Back to Topics</Button>
                  {slideIndex < activeDeck.slides.length - 1 ? (
                    <Button onClick={() => setSlideIndex((p) => Math.min(activeDeck.slides.length - 1, p + 1))}>Next Slide<ChevronRight className="ml-1 h-4 w-4" /></Button>
                  ) : (
                    <Button onClick={() => { setActiveDeck(null); setSlideIndex(0); }}>Finish Topic</Button>
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
