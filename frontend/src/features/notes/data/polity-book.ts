import { Chapter } from "../types";

export const POLITY_NOTES: Chapter[] = [
  {
    id: "polity-constitutional-framework",
    title: "Constitutional Framework",
    weight: "Very High",
    topics: [
      {
        title: "Historical Background and Making of the Constitution",
        notes: [
          "Constitution emerged from colonial constitutional evolution: Regulating Act 1773 to Government of India Act 1935.",
          "Constituent Assembly (1946-1949) prepared a detailed written constitution balancing rights, governance, and diversity.",
          "Objectives Resolution shaped constitutional philosophy of justice, liberty, equality, and fraternity.",
        ],
        prelimsFocus: ["Constituent Assembly committees", "Sources of the Constitution"],
        mainsFocus: ["How historical context shaped constitutional design"],
      },
      {
        title: "Preamble, Features, Rights, DPSP, Duties and Amendment",
        notes: [
          "Preamble reflects constitutional vision and basic philosophy of the Republic.",
          "Fundamental Rights protect liberty; DPSP guide state policy; Fundamental Duties reinforce civic responsibility.",
          "Amendment procedure (Article 368) allows change but Basic Structure limits destructive constitutional alteration.",
        ],
        prelimsFocus: ["Articles on rights and duties", "Amendment types"],
        mainsFocus: ["Balance between flexibility and constitutional supremacy"],
      },
    ],
  },
  {
    id: "polity-system-of-government",
    title: "System of Government",
    weight: "Very High",
    topics: [
      {
        title: "Parliamentary, Federal and Centre-State Architecture",
        notes: [
          "India follows parliamentary government with executive accountability to legislature.",
          "Federal structure has unitary tilt with strong Union powers in national interest.",
          "Seventh Schedule and constitutional institutions regulate legislative and administrative relations.",
        ],
        prelimsFocus: ["Union, State, Concurrent lists", "Parliamentary features"],
        mainsFocus: ["Nature of Indian federalism: cooperative vs competitive dimensions"],
      },
      {
        title: "Inter-State Relations and Emergency Provisions",
        notes: [
          "Inter-State Council, Finance Commission, and tribunals support coordination across units.",
          "Emergency provisions alter federal balance during security, constitutional, or financial crises.",
          "Judicial review acts as safeguard against misuse of emergency powers.",
        ],
        prelimsFocus: ["Articles on National, State, Financial emergency"],
        mainsFocus: ["Federal implications of emergency framework"],
      },
    ],
  },
  {
    id: "polity-central-government",
    title: "Central Government",
    weight: "Very High",
    topics: [
      {
        title: "President, Vice-President, PM and Council of Ministers",
        notes: [
          "President is constitutional head; real executive power lies with PM and Council under parliamentary conventions.",
          "Cabinet is core decision-making body driving policy and governance coordination.",
          "Collective responsibility to Lok Sabha is central to democratic accountability.",
        ],
        prelimsFocus: ["Election and powers of President", "Cabinet responsibility"],
        mainsFocus: ["Constitutional head vs real executive dynamics"],
      },
      {
        title: "Parliament, Committees and Constitutional Law Officers",
        notes: [
          "Parliament legislates, controls executive, approves finances, and represents democratic debate.",
          "Committee system improves scrutiny of bills, budgets, and departmental performance.",
          "Attorney General advises Union on legal-constitutional matters.",
        ],
        prelimsFocus: ["Money bill vs financial bill", "Parliamentary committee types"],
        mainsFocus: ["Declining deliberation and committee reform needs"],
      },
    ],
  },
  {
    id: "polity-state-government",
    title: "State Government",
    weight: "High",
    topics: [
      {
        title: "Governor, Chief Minister and State Council of Ministers",
        notes: [
          "Governor is constitutional head in states; CM and council hold real executive authority.",
          "Discretionary powers of Governor remain a major constitutional debate area.",
          "State executive functions within federal-constitutional boundaries and judicial review.",
        ],
        prelimsFocus: ["Governor appointment and tenure", "CM powers"],
        mainsFocus: ["Governor role in coalition and hung assembly scenarios"],
      },
      {
        title: "State Legislature, High Court and Subordinate Judiciary",
        notes: [
          "State legislature performs lawmaking, finance approval, and executive oversight.",
          "High Courts protect constitutional rights and supervise subordinate courts.",
          "Judicial independence at state level is essential for rule of law.",
        ],
        prelimsFocus: ["Legislative councils", "Writ jurisdiction of High Courts"],
        mainsFocus: ["Judicial federalism and access to justice"],
      },
    ],
  },
  {
    id: "polity-local-government",
    title: "Local Government",
    weight: "High",
    topics: [
      {
        title: "Panchayati Raj and Urban Local Bodies",
        notes: [
          "73rd and 74th Amendments constitutionalized decentralization and local self-government.",
          "Gram Sabha and municipal institutions are foundational for grassroots democracy.",
          "Devolution of 3Fs (functions, funds, functionaries) remains uneven across states.",
        ],
        prelimsFocus: ["Eleventh and Twelfth Schedules", "State Finance Commission"],
        mainsFocus: ["Why decentralization outcomes vary across states"],
      },
      {
        title: "Scheduled and Tribal Area Governance",
        notes: [
          "Fifth and Sixth Schedule frameworks provide differentiated governance for tribal regions.",
          "Autonomous councils and protective mechanisms aim to preserve local identity and rights.",
          "Implementation gaps persist in land rights, representation, and resource governance.",
        ],
        prelimsFocus: ["Fifth vs Sixth Schedule features"],
        mainsFocus: ["Tribal self-governance and development balance"],
      },
    ],
  },
  {
    id: "polity-ut-special-areas",
    title: "Union Territories and Special Areas",
    weight: "Medium",
    topics: [
      {
        title: "Union Territories and Special Constitutional Arrangements",
        notes: [
          "Union Territories are directly administered by Union, with varying legislative arrangements.",
          "Special provisions for certain states reflect historical, social, and geographic considerations.",
          "Constitution allows asymmetric federal design where needed.",
        ],
        prelimsFocus: ["UTs with/without legislature", "Special provisions under Article 371 series"],
        mainsFocus: ["Asymmetric federalism in India"],
      },
      {
        title: "Scheduled Areas and Tribal Areas",
        notes: [
          "Protective constitutional design addresses vulnerability of indigenous communities.",
          "Governor and President have special roles in administration of these areas.",
          "Policy challenge is balancing autonomy, rights, and development.",
        ],
        prelimsFocus: ["Administrative control provisions"],
        mainsFocus: ["Rights-based governance in protected areas"],
      },
    ],
  },
  {
    id: "polity-constitutional-bodies",
    title: "Constitutional Bodies",
    weight: "Very High",
    topics: [
      {
        title: "ECI, UPSC, SPSC, Finance Commission, CAG",
        notes: [
          "These bodies ensure constitutional governance, accountability, and institutional stability.",
          "Independence, tenure security, and functional autonomy are key design principles.",
          "Their reports and recommendations shape policy and public administration.",
        ],
        prelimsFocus: ["Composition and tenure details"],
        mainsFocus: ["Institutional autonomy vs executive influence"],
      },
      {
        title: "AGI, Advocate General and National Commissions",
        notes: [
          "Law officers provide legal advice to Union and States in constitutional matters.",
          "Commissions for SC/ST/BC address social justice through monitoring and recommendations.",
          "Effectiveness depends on powers, data systems, and implementation follow-up.",
        ],
        prelimsFocus: ["Constitutional status of commissions"],
        mainsFocus: ["Social justice institutions and governance outcomes"],
      },
    ],
  },
  {
    id: "polity-non-constitutional-bodies",
    title: "Non-Constitutional Bodies",
    weight: "High",
    topics: [
      {
        title: "NITI Aayog, NHRC, SHRC, CIC, CVC",
        notes: [
          "These bodies are statutory/executive institutions supporting governance, rights, and transparency.",
          "They influence policy coordination, grievance redress, and integrity systems.",
          "Mandate overlaps and enforcement limits affect outcomes.",
        ],
        prelimsFocus: ["Statutory basis and mandates"],
        mainsFocus: ["Reform of accountability institutions"],
      },
      {
        title: "CBI, Lokpal-Lokayuktas and Oversight Ecosystem",
        notes: [
          "Anti-corruption and investigative institutions are central to rule-based governance.",
          "Operational autonomy, federal coordination, and legal clarity remain major challenges.",
          "Institutional credibility depends on transparent process and timely outcomes.",
        ],
        prelimsFocus: ["Lokpal Act basics", "CBI legal context"],
        mainsFocus: ["Institutional design for anti-corruption architecture"],
      },
    ],
  },
  {
    id: "polity-other-dimensions",
    title: "Other Constitutional Dimensions",
    weight: "High",
    topics: [
      {
        title: "Official Language, Public Services, Tribunals",
        notes: [
          "Language policy balances national integration with linguistic diversity.",
          "Public services framework shapes bureaucracy, recruitment, and administrative continuity.",
          "Tribunals were introduced for specialized adjudication and faster dispute resolution.",
        ],
        prelimsFocus: ["Language provisions", "CAT and tribunal framework"],
        mainsFocus: ["Tribunalization and judicial independence debate"],
      },
      {
        title: "Rights and Liabilities of Government; Cooperative Societies",
        notes: [
          "Constitution defines legal personality and accountability standards for state action.",
          "Cooperative movement gained constitutional recognition to strengthen grassroots economy.",
          "Implementation quality varies across sectors and states.",
        ],
        prelimsFocus: ["97th Amendment essentials"],
        mainsFocus: ["State liability and administrative accountability"],
      },
    ],
  },
  {
    id: "polity-political-dynamics",
    title: "Political Dynamics",
    weight: "Very High",
    topics: [
      {
        title: "Anti-Defection, Election Laws and Representation",
        notes: [
          "Anti-defection law aims to curb political instability but raises concerns on intra-party democracy.",
          "Election laws regulate candidacy, campaign process, and electoral conduct.",
          "Representation framework shapes legitimacy of democratic outcomes.",
        ],
        prelimsFocus: ["Tenth Schedule", "RPA provisions"],
        mainsFocus: ["Balancing stability and deliberative democracy"],
      },
      {
        title: "Pressure Groups, National Integration and Foreign Policy Linkages",
        notes: [
          "Pressure groups influence policy through negotiation, advocacy, and public mobilization.",
          "National integration requires constitutional values, inclusion, and institutional trust.",
          "Domestic constitutional principles often interact with external policy positions.",
        ],
        prelimsFocus: ["Pressure group types", "Integration-related constitutional tools"],
        mainsFocus: ["Democratic pluralism and state response"],
      },
    ],
  },
  {
    id: "polity-advanced-topics",
    title: "Advanced and Value-Addition Topics",
    weight: "Exam Booster",
    topics: [
      {
        title: "Basic Structure, Doctrines and Landmark Judgments",
        notes: [
          "Judicial doctrines interpret constitutional limits and preserve democratic fundamentals.",
          "Landmark judgments shape rights jurisprudence and institutional balance.",
          "UPSC answers require linking doctrine with contemporary governance questions.",
        ],
        prelimsFocus: ["Kesavananda Bharati and related cases"],
        mainsFocus: ["Judicial review and constitutional morality"],
      },
      {
        title: "Commissions and Institutions for Governance Deepening",
        notes: [
          "Law Commission, Delimitation Commission, NCW, NCPCR, NCM and Consumer Commissions add policy depth.",
          "These institutions expand rights-protection and governance responsiveness.",
          "Use them as value-add examples in GS2 mains answers.",
        ],
        prelimsFocus: ["Mandates of key commissions"],
        mainsFocus: ["Institutional ecosystem and democratic deepening"],
      },
    ],
  },
];
