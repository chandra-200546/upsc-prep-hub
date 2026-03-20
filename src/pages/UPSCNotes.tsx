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
type TopicProfile = {
  fundamentals: string[];
  legalAnchor: string;
  processFlow: string[];
  advancedIssues: string[];
  prelimsFocus: string[];
  mainsFocus: string[];
  commonMistakes: string[];
  mnemonic: string;
  example: string;
  comparison: string[];
};

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

const REFERENCE_SOURCE = "Laxmikanth Indian Polity 8th Edition (project reference copy)";

const TOPIC_PROFILES: Record<string, Partial<TopicProfile>> = {
  "Fundamental Rights": {
    legalAnchor: "Articles 12-35, with major interpretation through Supreme Court judgments.",
    fundamentals: ["Nature and scope of enforceable rights", "Citizen vs person rights", "Reasonable restrictions framework"],
    processFlow: ["Identify right", "Check state action", "Apply restriction test", "Constitutional remedy"],
    advancedIssues: ["Rights-security balance", "Expansion through judicial interpretation", "Horizontal rights debates"],
    prelimsFocus: ["Article clusters", "Exceptions and suspension", "Citizen-only rights"],
    mainsFocus: ["Rights vs welfare-state tension", "Doctrine-based analysis", "Balanced reform approach"],
    commonMistakes: ["Mixing DPSP with FR", "Ignoring Article 32/226 remedies"],
    mnemonic: "E-F-P-R-C-R",
    comparison: ["FR (justiciable) vs DPSP (non-justiciable)", "Negative liberty vs positive obligations"],
    example: "Article 21 expansion into dignity, livelihood, and procedural fairness."
  },
  "Directive Principles of State Policy": {
    legalAnchor: "Articles 36-51 under Part IV.",
    fundamentals: ["Welfare-state objectives", "Non-justiciable but governance-guiding", "Policy orientation role"],
    processFlow: ["Constitutional directive", "Legislative translation", "Administrative implementation", "Outcome review"],
    advancedIssues: ["Implementation gap due to state capacity", "FR-DPSP harmony in jurisprudence"],
    prelimsFocus: ["Classification and article placement", "DPSP-related amendments"],
    mainsFocus: ["Social justice outcomes", "Policy-performance evaluation"],
    commonMistakes: ["Treating DPSP as unenforceable and therefore irrelevant"],
    mnemonic: "SGL = Socialist, Gandhian, Liberal-intellectual",
    comparison: ["FR protects liberty; DPSP drives welfare policy"],
    example: "Public health and education policy frameworks reflect DPSP orientation."
  },
  President: {
    legalAnchor: "Articles 52-62; powers include veto, ordinance, and pardon framework.",
    fundamentals: ["Constitutional head", "Election and tenure", "Aid and advice principle"],
    processFlow: ["Cabinet advice", "Presidential action", "Parliamentary oversight", "Judicial review where applicable"],
    advancedIssues: ["Discretionary gray zones", "Ordinance controversy", "Pardon power debates"],
    prelimsFocus: ["Electoral college composition", "Veto types", "Emergency roles"],
    mainsFocus: ["Conventions vs constitutional text", "Role in coalition and crisis moments"],
    commonMistakes: ["Treating President as purely ceremonial in all contexts"],
    mnemonic: "EVOP = Election, Veto, Ordinance, Pardon",
    comparison: ["Nominal head vs real executive"],
    example: "Ordinance route examined for urgency and legislative bypass concerns."
  },
  Parliament: {
    legalAnchor: "Articles 79 onwards, rules of procedure, constitutional financial control.",
    fundamentals: ["Bicameral lawmaking", "Executive accountability", "Budgetary control"],
    processFlow: ["Bill introduction", "Debate/committee", "Passage", "Assent/implementation"],
    advancedIssues: ["Deliberation quality decline", "Committee bypass concerns", "Money bill misuse debates"],
    prelimsFocus: ["Joint sitting", "Money bill features", "Session devices"],
    mainsFocus: ["Institutional reform for scrutiny and productivity"],
    commonMistakes: ["Confusing ordinary bill and money bill pathways"],
    mnemonic: "LACB = Legislation, Accountability, Control of Budget",
    comparison: ["Lok Sabha primacy vs Rajya Sabha federal function"],
    example: "Committee stage strengthens technical scrutiny of complex bills."
  },
  Governor: {
    legalAnchor: "Articles 153-162, 163, 200.",
    fundamentals: ["State constitutional head", "Aid and advice model", "Limited discretionary powers"],
    processFlow: ["State cabinet advice", "Governor action", "Possible reservation/reference", "Judicial scrutiny"],
    advancedIssues: ["Federal friction", "Delay in assent", "Constitutional convention issues"],
    prelimsFocus: ["Appointment and tenure", "Bill reservation powers"],
    mainsFocus: ["Constitutional morality and cooperative federalism"],
    commonMistakes: ["Assuming unrestricted discretion"],
    mnemonic: "AAR = Advice, Assent, Reservation",
    comparison: ["Governor role vs President role in constitutional design"],
    example: "Bill reservation for President often triggers federal debate."
  },
  "Panchayati Raj": {
    legalAnchor: "Part IX, 73rd Constitutional Amendment.",
    fundamentals: ["3-tier rural structure", "Gram Sabha centrality", "Devolution principles"],
    processFlow: ["Plan at local level", "Funds allocation", "Implementation", "Social audit"],
    advancedIssues: ["Funds-functions-functionaries gap", "Capacity and training limitations"],
    prelimsFocus: ["Constitutional features and exceptions"],
    mainsFocus: ["Deepening grassroots democracy"],
    commonMistakes: ["Ignoring state-specific devolution variation"],
    mnemonic: "3F = Funds, Functions, Functionaries",
    comparison: ["Panchayats vs Municipal bodies"],
    example: "Local water and sanitation planning anchored in Gram Sabha process."
  },
  "Election Commission": {
    legalAnchor: "Article 324 with statutory electoral framework.",
    fundamentals: ["Election conduct authority", "Level playing field", "Model code oversight"],
    processFlow: ["Schedule announcement", "Nomination/scrutiny", "Polling", "Counting and certification"],
    advancedIssues: ["Autonomy concerns", "Campaign finance transparency", "Digital misinformation controls"],
    prelimsFocus: ["Constitutional basis and powers"],
    mainsFocus: ["Electoral reforms and institutional strengthening"],
    commonMistakes: ["Assuming unlimited punitive power under MCC"],
    mnemonic: "SNPC = Schedule, Nomination, Polling, Counting",
    comparison: ["Constitutional authority vs statutory limitations"],
    example: "Enforcement consistency is key for voter trust."
  }
};

const getTopicProfile = (topicTitle: string, chapterTitle: string): TopicProfile => {
  const memo = topicTitle.split(" ").map((w) => w[0]).join("");
  const partial = TOPIC_PROFILES[topicTitle] || {};
  return {
    fundamentals: partial.fundamentals || [
      `${topicTitle} definition and scope`,
      `${chapterTitle} context and relevance`,
      "Core conceptual pillars for UPSC understanding"
    ],
    legalAnchor: partial.legalAnchor || "Constitutional/statutory basis should be linked while answering this topic.",
    processFlow: partial.processFlow || ["Concept foundation", "Institutional role", "Operational pathway", "Review and accountability"],
    advancedIssues: partial.advancedIssues || [
      "Design strengths and structural limitations",
      "Implementation and governance bottlenecks",
      "Reform pathway with constitutional balance"
    ],
    prelimsFocus: partial.prelimsFocus || ["Definition precision", "Article/body matching", "Statement-based elimination"],
    mainsFocus: partial.mainsFocus || ["Intro-body-conclusion with constitutional anchor", "Issue-analysis-reform structure"],
    commonMistakes: partial.commonMistakes || ["One-sided answers", "No constitutional anchor", "Missing balanced conclusion"],
    mnemonic: partial.mnemonic || `${memo} Framework`,
    example: partial.example || `${topicTitle} is frequently applied in governance and constitutional discussions.`,
    comparison: partial.comparison || ["Core concept vs related concept", "Constitutional text vs practical operation"]
  };
};

const buildDeck = (chapterTitle: string, topicTitle: string): Slide[] => {
  const profile = getTopicProfile(topicTitle, chapterTitle);
  return [
    {
      heading: "Slide 1 - Introduction",
      bullets: [`Topic: ${topicTitle}`, `Chapter: ${chapterTitle}`, "Foundation to advanced flow"],
      detailedExplanation: `${topicTitle} ni beginner nundi advanced varaku structured ga cover chestham. This helps with prelims clarity and mains depth.`,
      example: profile.example,
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
      bullets: profile.fundamentals,
      detailedExplanation: `${topicTitle} concept ni clear ga break chesi, exact conceptual vocabulary tho build chestham.`,
      example: "Answer skeleton: define -> classify -> explain.",
      visualTitle: "Concept Map",
      visualLines: ["Definition", "Structure", "Process", "Outcome"]
    },
    {
      heading: "Slide 4 - Constitutional / Legal Anchor",
      bullets: ["Primary constitutional basis", "Statutory supplements", "Interpretive significance"],
      detailedExplanation: profile.legalAnchor,
      example: "In mains answers, always mention constitutional anchor in the first half.",
      visualTitle: "Legal Anchor Table",
      visualLines: ["Provision", "Scope", "Practical Effect", "UPSC Relevance"]
    },
    {
      heading: "Slide 5 - Process and Institutional Mechanics",
      bullets: profile.processFlow,
      detailedExplanation: `${topicTitle} practical operation ni step-wise ga ardham chesukunte application questions easy avutayi.`,
      example: "Map each step with the responsible institution.",
      visualTitle: "Operational Flowchart",
      visualLines: profile.processFlow.map((s, i) => `${i + 1}. ${s}`)
    },
    {
      heading: "Slide 6 - Intermediate to Advanced Analysis",
      bullets: profile.advancedIssues,
      detailedExplanation: `${topicTitle} lo critical evaluation points ni strengths-limitations-reforms pattern lo rayadam scoring approach.`,
      example: "Balanced mains line: constitutional intent vs implementation gap.",
      visualTitle: "Issue-Reform Matrix",
      visualLines: ["Strength", "Limitation", "Impact", "Reform"]
    },
    {
      heading: "Slide 7 - Comparison and Visual Representation",
      bullets: profile.comparison,
      detailedExplanation: `Similar concepts madhya difference table build chesthe revision speed and retention improve avutayi.`,
      example: "Table format: Feature | Concept A | Concept B",
      visualTitle: "Comparison Table",
      visualLines: ["Feature | Side A | Side B", "Constitutional Base | ... | ...", "Scope | ... | ...", "Limitations | ... | ..."]
    },
    {
      heading: "Slide 8 - Memory Tricks and Common Mistakes",
      bullets: [`Mnemonic: ${profile.mnemonic}`, ...profile.commonMistakes],
      detailedExplanation: "Mnemonic + mistake-alert approach improves quick revision and prevents avoidable errors in exam hall.",
      example: "Correction model: constitutional anchor + evidence + balanced conclusion.",
      visualTitle: "Retention Block",
      visualLines: ["Mnemonic", "Mistake Alert", "Correct Pattern", "Final Recall"]
    },
    {
      heading: "Slide 9 - Exam-Oriented Questions",
      bullets: ["Prelims style check", "Mains 10/15 marker", "Interview prompt"],
      detailedExplanation: `${topicTitle} ni prelims-fact, mains-analysis, interview-application mode lo practice chesthe output quality improve avutundi.`,
      example: `Mains sample: Critically examine ${topicTitle} in constitutional governance.`,
      visualTitle: "Question Ladder",
      visualLines: ["Prelims fact", "Mains analysis", "Interview application"]
    },
    {
      heading: "Slide 10 - Summary and Quick Revision",
      bullets: ["Key points", ...profile.prelimsFocus.slice(0, 2), ...profile.mainsFocus.slice(0, 2)],
      detailedExplanation: "Final recall format: Intro (2 lines) -> Body (3 subheadings) -> Balanced conclusion (1 line).",
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
