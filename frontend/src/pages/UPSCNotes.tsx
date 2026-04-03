import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

type TopicNote = {
  title: string;
  notes: string[];
  prelimsFocus: string[];
  mainsFocus: string[];
};

type Chapter = {
  id: string;
  title: string;
  weight: string;
  topics: TopicNote[];
};

const HISTORY_NOTES: Chapter[] = [
  {
    id: "india-18th-century",
    title: "India in the Mid-18th Century",
    weight: "Foundation",
    topics: [
      {
        title: "Political Condition and Regional States",
        notes: [
          "Mughal decline created political fragmentation and rise of successor states like Awadh, Bengal and Hyderabad.",
          "Marathas, Sikhs, Jats and Mysore emerged as major regional powers with distinct military-administrative structures.",
          "Political instability and competing alliances opened space for European commercial-political intervention.",
        ],
        prelimsFocus: ["Successor states after Mughals", "Regional power centers"],
        mainsFocus: ["How 18th-century fragmentation facilitated colonial expansion"],
      },
      {
        title: "Economic and Social Conditions",
        notes: [
          "India retained significant artisanal and agrarian productivity but was vulnerable to political-military disruptions.",
          "Revenue extraction pressures and local warfare affected peasantry and merchant networks.",
          "European companies initially entered as traders but gradually transformed into territorial powers.",
        ],
        prelimsFocus: ["Nature of economy before colonial dominance"],
        mainsFocus: ["Continuity and change between pre-colonial and colonial economy"],
      },
    ],
  },
  {
    id: "advent-europeans",
    title: "Advent of Europeans and British Expansion",
    weight: "Foundation",
    topics: [
      {
        title: "Portuguese, Dutch, English and French",
        notes: [
          "Portuguese were first Europeans to establish a maritime empire in India after Vasco da Gama arrived in 1498.",
          "Dutch focused mainly on spice trade and could not build durable political control in India.",
          "English East India Company gained long-term dominance through trade privileges, diplomacy and military victories.",
          "French under Dupleix challenged English interests but lost strategic contests in Carnatic conflicts.",
        ],
        prelimsFocus: ["Year of Battle of Wandiwash", "Key trading centers of European powers"],
        mainsFocus: ["Why English succeeded over French", "Economic and naval factors in colonial dominance"],
      },
      {
        title: "British Conquest: Bengal to Pan-India",
        notes: [
          "Battle of Plassey (1757) and Buxar (1764) enabled Company control over Bengal revenues.",
          "Subsidiary Alliance and Doctrine of Lapse expanded British political authority over princely states.",
          "Military reforms and superior logistics helped British retain strategic advantage in multiple regional wars.",
        ],
        prelimsFocus: ["Plassey and Buxar significance", "Doctrine of Lapse states annexed"],
        mainsFocus: ["Colonial state formation in India", "Role of diplomacy and coercion in expansion"],
      },
    ],
  },
  {
    id: "anglo-regional-wars",
    title: "Anglo-Regional Wars and Consolidation",
    weight: "High",
    topics: [
      {
        title: "Mysore, Maratha and Sikh Wars",
        notes: [
          "Anglo-Mysore conflicts under Haider Ali and Tipu Sultan were key resistance phases against British expansion.",
          "Anglo-Maratha wars ended Maratha confederacy's central political role and strengthened Company supremacy.",
          "Anglo-Sikh wars brought Punjab under British control, completing major territorial consolidation.",
        ],
        prelimsFocus: ["Treaties and outcomes of Anglo wars"],
        mainsFocus: ["Patterns of British military-diplomatic strategy"],
      },
      {
        title: "Doctrine of Lapse and Paramountcy",
        notes: [
          "Doctrine of Lapse enabled annexation of states without natural heirs, generating deep resentment.",
          "Subsidiary alliance and resident system undermined sovereignty of princely states.",
          "British paramountcy redefined state relations in favor of imperial centralization.",
        ],
        prelimsFocus: ["States annexed under Doctrine of Lapse"],
        mainsFocus: ["Political impact on princely India"],
      },
    ],
  },
  {
    id: "economic-impact",
    title: "Economic Impact of British Rule",
    weight: "Very High",
    topics: [
      {
        title: "Land Revenue Systems",
        notes: [
          "Permanent Settlement created a zamindari class with fixed revenue demand but weak peasant protection.",
          "Ryotwari and Mahalwari systems imposed heavy assessments causing indebtedness and agrarian distress.",
          "Commercialization of agriculture increased cash crop dependence and vulnerability to price shocks.",
        ],
        prelimsFocus: ["Features of Permanent, Ryotwari, Mahalwari"],
        mainsFocus: ["Colonial agrarian structure and rural poverty", "Peasant response and resistance"],
      },
      {
        title: "Drain of Wealth and Deindustrialization",
        notes: [
          "Dadabhai Naoroji's drain theory highlighted unrequited exports and transfer of Indian surplus to Britain.",
          "Traditional handicrafts declined due to imports of machine-made British goods and discriminatory policies.",
          "Railways and infrastructure primarily served colonial extraction, not balanced indigenous development.",
        ],
        prelimsFocus: ["Drain theory proponents", "Key effects of deindustrialization"],
        mainsFocus: ["Colonial political economy", "Long-term developmental distortions"],
      },
    ],
  },
  {
    id: "administrative-policies",
    title: "Administrative and Legal Changes",
    weight: "High",
    topics: [
      {
        title: "Civil Services, Police and Judiciary",
        notes: [
          "A centralized bureaucratic apparatus with ICS at its core ensured tighter imperial governance.",
          "Police and judicial systems were expanded to enforce order and protect colonial interests.",
          "Legal codification modernized institutions but remained socially distant and expensive for common people.",
        ],
        prelimsFocus: ["Institutional features of colonial administration"],
        mainsFocus: ["Colonial state capacity vs democratic legitimacy"],
      },
      {
        title: "Education and Press Policies",
        notes: [
          "English education created a modern educated class that later became nucleus of nationalism.",
          "Vernacular and English press expanded public debate despite repeated censorship measures.",
          "Education policy had both imperial objectives and unintended emancipatory outcomes.",
        ],
        prelimsFocus: ["Important education commissions and acts"],
        mainsFocus: ["Role of education and press in nation-building"],
      },
    ],
  },
  {
    id: "revolt-1857",
    title: "Revolt of 1857",
    weight: "Very High",
    topics: [
      {
        title: "Causes and Nature",
        notes: [
          "The revolt had political, economic, social, religious and military grievances accumulated over decades.",
          "Immediate trigger was greased cartridge controversy, but deeper causes included annexations and dispossession.",
          "It began as a sepoy mutiny but evolved into a broad anti-colonial uprising in many regions.",
        ],
        prelimsFocus: ["Centers and leaders of 1857", "Immediate causes vs structural causes"],
        mainsFocus: ["Nature debate: mutiny vs first war of independence", "Regional variations"],
      },
      {
        title: "Failure and Consequences",
        notes: [
          "Lack of unified command, limited coordination, and uneven participation contributed to failure.",
          "After suppression, Crown took direct control through Government of India Act, 1858.",
          "British reorganized army, adopted cautious social policies and strengthened divide-and-rule tactics.",
        ],
        prelimsFocus: ["Post-1857 administrative changes"],
        mainsFocus: ["Legacy of 1857 for later nationalism"],
      },
    ],
  },
  {
    id: "post-1857-crown-rule",
    title: "Post-1857 Crown Rule and Policy Shift",
    weight: "High",
    topics: [
      {
        title: "Government of India Act 1858 and Queen's Proclamation",
        notes: [
          "Transfer of power from Company to Crown marked a major constitutional shift in governance.",
          "Queen's Proclamation promised non-interference in religion and equal legal treatment, though practice varied.",
          "Policy became more cautious and conservative with stronger surveillance and military reorganization.",
        ],
        prelimsFocus: ["Key provisions of 1858 settlement"],
        mainsFocus: ["How 1857 reshaped imperial governance"],
      },
      {
        title: "Army Reorganization and Divide-and-Rule",
        notes: [
          "British changed recruitment patterns to reduce possibility of unified military rebellion.",
          "Communal, caste and regional distinctions were politically exploited to weaken collective resistance.",
          "Administrative centralization and intelligence networks strengthened colonial resilience.",
        ],
        prelimsFocus: ["Changes in army structure after 1857"],
        mainsFocus: ["Political sociology of divide-and-rule"],
      },
    ],
  },
  {
    id: "socio-religious",
    title: "Socio-Religious Reform Movements",
    weight: "High",
    topics: [
      {
        title: "Reform in Hindu Society",
        notes: [
          "Brahmo Samaj emphasized monotheism, social reform and critique of ritualism.",
          "Arya Samaj advocated Vedic revival, education and social reform including shuddhi movement.",
          "Prarthana Samaj and Ramakrishna Mission contributed to ethical reform and social service.",
        ],
        prelimsFocus: ["Founders and core ideas of reform organizations"],
        mainsFocus: ["Reform and emergence of modern public sphere"],
      },
      {
        title: "Muslim and Other Community Reform",
        notes: [
          "Aligarh movement under Sir Syed Ahmad Khan promoted modern scientific education among Muslims.",
          "Deoband movement represented an alternative religious reform and educational stream.",
          "Parsi and Sikh reform efforts reflected broader churning toward modern associational life.",
        ],
        prelimsFocus: ["Aligarh vs Deoband orientation"],
        mainsFocus: ["Reform movements and social modernization"],
      },
    ],
  },
  {
    id: "caste-women-reforms",
    title: "Caste, Women and Social Justice Questions",
    weight: "High",
    topics: [
      {
        title: "Anti-Caste Reform and New Social Thought",
        notes: [
          "Jyotiba Phule and later anti-caste leaders challenged Brahmanical hierarchy and demanded social equality.",
          "Movements for education, representation and dignity altered discourse of rights in colonial India.",
          "Social justice struggles widened the meaning of nationalism beyond political transfer of power.",
        ],
        prelimsFocus: ["Key anti-caste reformers and organizations"],
        mainsFocus: ["Social reform and democratization of nationalism"],
      },
      {
        title: "Women's Reform and Participation",
        notes: [
          "Debates on sati, widow remarriage, female education and age of consent marked reform-era transitions.",
          "Women's organizations gradually moved from social reform to political mobilization.",
          "Freedom struggle created new public roles for women across regions and classes.",
        ],
        prelimsFocus: ["Important acts and women reform leaders"],
        mainsFocus: ["Gender dimension of modern Indian history"],
      },
    ],
  },
  {
    id: "peasants-tribal",
    title: "Peasant, Tribal and Civil Resistance",
    weight: "Very High",
    topics: [
      {
        title: "Peasant Movements",
        notes: [
          "Indigo revolt, Deccan riots and later Kisan struggles reflected agrarian oppression under colonial revenue systems.",
          "Local grievances often evolved into organized political demands with nationalist linkage.",
          "Peasant politics became central to mass mobilization in Gandhian and socialist phases.",
        ],
        prelimsFocus: ["Major peasant movements and regions"],
        mainsFocus: ["Class, agrarian structure and anti-colonial politics"],
      },
      {
        title: "Tribal Uprisings",
        notes: [
          "Santhal, Munda and other tribal rebellions opposed forest restrictions, land alienation and exploitative intermediaries.",
          "These movements were rooted in both material deprivation and cultural-political assertion.",
          "Tribal resistance highlighted limits of colonial development narrative.",
        ],
        prelimsFocus: ["Leaders like Birsa Munda and key uprisings"],
        mainsFocus: ["Distinctive features of tribal resistance"],
      },
    ],
  },
  {
    id: "nationalism-rise",
    title: "Rise of Nationalism and Early Congress",
    weight: "Very High",
    topics: [
      {
        title: "Factors Behind Nationalism",
        notes: [
          "Modern education, press, transport and common colonial grievances helped growth of national consciousness.",
          "Economic critique of colonialism united educated Indians across regions.",
          "Indian National Congress (1885) emerged as a platform for constitutional political articulation.",
        ],
        prelimsFocus: ["Congress sessions and key resolutions"],
        mainsFocus: ["Social base of early nationalism", "Role of moderate politics"],
      },
      {
        title: "Moderate Phase",
        notes: [
          "Moderates used petitions, resolutions and constitutional methods to seek incremental reforms.",
          "They developed foundational economic and political critiques against colonial rule.",
          "Limitations included narrow social base and faith in British liberalism.",
        ],
        prelimsFocus: ["Moderate leaders and demands"],
        mainsFocus: ["Historical contribution and limitations of moderates"],
      },
    ],
  },
  {
    id: "partition-bengal-swadeshi",
    title: "Partition of Bengal and Swadeshi Phase",
    weight: "Very High",
    topics: [
      {
        title: "Boycott, Swadeshi and National Education",
        notes: [
          "Swadeshi transformed nationalism into participatory politics through boycott and indigenous alternatives.",
          "Students, women and urban middle classes became active agents of nationalist politics.",
          "Movement produced durable practices of public mobilization and political communication.",
        ],
        prelimsFocus: ["Methods and leaders of Swadeshi movement"],
        mainsFocus: ["Mass politics before Gandhi"],
      },
      {
        title: "Surat Split and Ideological Contest",
        notes: [
          "Differences over pace, methods and leadership style culminated in split between moderates and extremists.",
          "Despite split, both streams contributed to broadening anti-colonial imagination.",
          "Reunification pressures later reshaped organizational priorities.",
        ],
        prelimsFocus: ["Year and context of Surat split"],
        mainsFocus: ["Strategic debate in nationalist movement"],
      },
    ],
  },
  {
    id: "extremists-swadeshi",
    title: "Extremists, Swadeshi and Revolutionary Trends",
    weight: "Very High",
    topics: [
      {
        title: "Partition of Bengal and Swadeshi",
        notes: [
          "Partition of Bengal (1905) triggered mass protest, boycott and swadeshi mobilization.",
          "National education, indigenous enterprise and public participation expanded political consciousness.",
          "Surat split (1907) reflected ideological and strategic differences within Congress.",
        ],
        prelimsFocus: ["Timeline: Bengal partition, annulment, Surat split"],
        mainsFocus: ["Mass mobilization techniques in Swadeshi phase"],
      },
      {
        title: "Revolutionary Nationalism",
        notes: [
          "Revolutionary groups in Bengal, Maharashtra and Punjab used secret societies and militant methods.",
          "Ghadar movement and expatriate networks internationalized anti-colonial activism.",
          "Though limited organizationally, these strands intensified pressure on colonial authority.",
        ],
        prelimsFocus: ["Important revolutionary organizations and leaders"],
        mainsFocus: ["Impact of revolutionary methods on freedom struggle"],
      },
    ],
  },
  {
    id: "home-rule-lucknow",
    title: "Home Rule Movement and Lucknow Pact",
    weight: "High",
    topics: [
      {
        title: "Home Rule Leagues",
        notes: [
          "Tilak and Annie Besant popularized the demand for self-government through decentralized political campaigns.",
          "Home Rule restored nationalist momentum after periods of repression and internal division.",
          "It prepared organizational and psychological ground for later mass movements.",
        ],
        prelimsFocus: ["Leaders and geography of Home Rule leagues"],
        mainsFocus: ["Transition from elite politics to wider agitation"],
      },
      {
        title: "Lucknow Pact (1916)",
        notes: [
          "Congress-League rapprochement represented temporary convergence of anti-colonial constitutional demands.",
          "Separate electorates were accepted as tactical compromise, later shaping communal politics.",
          "Pact reflected both strategic unity and structural contradictions.",
        ],
        prelimsFocus: ["Terms and significance of Lucknow Pact"],
        mainsFocus: ["Unity, compromise and long-term consequences"],
      },
    ],
  },
  {
    id: "gandhian-era",
    title: "Gandhian Mass Movements",
    weight: "Very High",
    topics: [
      {
        title: "Champaran to Non-Cooperation",
        notes: [
          "Gandhi introduced satyagraha through local struggles like Champaran, Kheda and Ahmedabad.",
          "Non-Cooperation Movement linked Khilafat and nationalist politics, widening mass base.",
          "Withdrawal after Chauri Chaura showed strategic primacy of disciplined non-violence.",
        ],
        prelimsFocus: ["Chronology of early Gandhian campaigns"],
        mainsFocus: ["Transformation from elite to mass nationalism"],
      },
      {
        title: "Civil Disobedience and Quit India",
        notes: [
          "Salt Satyagraha symbolized direct challenge to colonial legitimacy through everyday economic issues.",
          "Civil Disobedience created nationwide participation despite repression and compromise phases.",
          "Quit India Movement (1942) signaled final mass upsurge with decentralized resistance.",
        ],
        prelimsFocus: ["Gandhi-Irwin Pact and Round Table Conferences"],
        mainsFocus: ["Comparative assessment of Gandhian movements"],
      },
    ],
  },
  {
    id: "left-streams",
    title: "Left, Socialist and Workers' Politics",
    weight: "High",
    topics: [
      {
        title: "Labor and Trade Union Movements",
        notes: [
          "Industrial labor mobilization developed around wage, rights and anti-colonial demands.",
          "AITUC and related platforms connected class questions with nationalist politics.",
          "Worker activism challenged colonial capital and enriched democratic politics.",
        ],
        prelimsFocus: ["AITUC and early labor leadership"],
        mainsFocus: ["Class politics within freedom struggle"],
      },
      {
        title: "Congress Socialists and Left Influence",
        notes: [
          "Socialist currents pushed issues of inequality, planning and peasant-worker rights into national agenda.",
          "Left groups shaped ideological debates on post-colonial state and economy.",
          "Their interventions influenced developmental visions after independence.",
        ],
        prelimsFocus: ["Congress Socialist Party basics"],
        mainsFocus: ["Role of left thought in anti-colonial discourse"],
      },
    ],
  },
  {
    id: "constitutional-developments",
    title: "Constitutional Developments (1909–1947)",
    weight: "Very High",
    topics: [
      {
        title: "Morley-Minto to Government of India Act 1935",
        notes: [
          "1909 reforms introduced limited representation and separate electorates, deepening communal politics.",
          "1919 Act brought dyarchy in provinces and partial institutional expansion.",
          "1935 Act introduced provincial autonomy and federal provisions, becoming constitutional precursor.",
        ],
        prelimsFocus: ["Major provisions of 1909, 1919, 1935 Acts"],
        mainsFocus: ["Colonial constitutionalism and political strategy"],
      },
      {
        title: "Towards Independence",
        notes: [
          "Cripps Mission, Wavell Plan and Cabinet Mission reflected wartime and post-war transition pressures.",
          "INA trials, naval mutiny and labor unrest weakened colonial confidence.",
          "Mountbatten Plan culminated in partition and transfer of power in 1947.",
        ],
        prelimsFocus: ["Cabinet Mission and Mountbatten timeline"],
        mainsFocus: ["Interplay of mass struggle and constitutional negotiation"],
      },
    ],
  },
  {
    id: "communal-politics",
    title: "Communal Politics and Partition",
    weight: "Very High",
    topics: [
      {
        title: "Growth of Communalism",
        notes: [
          "Colonial electoral design, social anxieties and elite competition fostered communal political identities.",
          "Communal representation often overshadowed shared anti-colonial platforms in late colonial years.",
          "Political deadlock deepened during constitutional negotiations of the 1940s.",
        ],
        prelimsFocus: ["Separate electorates and communal award context"],
        mainsFocus: ["Colonial policy and internal factors in communalism"],
      },
      {
        title: "Partition and Human Consequences",
        notes: [
          "Partition emerged through political impasse, hurried transfer timeline and competing national projects.",
          "Mass displacement and violence produced one of the largest humanitarian crises in modern history.",
          "Partition legacy continues to influence subcontinental politics and memory.",
        ],
        prelimsFocus: ["Timeline of partition decisions"],
        mainsFocus: ["Historical interpretation of partition"],
      },
    ],
  },
  {
    id: "independence-final-phase",
    title: "Final Phase: INA, Naval Mutiny and Transfer of Power",
    weight: "Very High",
    topics: [
      {
        title: "INA and Public Mobilization",
        notes: [
          "INA campaigns and subsequent trials generated widespread nationalist sympathy across regions.",
          "Trials helped unify public opinion against colonial authority.",
          "Symbolic and political impact exceeded military outcomes.",
        ],
        prelimsFocus: ["INA leadership and trial significance"],
        mainsFocus: ["INA impact on British exit calculus"],
      },
      {
        title: "Royal Indian Navy Mutiny and 1947 Transition",
        notes: [
          "RIN mutiny signaled discontent within armed forces and weakened confidence in coercive control.",
          "Post-war economic strain and global anti-colonial currents accelerated British withdrawal.",
          "Indian Independence Act 1947 formalized transfer of power and partition.",
        ],
        prelimsFocus: ["RIN mutiny chronology", "Indian Independence Act provisions"],
        mainsFocus: ["Multiple pressures behind British withdrawal"],
      },
    ],
  },
  {
    id: "revision-toolkit",
    title: "Revision Toolkit: Timelines, Sessions and Personalities",
    weight: "Exam Booster",
    topics: [
      {
        title: "Chronology and Congress Sessions",
        notes: [
          "Prepare timeline grids: 1757, 1764, 1857, 1885, 1905, 1919, 1920, 1930, 1942, 1947 as anchor years.",
          "Map major Congress sessions with resolutions and movement phases for quick elimination in prelims.",
          "Use one-page revision charts for acts, committees, pacts and missions.",
        ],
        prelimsFocus: ["Session-president matching", "Movement-year mapping"],
        mainsFocus: ["Using chronology to structure analytical answers"],
      },
      {
        title: "Key Leaders and Contribution Matrix",
        notes: [
          "Revise leaders by ideological strand: moderate, extremist, Gandhian, revolutionary, socialist.",
          "Link each leader with specific movement, strategy and historical impact.",
          "Use comparative notes to avoid factual overlap and improve answer precision.",
        ],
        prelimsFocus: ["Leader-organization matching"],
        mainsFocus: ["Balanced evaluation of leadership streams"],
      },
    ],
  },
];

const UPSCNotes = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState("");

  const filteredChapters = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return HISTORY_NOTES;
    return HISTORY_NOTES
      .map((chapter) => ({
        ...chapter,
        topics: chapter.topics.filter(
          (topic) =>
            chapter.title.toLowerCase().includes(q) ||
            topic.title.toLowerCase().includes(q) ||
            topic.notes.some((n) => n.toLowerCase().includes(q)),
        ),
      }))
      .filter((chapter) => chapter.topics.length > 0);
  }, [search]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-6xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">UPSC History Notes</h1>
            <p className="text-sm text-muted-foreground">Static book-style notes format (no AI/chatbot).</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Modern History Notes</CardTitle>
            <CardDescription>Chapter-wise revision notes for quick study and answer writing.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search chapter, topic, or key term..."
              />
            </div>
          </CardContent>
        </Card>

        <div className="space-y-5">
          {filteredChapters.map((chapter) => (
            <Card key={chapter.id} className="border-primary/20">
              <CardHeader>
                <div className="flex items-center justify-between gap-2">
                  <CardTitle className="text-xl">{chapter.title}</CardTitle>
                  <Badge variant="secondary">{chapter.weight}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {chapter.topics.map((topic) => (
                  <Card key={`${chapter.id}-${topic.title}`} className="border-border/60">
                    <CardHeader className="pb-2">
                      <CardTitle className="text-base">{topic.title}</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      <ul className="space-y-2 text-sm text-muted-foreground">
                        {topic.notes.map((n, i) => <li key={`${topic.title}-n-${i}`}>{i + 1}. {n}</li>)}
                      </ul>
                      <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold text-primary mb-2">Prelims Focus</p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {topic.prelimsFocus.map((p, i) => <li key={`${topic.title}-p-${i}`}>- {p}</li>)}
                          </ul>
                        </div>
                        <div className="rounded-md border p-3">
                          <p className="text-xs font-semibold text-primary mb-2">Mains Focus</p>
                          <ul className="space-y-1 text-xs text-muted-foreground">
                            {topic.mainsFocus.map((m, i) => <li key={`${topic.title}-m-${i}`}>- {m}</li>)}
                          </ul>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </Card>
          ))}
          {filteredChapters.length === 0 && (
            <Card><CardContent className="py-8 text-center text-sm text-muted-foreground">No notes matched your search.</CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default UPSCNotes;
