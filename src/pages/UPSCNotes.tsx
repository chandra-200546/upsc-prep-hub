import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen, Landmark, Scale, Building2 } from "lucide-react";

type TopicNote = {
  title: string;
  points: string[];
};

type Chapter = {
  id: string;
  title: string;
  focus: string;
  topics: TopicNote[];
};

const POLITY_CHAPTERS: Chapter[] = [
  {
    id: "1",
    title: "1. Constitutional Framework",
    focus: "Foundations of Indian Constitution",
    topics: [
      { title: "Historical Background", points: ["Study Acts from 1773 to 1947 and their institutional legacy.", "Use timeline-based revision for prelims factual recall."] },
      { title: "Making of the Constitution", points: ["Constituent Assembly debates, committees, and adopted principles are core.", "Link framers' intent with current constitutional practice."] },
      { title: "Salient Features of the Constitution", points: ["Parliamentary democracy, federalism, judicial review, and secularism are recurring themes.", "Compare with other constitutions in mains answers."] },
      { title: "Preamble of the Constitution", points: ["Reflects constitutional philosophy: justice, liberty, equality, fraternity.", "Interpret terms through Supreme Court jurisprudence."] },
      { title: "Union and its Territory", points: ["Understand Articles on admission, establishment, and alteration of states.", "Questions often test Article 2 vs Article 3 distinction."] },
      { title: "Citizenship", points: ["Know constitutional provisions and Citizenship Act evolution.", "Track current debates around registration and rights."] },
      { title: "Fundamental Rights", points: ["Part III is highly dynamic via judicial interpretation.", "Prepare restrictions, exceptions, and landmark case mapping."] },
      { title: "Directive Principles of State Policy", points: ["Non-justiciable but central to welfare-state legislation.", "Use FR-DPSP harmony in mains analytical structure."] },
      { title: "Fundamental Duties", points: ["Useful in ethics-governance answers and civic constitutionalism.", "Questions ask constitutional morality and duty-right balance."] },
      { title: "Amendment of the Constitution", points: ["Classify simple majority, special majority, and state ratification cases.", "Track frequently amended areas and political context."] },
      { title: "Basic Structure of the Constitution", points: ["Kesavananda and later rulings define constitutional limits on amending power.", "Use doctrine in constitutional conflict questions."] }
    ]
  },
  {
    id: "2",
    title: "2. System of Government",
    focus: "Institutional design and federal functioning",
    topics: [
      { title: "Parliamentary System", points: ["Real executive in Council of Ministers; nominal head at Union/State level.", "Focus on collective responsibility and cabinet accountability."] },
      { title: "Federal System", points: ["Indian model is federal with unitary tilt in structure and operation.", "Use comparative approach with classic federations."] },
      { title: "Centre-State Relations", points: ["Legislative, administrative, and financial relations are a core mains zone.", "Current affairs linkage is essential for high-quality answers."] },
      { title: "Inter-State Relations", points: ["Inter-State Council, river disputes, and coordination mechanisms matter.", "Map federal cooperation vs federal friction examples."] },
      { title: "Emergency Provisions", points: ["National, State, and Financial emergencies have distinct triggers and effects.", "Practice constitutional safeguards and misuse debates."] },
      { title: "President's Rule", points: ["Article 356 use, S.R. Bommai limits, and federal implications are important.", "Questions often test constitutional morality in imposition."] },
      { title: "Financial Emergency", points: ["Never invoked but conceptually significant for constitutional understanding.", "Prepare constitutional consequences and fiscal control aspects."] }
    ]
  },
  {
    id: "3",
    title: "3. Central Government",
    focus: "Union executive, legislature and legal offices",
    topics: [
      { title: "President", points: ["Election, powers, vetoes, pardoning and ordinance role are key areas.", "Separate constitutional text from political convention."] },
      { title: "Vice-President", points: ["Ex-officio Chairman of Rajya Sabha with specific constitutional role.", "Revise election process and removal procedure."] },
      { title: "Prime Minister", points: ["Center of parliamentary executive and cabinet coordination.", "UPSC asks role in policy, coalition and governance architecture."] },
      { title: "Central Council of Ministers", points: ["Understand composition tiers and constitutional responsibility.", "Differentiate cabinet from council and committees."] },
      { title: "Cabinet Committees", points: ["Non-constitutional but central to policy decision-making.", "Study functional significance in governance efficiency."] },
      { title: "Parliament", points: ["Structure, sessions, devices, and legislative process are frequent.", "Use procedure + constitutional principle in answers."] },
      { title: "Parliamentary Committees", points: ["Backbone of legislative scrutiny and oversight.", "Important for questions on accountability deficits."] },
      { title: "Parliamentary Forums", points: ["Issue-based awareness platforms inside Parliament.", "Useful for governance and thematic policy linkage."] },
      { title: "Attorney General of India", points: ["Highest law officer at Union level with advisory and court functions.", "Clarify rights, limitations, and parliamentary participation."] }
    ]
  },
  {
    id: "4",
    title: "4. State Government",
    focus: "State executive-legislature-judiciary framework",
    topics: [
      { title: "Governor", points: ["Constitutional head with discretionary powers under debate.", "Use Sarkaria/Punchhi recommendations in mains answers."] },
      { title: "Chief Minister", points: ["Real executive authority at state level.", "Discuss role in federal bargaining and governance delivery."] },
      { title: "State Council of Ministers", points: ["Collective responsibility to Legislative Assembly remains central.", "Compare state and union executive structures."] },
      { title: "State Legislature", points: ["Legislative powers, bicameralism in select states, and procedures.", "Focus on control over executive and lawmaking constraints."] },
      { title: "High Court", points: ["Constitutional court with writ and supervisory jurisdiction.", "Important in federal judicial structure and rights protection."] },
      { title: "Subordinate Courts", points: ["District judiciary and judicial administration basics.", "Connect with judicial reforms and access to justice."] },
      { title: "Advocate General of State", points: ["Highest law officer of state government.", "Revise appointment, duties, and legislative role."] }
    ]
  },
  {
    id: "5",
    title: "5. Local Government",
    focus: "Grassroots democracy and decentralisation",
    topics: [
      { title: "Panchayati Raj", points: ["73rd Amendment, 3-tier system, powers and finances.", "Analyze devolution quality: funds, functions, functionaries."] },
      { title: "Municipalities", points: ["74th Amendment and urban local governance architecture.", "Link to urban planning, service delivery, and accountability."] },
      { title: "Scheduled and Tribal Areas", points: ["Special administrative provisions for inclusion and protection.", "Use PESA and local autonomy dimensions in answers."] }
    ]
  },
  {
    id: "6",
    title: "6. Union Territories and Special Areas",
    focus: "Asymmetrical constitutional arrangements",
    topics: [
      { title: "Union Territories", points: ["Administration models differ by UT and legislative setup.", "Prepare constitutional articles and current governance patterns."] },
      { title: "Special Status / Special Provisions for States", points: ["Study temporary/special provisions and their political-legal context.", "Use current developments cautiously with constitutional backing."] },
      { title: "Scheduled Areas", points: ["Fifth Schedule governance and protective framework.", "Important for tribal rights, land and administration."] },
      { title: "Tribal Areas", points: ["Sixth Schedule autonomous councils in select northeastern states.", "Compare Fifth and Sixth Schedule institutions."] }
    ]
  },
  {
    id: "7",
    title: "7. Constitutional Bodies",
    focus: "Bodies directly established by Constitution",
    topics: [
      { title: "Election Commission", points: ["Autonomy, powers, and electoral integrity are core dimensions.", "Track reforms around finance, transparency and enforcement."] },
      { title: "Union Public Service Commission", points: ["Constitutional recruitment body safeguarding merit and neutrality.", "Questions ask independence and consultation scope."] },
      { title: "State Public Service Commission", points: ["State-level recruitment architecture and constitutional safeguards.", "Compare with UPSC where relevant."] },
      { title: "Finance Commission", points: ["Vertical-horizontal devolution and fiscal federalism engine.", "Use latest commission trends in mains answers."] },
      { title: "CAG", points: ["Audits public expenditure and strengthens parliamentary control.", "Prepare role in accountability architecture."] },
      { title: "Attorney General", points: ["Constitutional legal advisor to Union government.", "Distinguish from Solicitor General (non-constitutional)."] },
      { title: "Advocate General", points: ["State-level counterpart of Attorney General.", "Understand advisory and representational duties."] },
      { title: "National Commissions for SCs, STs, BCs", points: ["Safeguard rights and monitor constitutional protections.", "Use institution-performance analysis in answers."] }
    ]
  },
  {
    id: "8",
    title: "8. Non-Constitutional Bodies",
    focus: "Statutory/executive institutions in governance",
    topics: [
      { title: "NITI Aayog", points: ["Policy think tank replacing Planning Commission model.", "Cooperative federalism and SDG localization are key angles."] },
      { title: "NHRC", points: ["National human rights oversight with recommendatory powers.", "Assess effectiveness and institutional constraints."] },
      { title: "SHRC", points: ["State-level human rights monitoring institutions.", "Questions may ask overlap and coordination with NHRC."] },
      { title: "CIC", points: ["Central Information Commission under RTI framework.", "Core for transparency and accountable governance."] },
      { title: "CVC", points: ["Integrity institution against corruption in central administration.", "Map its powers and limitations with examples."] },
      { title: "CBI", points: ["Premier investigation agency with legal and federal issues.", "Consent and autonomy debates are frequent in mains."] },
      { title: "Lokpal and Lokayuktas", points: ["Anti-corruption ombudsman institutions at Union and State levels.", "Focus on implementation gap and institutional design."] },
      { title: "National Development Council (legacy context)", points: ["Historically linked to planning era center-state policy dialogue.", "Use as institutional evolution context in answers."] }
    ]
  },
  {
    id: "9",
    title: "9. Other Constitutional Dimensions",
    focus: "Important but less-discussed constitutional provisions",
    topics: [
      { title: "Co-operative Societies", points: ["97th Amendment context and federal legal debates are important.", "Know constitutional status and governance concerns."] },
      { title: "Official Language", points: ["Constitutional language framework and practical multilingual governance.", "Prepare Eighth Schedule and language policy debates."] },
      { title: "Public Services", points: ["Civil services framework, safeguards, and tribunal linkage.", "Important for governance quality questions."] },
      { title: "Tribunals", points: ["Specialized adjudication bodies and judicial review concerns.", "Use separation of powers and efficiency balance."] },
      { title: "Rights and Liabilities of Government", points: ["State liability and sovereign function debates in constitutional law.", "Useful for legal-governance analytical questions."] },
      { title: "Special Officer for Linguistic Minorities", points: ["Constitutional protection mechanism for linguistic rights.", "Low-frequency but scoring prelims area."] }
    ]
  },
  {
    id: "10",
    title: "10. Political Dynamics",
    focus: "Constitution in real political practice",
    topics: [
      { title: "Anti-Defection Law", points: ["Tenth Schedule, role of Speaker, and reform debates are central.", "Frequent mains topic on ethics and democracy quality."] },
      { title: "Pressure Groups", points: ["Influence policy through advocacy, mobilization and negotiation.", "Contrast with political parties and civil society roles."] },
      { title: "National Integration", points: ["Constitutional values, unity-diversity balance, and social cohesion.", "Use federalism + inclusion framework in answers."] },
      { title: "Foreign Policy", points: ["Executive-led domain with parliamentary and constitutional context.", "Link constitutional values with strategic interests."] },
      { title: "Election Laws", points: ["Legal architecture governing electoral conduct and fairness.", "Track reforms on criminalization, money power, transparency."] },
      { title: "Representation of People Acts", points: ["Core statutory base for elections, disqualifications, and process.", "Revise sections frequently used in current affairs."] }
    ]
  },
  {
    id: "11",
    title: "11. New / Extra Chapters in Latest Edition",
    focus: "Advanced enrichment for mains and interview",
    topics: [
      { title: "Concept of the Constitution", points: ["Philosophical foundation and constitutional morality lens.", "Use for value-oriented introductions and conclusions."] },
      { title: "Constitutional Prescription", points: ["Understand text, intent, and institutional design choices.", "Useful for normative evaluation answers."] },
      { title: "World Constitutions", points: ["Comparative constitutional insights to enrich arguments.", "Use selective comparisons; avoid unnecessary detail."] },
      { title: "Landmark Judgments and their Impact", points: ["Track doctrine-building judgments and governance impact.", "Prepare issue-wise case compendium for revision."] },
      { title: "Important Doctrines of Constitutional Interpretation", points: ["Basic Structure, Harmonious Construction, Pith and Substance, etc.", "High utility in judiciary and federalism questions."] },
      { title: "Law Commission of India", points: ["Advisory legal reform body shaping policy discourse.", "Use as reform reference in legal-governance answers."] },
      { title: "Bar Council of India", points: ["Professional regulation of legal practice and ethics.", "Know statutory nature and disciplinary role."] },
      { title: "Delimitation Commission of India", points: ["Constituency boundary rationalization and representation balance.", "Important for electoral reforms context."] },
      { title: "National Commission for Women", points: ["Institutional mechanism for women-centric rights and policy oversight.", "Use in social justice and governance answers."] },
      { title: "National Commission for Protection of Child Rights", points: ["Protects child rights under statutory framework.", "Relevant for welfare-governance and social policy."] },
      { title: "National Commission for Minorities", points: ["Institutional support for minority rights and safeguards.", "Link with constitutional equality and pluralism."] },
      { title: "Consumer Commissions", points: ["Quasi-judicial consumer dispute resolution architecture.", "Useful in governance and citizen-centric service delivery topics."] }
    ]
  }
];

const UPSCNotes = () => {
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  const totalTopics = POLITY_CHAPTERS.reduce((acc, chapter) => acc + chapter.topics.length, 0);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6">
        <div className="mb-6 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="bg-gradient-to-r from-primary to-accent bg-clip-text text-3xl font-bold text-transparent">
              UPSC Notes - Polity
            </h1>
            <p className="text-muted-foreground">
              Chapter-wise, topic-wise readable notes aligned to your provided structure
            </p>
          </div>
        </div>

        <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
          <Card className="border-primary/20 bg-gradient-to-br from-primary/10 to-primary/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Landmark className="h-8 w-8 text-primary" />
              <div>
                <p className="text-2xl font-bold">{POLITY_CHAPTERS.length}</p>
                <p className="text-xs text-muted-foreground">Major Chapters</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-accent/20 bg-gradient-to-br from-accent/10 to-accent/5">
            <CardContent className="flex items-center gap-3 p-4">
              <BookOpen className="h-8 w-8 text-accent" />
              <div>
                <p className="text-2xl font-bold">{totalTopics}</p>
                <p className="text-xs text-muted-foreground">Structured Topics</p>
              </div>
            </CardContent>
          </Card>

          <Card className="border-orange-500/20 bg-gradient-to-br from-orange-500/10 to-amber-500/5">
            <CardContent className="flex items-center gap-3 p-4">
              <Scale className="h-8 w-8 text-orange-500" />
              <div>
                <p className="text-sm font-semibold">Mains + Prelims Ready</p>
                <p className="text-xs text-muted-foreground">Built for revision and answer writing</p>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card className="mb-6 border-border/60">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Building2 className="h-4 w-4 text-primary" />
              Chapter Index
            </CardTitle>
            <CardDescription>Quick scan of all polity chapters you listed</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2 xl:grid-cols-3">
              {POLITY_CHAPTERS.map((chapter) => (
                <div key={`index-${chapter.id}`} className="rounded-lg border bg-muted/20 px-3 py-2">
                  <p className="text-sm font-medium">{chapter.title}</p>
                  <p className="mt-1 text-xs text-muted-foreground">{chapter.focus}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Detailed Notes</CardTitle>
            <CardDescription>Open any chapter and revise each topic with short, readable points</CardDescription>
          </CardHeader>
          <CardContent>
            <Accordion type="multiple" className="w-full space-y-3">
              {POLITY_CHAPTERS.map((chapter) => (
                <AccordionItem
                  key={chapter.id}
                  value={`chapter-${chapter.id}`}
                  className="rounded-xl border bg-gradient-to-r from-card to-muted/20 px-4"
                >
                  <AccordionTrigger className="text-left">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{chapter.title}</span>
                      <Badge variant="secondary">{chapter.topics.length} topics</Badge>
                    </div>
                  </AccordionTrigger>
                  <AccordionContent>
                    <p className="mb-4 text-sm text-muted-foreground">{chapter.focus}</p>
                    <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                      {chapter.topics.map((topic, idx) => (
                        <Card key={`${chapter.id}-${idx}`} className="border-border/60 bg-card/90">
                          <CardHeader className="pb-2">
                            <CardTitle className="text-sm">{topic.title}</CardTitle>
                          </CardHeader>
                          <CardContent>
                            <ul className="space-y-2">
                              {topic.points.map((point, pointIndex) => (
                                <li key={pointIndex} className="text-sm leading-relaxed text-muted-foreground">
                                  {point}
                                </li>
                              ))}
                            </ul>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UPSCNotes;
