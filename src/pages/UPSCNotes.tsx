import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Layers3, Presentation, Sparkles } from "lucide-react";

type Topic = { title: string };
type Chapter = { id: string; title: string; focus: string; topics: Topic[] };
type SubjectNotes = { id: string; name: string; examFocus: string; description: string; chapters: Chapter[] };
type Slide = { heading: string; visualTitle: string; visualLines: string[]; explanation: string; keyPoints: string[] };
type TopicDeck = { chapterTitle: string; topicTitle: string; slides: Slide[] };

const makeTopics = (items: string[]): Topic[] => items.map((title) => ({ title }));

const POLITY_CHAPTERS: Chapter[] = [
  {
    id: "1",
    title: "1. Constitutional Framework",
    focus: "Constitutional foundations and philosophy",
    topics: makeTopics([
      "Historical Background", "Making of the Constitution", "Salient Features of the Constitution",
      "Preamble of the Constitution", "Union and its Territory", "Citizenship", "Fundamental Rights",
      "Directive Principles of State Policy", "Fundamental Duties", "Amendment of the Constitution",
      "Basic Structure of the Constitution"
    ])
  },
  {
    id: "2",
    title: "2. System of Government",
    focus: "Operational model of the Indian state",
    topics: makeTopics([
      "Parliamentary System", "Federal System", "Centre-State Relations", "Inter-State Relations",
      "Emergency Provisions", "President's Rule", "Financial Emergency"
    ])
  },
  {
    id: "3",
    title: "3. Central Government",
    focus: "Union executive and legislative institutions",
    topics: makeTopics([
      "President", "Vice-President", "Prime Minister", "Central Council of Ministers", "Cabinet Committees",
      "Parliament", "Parliamentary Committees", "Parliamentary Forums", "Attorney General of India"
    ])
  },
  {
    id: "4",
    title: "4. State Government",
    focus: "State-level constitutional institutions",
    topics: makeTopics([
      "Governor", "Chief Minister", "State Council of Ministers", "State Legislature", "High Court",
      "Subordinate Courts", "Advocate General of State"
    ])
  },
  {
    id: "5",
    title: "5. Local Government",
    focus: "Decentralized democratic institutions",
    topics: makeTopics(["Panchayati Raj", "Municipalities", "Scheduled and Tribal Areas"])
  },
  {
    id: "6",
    title: "6. Union Territories and Special Areas",
    focus: "Asymmetrical constitutional arrangements",
    topics: makeTopics(["Union Territories", "Special Status / Special Provisions for States", "Scheduled Areas", "Tribal Areas"])
  },
  {
    id: "7",
    title: "7. Constitutional Bodies",
    focus: "Institutions established by Constitution",
    topics: makeTopics([
      "Election Commission", "Union Public Service Commission", "State Public Service Commission", "Finance Commission",
      "CAG", "Attorney General", "Advocate General", "National Commissions for SCs, STs, BCs"
    ])
  },
  {
    id: "8",
    title: "8. Non-Constitutional Bodies",
    focus: "Statutory and executive governance institutions",
    topics: makeTopics([
      "NITI Aayog", "NHRC", "SHRC", "CIC", "CVC", "CBI", "Lokpal and Lokayuktas",
      "National Development Council (legacy context)"
    ])
  },
  {
    id: "9",
    title: "9. Other Constitutional Dimensions",
    focus: "Additional constitutional governance domains",
    topics: makeTopics([
      "Co-operative Societies", "Official Language", "Public Services", "Tribunals",
      "Rights and Liabilities of Government", "Special Officer for Linguistic Minorities"
    ])
  },
  {
    id: "10",
    title: "10. Political Dynamics",
    focus: "Constitution in practice",
    topics: makeTopics([
      "Anti-Defection Law", "Pressure Groups", "National Integration", "Foreign Policy",
      "Election Laws", "Representation of People Acts"
    ])
  },
  {
    id: "11",
    title: "11. New / Extra Chapters in Latest Edition",
    focus: "Advanced constitutional understanding",
    topics: makeTopics([
      "Concept of the Constitution", "Constitutional Prescription", "World Constitutions", "Landmark Judgments and their Impact",
      "Important Doctrines of Constitutional Interpretation", "Law Commission of India", "Bar Council of India",
      "Delimitation Commission of India", "National Commission for Women", "National Commission for Protection of Child Rights",
      "National Commission for Minorities", "Consumer Commissions"
    ])
  }
];

const SUBJECTS: SubjectNotes[] = [
  { id: "polity", name: "Polity", examFocus: "GS Paper II + Prelims", description: "Complete slide-based mastery module", chapters: POLITY_CHAPTERS },
  { id: "history", name: "History", examFocus: "GS Paper I + Prelims", description: "Ancient, Medieval, Modern", chapters: [] },
  { id: "geography", name: "Geography", examFocus: "GS Paper I + Prelims", description: "Physical + Indian Geography", chapters: [] },
  { id: "economy", name: "Economy", examFocus: "GS Paper III + Prelims", description: "Macro + Development", chapters: [] },
  { id: "environment", name: "Environment & Ecology", examFocus: "GS Paper III + Prelims", description: "Ecology + Climate", chapters: [] },
  { id: "science-tech", name: "Science & Tech", examFocus: "GS Paper III + Prelims", description: "Emerging Tech + Applications", chapters: [] },
  { id: "ethics", name: "Ethics", examFocus: "GS Paper IV", description: "Ethics + Case Studies", chapters: [] },
  { id: "current-affairs", name: "Current Affairs", examFocus: "GS I/II/III + Essay + Interview", description: "UPSC-linked dynamic topics", chapters: [] }
];

const buildTopicDeck = (chapterTitle: string, topicTitle: string): Slide[] => {
  const acronym = topicTitle.split(" ").map((w) => w[0]).join("");
  return [
    {
      heading: "Slide 1 - Core Concept",
      visualTitle: "Visual Snapshot",
      visualLines: [topicTitle, "-> Constitutional Anchor", "-> Institutional Role", "-> Public Impact"],
      explanation: `${topicTitle} under ${chapterTitle} includes constitutional basis, institutional structure, governance relevance, and exam utility.`,
      keyPoints: [
        "Core definition and constitutional location.",
        "Evolution and contemporary relevance in governance.",
        "Direct linkage with prelims facts and mains analysis."
      ]
    },
    {
      heading: "Slide 2 - Structural Blueprint",
      visualTitle: "How It Works",
      visualLines: ["Source of power", "-> Institutional mechanism", "-> Process flow", "-> Constitutional checks"],
      explanation: `${topicTitle} works through defined constitutional mechanisms with accountability safeguards and procedural limits.`,
      keyPoints: [
        "Institutional architecture and role clarity.",
        "Functional process from decision to implementation.",
        "Checks, balances, and federal-democratic implications."
      ]
    },
    {
      heading: "Slide 3 - Analytical Depth",
      visualTitle: "Issue-Reform Matrix",
      visualLines: ["Strengths", "Limitations", "Constitutional concerns", "Reform pathway"],
      explanation: `${topicTitle} has recurring debates around design quality, implementation gaps, and constitutional balance.`,
      keyPoints: [
        "Mains framing includes strengths vs structural constraints.",
        "Judicial, legislative, and executive dimensions can be interlinked.",
        "Reforms are assessed by legality, feasibility, and citizen outcomes."
      ]
    },
    {
      heading: "Slide 4 - UPSC Exam Lens",
      visualTitle: "Prelims + Mains + Interview",
      visualLines: ["Prelims: Facts", "Mains: Reasoning", "Interview: Application"],
      explanation: `${topicTitle} can be tested as factual, conceptual, and applied governance content across UPSC stages.`,
      keyPoints: [
        "Prelims: article/body/year-feature mapping.",
        "Mains: intro-body-conclusion with constitutional anchors.",
        "Interview: practical implications and reform orientation."
      ]
    },
    {
      heading: "Slide 5 - Master Revision Card",
      visualTitle: "One-Page Recall",
      visualLines: ["Definition", "Anchor", "Institution", "Issue", "Reform", "Conclusion"],
      explanation: `${topicTitle} mastery comes from repeated structured recall and answer-ready articulation.`,
      keyPoints: [
        `Mnemonic Anchor: ${acronym} Framework`,
        "Use 3-point intro, 5-point body, 2-line balanced conclusion.",
        "Final output includes factual precision and analytical depth."
      ]
    }
  ];
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | null>(null);
  const [activeDeck, setActiveDeck] = useState<TopicDeck | null>(null);
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

  const handleTopBack = () => {
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
    setActiveDeck({ chapterTitle, topicTitle, slides: buildTopicDeck(chapterTitle, topicTitle) });
    setSlideIndex(0);
  };

  const activeSlide = activeDeck ? activeDeck.slides[slideIndex] : null;
  const progress = activeDeck ? ((slideIndex + 1) / activeDeck.slides.length) * 100 : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={handleTopBack}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">UPSC Notes</h1>
            <p className="text-muted-foreground">Subject-wise visual slide notes (hardcoded and instant)</p>
          </div>
        </div>

        {!selectedSubject && (
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Select Subject</CardTitle>
              <CardDescription>Choose subject first, then chapter and subtopic</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                {SUBJECTS.map((subject) => (
                  <button
                    key={subject.id}
                    onClick={() => setSelectedSubjectId(subject.id)}
                    className="rounded-xl border bg-card p-4 text-left transition hover:border-primary/40 hover:bg-muted/20"
                  >
                    <p className="font-semibold">{subject.name}</p>
                    <p className="mt-1 text-xs text-muted-foreground">{subject.examFocus}</p>
                    <p className="mt-2 text-sm text-muted-foreground">{subject.description}</p>
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
              <Card><CardContent className="flex items-center gap-3 p-4"><BookOpen className="h-8 w-8 text-accent" /><div><p className="text-2xl font-bold">{totalTopics}</p><p className="text-xs text-muted-foreground">Subtopics</p></div></CardContent></Card>
              <Card><CardContent className="flex items-center gap-3 p-4"><Presentation className="h-8 w-8 text-orange-500" /><div><p className="text-sm font-semibold">Slide Deck Mode</p><p className="text-xs text-muted-foreground">Each topic opens as 5-slide notes</p></div></CardContent></Card>
            </div>

            {chapters.length === 0 ? (
              <Card><CardContent className="py-10 text-center"><p className="text-lg font-semibold">Detailed slide notes for {selectedSubject.name} will be added in this same format.</p></CardContent></Card>
            ) : (
              <Card>
                <CardHeader>
                  <CardTitle>{selectedSubject.name} Chapters</CardTitle>
                  <CardDescription>Click any subtopic to open complete slide notes</CardDescription>
                </CardHeader>
                <CardContent>
                  <Accordion type="multiple" className="space-y-3">
                    {chapters.map((chapter) => (
                      <AccordionItem key={chapter.id} value={`chapter-${chapter.id}`} className="rounded-lg border px-4">
                        <AccordionTrigger className="text-left">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{chapter.title}</span>
                            <Badge variant="secondary">{chapter.topics.length} topics</Badge>
                          </div>
                        </AccordionTrigger>
                        <AccordionContent>
                          <p className="mb-3 text-sm text-muted-foreground">{chapter.focus}</p>
                          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
                            {chapter.topics.map((topic) => (
                              <button
                                key={`${chapter.id}-${topic.title}`}
                                onClick={() => openDeck(chapter.title, topic.title)}
                                className="rounded-lg border bg-card p-3 text-left transition hover:border-primary/50 hover:bg-muted/20"
                              >
                                <p className="font-medium">{topic.title}</p>
                                <p className="mt-1 text-xs text-muted-foreground">Open visual slide notes</p>
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
              <div className="rounded-xl border bg-gradient-to-r from-primary/10 via-accent/10 to-background p-4">
                <p className="text-xs font-semibold tracking-wide text-primary">SLIDE HEADING</p>
                <h3 className="mt-1 text-lg font-bold">{activeSlide.heading}</h3>
              </div>

              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-2 text-base"><Sparkles className="h-4 w-4 text-primary" />{activeSlide.visualTitle}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="rounded-md border bg-muted/20 p-3">
                      {activeSlide.visualLines.map((line, i) => <p key={i} className="text-sm leading-relaxed text-muted-foreground">{line}</p>)}
                    </div>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2"><CardTitle className="text-base">Detailed Explanation</CardTitle></CardHeader>
                  <CardContent><p className="text-sm leading-relaxed text-muted-foreground">{activeSlide.explanation}</p></CardContent>
                </Card>
              </div>

              <Card>
                <CardHeader className="pb-2"><CardTitle className="text-base">Complete Notes Points</CardTitle></CardHeader>
                <CardContent>
                  <ul className="space-y-2">
                    {activeSlide.keyPoints.map((point, i) => <li key={i} className="text-sm leading-relaxed text-muted-foreground">{point}</li>)}
                  </ul>
                </CardContent>
              </Card>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <Button variant="outline" onClick={() => setSlideIndex((prev) => Math.max(0, prev - 1))} disabled={slideIndex === 0}>
                  <ChevronLeft className="mr-1 h-4 w-4" />Previous Slide
                </Button>
                <div className="flex gap-2">
                  <Button variant="ghost" onClick={() => { setActiveDeck(null); setSlideIndex(0); }}>Back to Topics</Button>
                  {slideIndex < activeDeck.slides.length - 1 ? (
                    <Button onClick={() => setSlideIndex((prev) => Math.min(activeDeck.slides.length - 1, prev + 1))}>
                      Next Slide<ChevronRight className="ml-1 h-4 w-4" />
                    </Button>
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
