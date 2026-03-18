import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { ArrowLeft, BookOpen } from "lucide-react";

type TopicNote = {
  topic: string;
  notes: string[];
};

type SubjectUnit = {
  unit: string;
  topics: TopicNote[];
};

type SubjectNotes = {
  subject: string;
  examFocus: string;
  units: SubjectUnit[];
};

const UPSC_NOTES: SubjectNotes[] = [
  {
    subject: "Indian Polity & Governance",
    examFocus: "GS Paper II + Prelims",
    units: [
      {
        unit: "Constitutional Framework",
        topics: [
          {
            topic: "Preamble, Features, Basic Structure",
            notes: [
              "Preamble reflects justice, liberty, equality, fraternity and provides constitutional philosophy.",
              "Indian Constitution has federal features with unitary bias, parliamentary form, judicial review, and independent constitutional bodies.",
              "Basic Structure Doctrine (Kesavananda Bharati, 1973) limits Parliament's amending power."
            ]
          },
          {
            topic: "Fundamental Rights and DPSP",
            notes: [
              "Part III ensures enforceable rights; Article 32 is a core constitutional remedy.",
              "Directive Principles are non-justiciable but guide welfare-state policy and lawmaking.",
              "Right-DPSP harmony evolved through Minerva Mills and later judgments."
            ]
          },
          {
            topic: "Parliament and State Legislature",
            notes: [
              "Law-making process includes bill introduction, committee scrutiny, and passage in both houses (except Money Bill rules).",
              "Parliamentary committees improve accountability and technical quality of legislation.",
              "Federal tensions often arise over Concurrent List and fiscal devolution."
            ]
          }
        ]
      },
      {
        unit: "Executive and Judiciary",
        topics: [
          {
            topic: "President, PM, Council of Ministers",
            notes: [
              "Real executive power is exercised by PM and Council under aid and advice framework.",
              "Collective responsibility to Lok Sabha is a key parliamentary accountability tool.",
              "Ordinance power is temporary and subject to legislative approval."
            ]
          },
          {
            topic: "Supreme Court and High Courts",
            notes: [
              "Judicial review protects constitutional supremacy and rights.",
              "Public Interest Litigation expanded access to justice in social and environmental issues.",
              "Independence of judiciary depends on appointments, tenure security, and institutional autonomy."
            ]
          },
          {
            topic: "Constitutional and Statutory Bodies",
            notes: [
              "ECI, CAG, UPSC, Finance Commission have constitutional status and specific mandates.",
              "NITI Aayog, CVC, CIC and NHRC strengthen policy coordination and oversight.",
              "Questions often test functional distinction and constitutional backing."
            ]
          }
        ]
      },
      {
        unit: "Governance and Accountability",
        topics: [
          {
            topic: "E-Governance and Service Delivery",
            notes: [
              "Digital governance improves transparency, DBT targeting and grievance redressal.",
              "Challenges include data privacy, digital exclusion, and local capacity gaps.",
              "UPSC answers should balance innovation with institutional safeguards."
            ]
          },
          {
            topic: "Transparency and Citizen Participation",
            notes: [
              "RTI, social audits, citizen charters and public consultations improve accountability.",
              "Outcome-oriented governance requires measurable service standards.",
              "Local body strengthening is critical for last-mile implementation."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Indian Economy",
    examFocus: "GS Paper III + Prelims",
    units: [
      {
        unit: "Macroeconomic Fundamentals",
        topics: [
          {
            topic: "Growth, Inflation, Unemployment",
            notes: [
              "GDP growth indicates output expansion but should be read with employment and inequality metrics.",
              "Inflation dynamics involve food, fuel, and core components; policy response differs by source.",
              "UPSC expects linkage between macro indicators and welfare outcomes."
            ]
          },
          {
            topic: "Fiscal Policy and Budget",
            notes: [
              "Fiscal deficit, revenue deficit and primary deficit indicate macro stability pressure.",
              "Quality of expenditure (capital vs revenue) is key for medium-term growth.",
              "FRBM framework targets prudence while preserving counter-cyclical policy space."
            ]
          },
          {
            topic: "Monetary Policy and Banking",
            notes: [
              "RBI uses repo corridor, CRR/SLR and liquidity tools for inflation and financial stability.",
              "Transmission, credit growth and NPA trends determine policy effectiveness.",
              "Questions often compare fiscal and monetary roles during shocks."
            ]
          }
        ]
      },
      {
        unit: "Development and Sectors",
        topics: [
          {
            topic: "Agriculture and Food Security",
            notes: [
              "Key themes: productivity, irrigation, MSP debate, value chains, and risk mitigation.",
              "Food security includes availability, affordability, nutrition outcomes, and distribution efficiency.",
              "UPSC answers should integrate climate resilience and farm diversification."
            ]
          },
          {
            topic: "Industry and Infrastructure",
            notes: [
              "Manufacturing competitiveness depends on logistics, power reliability, and regulatory simplicity.",
              "Infrastructure financing needs blended models: budget, PPP, DFI, and state capacity.",
              "Employment elasticity and export competitiveness are core analytical angles."
            ]
          },
          {
            topic: "External Sector",
            notes: [
              "CAD sustainability depends on export performance, remittances, and capital inflows.",
              "Exchange rate management balances stability with competitiveness.",
              "Global commodity shocks and geopolitics influence inflation-growth trade-offs."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "History and Culture",
    examFocus: "GS Paper I + Prelims",
    units: [
      {
        unit: "Ancient and Medieval India",
        topics: [
          {
            topic: "Sources and Historical Reconstruction",
            notes: [
              "Archaeology, inscriptions, coins, literary texts and foreign accounts are core sources.",
              "Cross-verification of sources prevents one-dimensional interpretations.",
              "UPSC prelims often asks chronology, cultural features, and source-based distinctions."
            ]
          },
          {
            topic: "Society, Religion and Art",
            notes: [
              "Bhakti-Sufi traditions shaped syncretic cultural practices and social reform currents.",
              "Temple architecture, sculpture, and manuscript traditions require period-region mapping.",
              "Prepare comparative tables for schools, styles and dynastic patronage."
            ]
          }
        ]
      },
      {
        unit: "Modern India and Freedom Struggle",
        topics: [
          {
            topic: "Colonial Economy and Society",
            notes: [
              "Colonial policies restructured agrarian relations, trade patterns, and deindustrialization debates.",
              "Drain of wealth and fiscal extraction are recurring analytical dimensions.",
              "Link economic policies to peasant/tribal resistance patterns."
            ]
          },
          {
            topic: "National Movement",
            notes: [
              "Trace phases: moderate, extremist, Gandhian mass movements, socialist and revolutionary strands.",
              "Understand differences in strategies: constitutionalism, satyagraha, mass mobilization.",
              "UPSC mains expects critical evaluation of leadership, inclusivity and outcomes."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Geography",
    examFocus: "GS Paper I + Prelims",
    units: [
      {
        unit: "Physical Geography",
        topics: [
          {
            topic: "Geomorphology and Climatology",
            notes: [
              "Plate tectonics explains mountains, earthquakes, volcanism, and continental drift.",
              "Atmospheric circulation drives pressure belts, winds, monsoons, and cyclonic systems.",
              "Use process-based diagrams for mains answers."
            ]
          },
          {
            topic: "Oceanography and Biogeography",
            notes: [
              "Currents influence climate, fisheries, and marine trade routes.",
              "Marine ecology and coastal vulnerability are increasingly relevant for policy questions.",
              "Biodiversity hotspots and conservation geography overlap with environment syllabus."
            ]
          }
        ]
      },
      {
        unit: "Indian Geography",
        topics: [
          {
            topic: "Physiography, Climate and Monsoon",
            notes: [
              "Indian monsoon depends on land-sea contrast, ITCZ shift, ENSO/IOD interactions.",
              "Regional climate variability affects agriculture, water and disaster risk.",
              "Interlink maps with current events (heatwaves, floods, drought)."
            ]
          },
          {
            topic: "Resources, Agriculture and Industry",
            notes: [
              "Spatial patterns of minerals, crops, and industries are asked frequently.",
              "Location factors include transport, market, labor, and resource proximity.",
              "UPSC answers should combine maps with economic and environmental implications."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Environment & Ecology",
    examFocus: "GS Paper III + Prelims",
    units: [
      {
        unit: "Ecology Basics",
        topics: [
          {
            topic: "Ecosystems and Biodiversity",
            notes: [
              "Ecosystem structure includes producers, consumers, decomposers and nutrient cycles.",
              "Biodiversity loss is driven by habitat change, invasive species, overexploitation and climate stress.",
              "Conservation requires in-situ and ex-situ strategies with community participation."
            ]
          },
          {
            topic: "Environmental Governance",
            notes: [
              "National laws, institutions and EIA mechanisms regulate ecological externalities.",
              "International conventions (CBD, UNFCCC, CITES, Ramsar) are recurring prelims areas.",
              "Prepare convention-year-objective quick revision sheets."
            ]
          }
        ]
      },
      {
        unit: "Climate and Sustainability",
        topics: [
          {
            topic: "Climate Change and Adaptation",
            notes: [
              "Mitigation reduces emissions; adaptation reduces vulnerability.",
              "India's strategy blends energy transition, adaptation finance, and climate justice.",
              "Use sectoral examples: agriculture, coastal zones, urban heat, water systems."
            ]
          },
          {
            topic: "Pollution and Resource Management",
            notes: [
              "Air-water-soil pollution needs integrated regulation and local enforcement.",
              "Circular economy and waste hierarchy are policy priorities.",
              "UPSC mains rewards practical governance recommendations."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Science & Technology",
    examFocus: "GS Paper III + Prelims",
    units: [
      {
        unit: "Emerging Technologies",
        topics: [
          {
            topic: "AI, Data and Cyber Security",
            notes: [
              "AI governance needs fairness, transparency, accountability and privacy safeguards.",
              "Cyber security involves institutional coordination, CERT systems, capacity and awareness.",
              "Balance innovation with rights and national security concerns."
            ]
          },
          {
            topic: "Biotechnology and Health Tech",
            notes: [
              "Core areas: genomics, vaccines, diagnostics, bio-manufacturing, and regulation.",
              "Ethical issues include consent, biosafety, and equitable access.",
              "UPSC may ask techno-legal-policy integration."
            ]
          }
        ]
      },
      {
        unit: "Space, Defence and Innovation Ecosystem",
        topics: [
          {
            topic: "Space Technology Applications",
            notes: [
              "Remote sensing, navigation and communication satellites support governance and development.",
              "Commercialization and private participation are new policy trends.",
              "Use examples from agriculture, disaster management and logistics."
            ]
          },
          {
            topic: "R&D and Start-up Ecosystem",
            notes: [
              "Innovation requires public R&D, university-industry collaboration and patient capital.",
              "Policy bottlenecks include regulatory delays and skill gaps.",
              "Answer structure: status, challenges, reforms, way forward."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Current Affairs & International Relations",
    examFocus: "GS Paper II + Essay + Interview",
    units: [
      {
        unit: "International Relations",
        topics: [
          {
            topic: "India's Neighborhood and Strategic Partnerships",
            notes: [
              "Neighborhood policy combines security, connectivity, trade and development cooperation.",
              "Major partnerships should be assessed through strategic autonomy lens.",
              "UPSC expects issue-wise analysis, not only event description."
            ]
          },
          {
            topic: "Global Institutions and Geopolitics",
            notes: [
              "UN reforms, WTO disputes, climate negotiations and supply chains shape India's policy options.",
              "Multipolarity and minilateral groupings influence diplomacy.",
              "Use recent examples with continuity of long-term strategic interests."
            ]
          }
        ]
      },
      {
        unit: "Contemporary Policy Issues",
        topics: [
          {
            topic: "Social Sector and Welfare Delivery",
            notes: [
              "Themes: health, education, nutrition, skilling, and social protection architecture.",
              "Delivery quality depends on state capacity, data quality, and last-mile institutions.",
              "Frame answers with outcomes, inclusion gaps, and governance reforms."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Ethics, Integrity and Aptitude",
    examFocus: "GS Paper IV",
    units: [
      {
        unit: "Ethical Theory and Public Service Values",
        topics: [
          {
            topic: "Foundational Concepts",
            notes: [
              "Differentiate ethics, morality, values, attitude and aptitude with administrative examples.",
              "Core civil service values: integrity, impartiality, objectivity, compassion, dedication.",
              "Use thinker references only when they strengthen practical argument."
            ]
          },
          {
            topic: "Probity and Accountability",
            notes: [
              "Probity tools include transparency, conflict-of-interest rules, audits and grievance systems.",
              "Ethical governance links institutional design with moral leadership.",
              "Case studies require stakeholder mapping + feasible decision path."
            ]
          }
        ]
      },
      {
        unit: "Case Study Practice Framework",
        topics: [
          {
            topic: "Answer Structure",
            notes: [
              "State facts, identify ethical issues, list stakeholders, provide options, justify final choice.",
              "Include short-term and long-term consequences.",
              "Prioritize legality, public interest and fairness."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Indian Society and Social Justice",
    examFocus: "GS Paper I + GS Paper II",
    units: [
      {
        unit: "Societal Structure and Diversity",
        topics: [
          {
            topic: "Salient Features of Indian Society",
            notes: [
              "Indian society is plural with regional, linguistic, religious and caste-based diversity.",
              "Urbanization, migration and technology are rapidly changing social institutions.",
              "Answers should combine constitutional values with social realities."
            ]
          },
          {
            topic: "Women, Population and Social Empowerment",
            notes: [
              "Examine gender issues through education, health, labor force participation and representation.",
              "Population trends should be linked to demographic dividend, ageing and regional imbalance.",
              "Use scheme + institutional reform + behavioral change in way-forward."
            ]
          }
        ]
      },
      {
        unit: "Welfare and Inclusion",
        topics: [
          {
            topic: "Poverty, Hunger and Human Development",
            notes: [
              "Poverty is multidimensional and should be analyzed with health, education and living standards.",
              "Nutrition and learning outcomes are key to long-term productivity and equity.",
              "UPSC asks policy effectiveness and implementation bottlenecks."
            ]
          },
          {
            topic: "Vulnerable Sections and Social Justice",
            notes: [
              "Focus on SC/ST, minorities, elderly, persons with disabilities and migrant workers.",
              "Legal safeguards need strong delivery systems and local accountability.",
              "Write with rights-based approach and measurable outcomes."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Internal Security and Disaster Management",
    examFocus: "GS Paper III",
    units: [
      {
        unit: "Internal Security",
        topics: [
          {
            topic: "Terrorism, Left Wing Extremism and Border Security",
            notes: [
              "Security strategy should integrate intelligence, policing, development and community trust.",
              "Border management requires technology, infrastructure and inter-agency coordination.",
              "Answers should balance national security with civil liberties and federal cooperation."
            ]
          },
          {
            topic: "Cyber and Information Security",
            notes: [
              "Critical infrastructure protection needs legal, technical and institutional preparedness.",
              "Cyber resilience includes prevention, detection, response and recovery systems.",
              "UPSC questions often test governance architecture more than technical detail."
            ]
          }
        ]
      },
      {
        unit: "Disaster Management",
        topics: [
          {
            topic: "Disaster Risk Reduction Framework",
            notes: [
              "Shift from relief-centric model to preparedness and resilience building.",
              "Risk mapping, early warning systems and local capacity are central to loss reduction.",
              "Use Sendai principles and Indian institutional framework in answers."
            ]
          },
          {
            topic: "Climate-linked and Urban Disasters",
            notes: [
              "Heatwaves, floods and cyclones require region-specific adaptation plans.",
              "Urban disaster risks rise due to poor planning, drainage stress and weak compliance.",
              "Way-forward should include governance reform, finance and citizen participation."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "CSAT Aptitude",
    examFocus: "Prelims Paper II",
    units: [
      {
        unit: "Comprehension and Reasoning",
        topics: [
          {
            topic: "Reading Comprehension",
            notes: [
              "Practice inference, tone, argument mapping and elimination-based answering.",
              "Time management is critical: short passages first, difficult passages later.",
              "Avoid outside knowledge; mark strictly from passage evidence."
            ]
          },
          {
            topic: "Logical and Analytical Reasoning",
            notes: [
              "Core areas: statements-assumptions, syllogism, arrangements and decision making.",
              "Use diagram-based solving for speed and lower error rates.",
              "Revise standard fallacies and conditional logic patterns."
            ]
          }
        ]
      },
      {
        unit: "Numeracy and Data Interpretation",
        topics: [
          {
            topic: "Basic Numeracy",
            notes: [
              "Revise percentages, ratios, averages, time-work, time-speed-distance and number systems.",
              "Prioritize mental math and approximation for efficiency.",
              "Track question selection to avoid time sink problems."
            ]
          },
          {
            topic: "Data Interpretation",
            notes: [
              "Interpret tables, charts and mixed data sets accurately before calculation.",
              "Estimate options first to reduce heavy calculations.",
              "Maintain accuracy because CSAT is qualifying but elimination risk is high."
            ]
          }
        ]
      }
    ]
  },
  {
    subject: "Essay",
    examFocus: "Mains Essay Paper",
    units: [
      {
        unit: "Essay Structure and Flow",
        topics: [
          {
            topic: "Introduction, Body, Conclusion",
            notes: [
              "Use a broad yet relevant introduction with conceptual clarity.",
              "Body should be multi-dimensional: social, economic, political, ethical and technological angles.",
              "Conclusion must be constructive, value-driven and future-oriented."
            ]
          },
          {
            topic: "Argument Quality and Balance",
            notes: [
              "Present clear thesis, support with examples, and include counter-view before synthesis.",
              "Avoid one-sided ideological framing; maintain nuanced civil service tone.",
              "Use constitutional values and practical governance perspective."
            ]
          }
        ]
      },
      {
        unit: "Content Enrichment",
        topics: [
          {
            topic: "Examples, Thinkers and Case References",
            notes: [
              "Use brief examples from policy, history, science and society to support arguments.",
              "Thinker quotes should be minimal and well-integrated, not decorative.",
              "Create reusable themes: ethics, innovation, inclusion, sustainability, governance."
            ]
          }
        ]
      }
    ]
  }
];

const NotesLibrary = () => {
  const navigate = useNavigate();
  const [activeSubject, setActiveSubject] = useState(UPSC_NOTES[0].subject);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  const selectedSubject = UPSC_NOTES.find((s) => s.subject === activeSubject) || UPSC_NOTES[0];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">UPSC Notes</h1>
            <p className="text-muted-foreground">Structured notes by subject, units and subtopics</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="lg:col-span-1 h-fit">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <BookOpen className="h-4 w-4 text-primary" />
                Subjects
              </CardTitle>
              <CardDescription>Complete UPSC coverage</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {UPSC_NOTES.map((subject) => (
                <button
                  key={subject.subject}
                  onClick={() => setActiveSubject(subject.subject)}
                  className={`w-full text-left rounded-lg border px-3 py-2 transition ${
                    activeSubject === subject.subject
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border hover:border-primary/40 hover:bg-muted/50"
                  }`}
                >
                  <p className="text-sm font-medium">{subject.subject}</p>
                  <p className="text-xs text-muted-foreground mt-1">{subject.examFocus}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <CardTitle className="text-xl">{selectedSubject.subject}</CardTitle>
                <Badge variant="secondary">{selectedSubject.examFocus}</Badge>
              </div>
              <CardDescription>Unit-wise structured notes</CardDescription>
            </CardHeader>
            <CardContent>
              <Accordion type="multiple" className="w-full">
                {selectedSubject.units.map((unit, unitIndex) => (
                  <AccordionItem key={`${unit.unit}-${unitIndex}`} value={`unit-${unitIndex}`}>
                    <AccordionTrigger className="text-left text-base">{unit.unit}</AccordionTrigger>
                    <AccordionContent>
                      <div className="space-y-4">
                        {unit.topics.map((topic, topicIndex) => (
                          <div key={`${topic.topic}-${topicIndex}`} className="rounded-lg border bg-muted/20 p-4">
                            <h4 className="font-semibold mb-2">{topic.topic}</h4>
                            <ul className="space-y-2">
                              {topic.notes.map((line, lineIndex) => (
                                <li key={lineIndex} className="text-sm text-muted-foreground leading-relaxed">
                                  {line}
                                </li>
                              ))}
                            </ul>
                          </div>
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
    </div>
  );
};

export default NotesLibrary;
