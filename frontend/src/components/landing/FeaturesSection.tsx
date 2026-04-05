import { motion } from "framer-motion";
import {
  MessageSquare,
  BookOpen,
  Newspaper,
  Calendar,
  PenTool,
  FileText,
  Map,
  Video,
  TrendingUp,
  Brain,
  GraduationCap,
  FileBarChart,
  NotebookPen,
  ClipboardList,
  MessageCircleQuestion,
} from "lucide-react";

const features = [
  {
    icon: MessageSquare,
    title: "AI Mentor Chat",
    description: "24/7 personal mentor powered by AI. Clears doubts instantly, explains any topic with examples and UPSC-oriented notes.",
    color: "from-orange-500 to-red-500",
  },
  {
    icon: BookOpen,
    title: "Prelims Quiz Practice",
    description: "Daily AI-generated MCQs covering all GS subjects with real-time scoring, explanations, and difficulty levels matching UPSC.",
    color: "from-blue-500 to-cyan-500",
  },
  {
    icon: Newspaper,
    title: "AI Current Affairs",
    description: "Daily, weekly, and monthly updates prepared by AI from multiple sources. Saves hours of newspaper reading.",
    color: "from-green-500 to-emerald-500",
  },
  {
    icon: Calendar,
    title: "Smart Study Plan",
    description: "Personalized day-by-day timetable with week and month roadmaps. Integrates revision cycles and adapts to your performance.",
    color: "from-purple-500 to-pink-500",
  },
  {
    icon: PenTool,
    title: "Mains Answer Practice",
    description: "Daily Mains questions with AI evaluation of structure, content, examples, and GS relevancy. Detailed feedback included.",
    color: "from-yellow-500 to-orange-500",
  },
  {
    icon: FileText,
    title: "Notes Library",
    description: "Create unlimited notes organized by subjects. Tired of screens? Listen to your notes with text-to-speech.",
    color: "from-teal-500 to-green-500",
  },
  {
    icon: NotebookPen,
    title: "UPSC Smart Notes",
    description: "Topic-wise AI slide notes with checkpoints, revision flow, and practice prompts for faster exam-ready preparation.",
    color: "from-lime-500 to-emerald-500",
  },
  {
    icon: Map,
    title: "Maps Practice",
    description: "Interactive India and World maps with AI-powered location-based questions. Perfect for Geography and IR.",
    color: "from-indigo-500 to-blue-500",
  },
  {
    icon: Video,
    title: "AI Mock Interview",
    description: "Simulates real UPSC Personality Test. AI analyzes body language, communication, confidence, and content quality.",
    color: "from-rose-500 to-pink-500",
  },
  {
    icon: TrendingUp,
    title: "PYQ Analysis Engine",
    description: "AI analyzes 40 years of UPSC papers. Shows topic-wise frequency, trends, predictions, and must-study chapters.",
    color: "from-amber-500 to-yellow-500",
  },
  {
    icon: Brain,
    title: "Mind Map Generator",
    description: "Enter any topic and AI generates a complete mind map. Perfect for last-minute revision, saves 80% time.",
    color: "from-violet-500 to-purple-500",
  },
  {
    icon: GraduationCap,
    title: "Optional Professor",
    description: "Specialized AI mentor for each optional subject. Covers all optionals with diagrams, case laws, and predictions.",
    color: "from-cyan-500 to-teal-500",
  },
  {
    icon: FileBarChart,
    title: "Daily Intel Report",
    description: "5-minute crisp briefing like an IAS officer's daily file. Major events classified by GS Paper with MCQs.",
    color: "from-pink-500 to-rose-500",
  },
  {
    icon: ClipboardList,
    title: "Weekly Test Series",
    description: "Prelims weekly test series with score analysis, per-test leaderboard, and exam-style practice flow.",
    color: "from-sky-500 to-indigo-500",
  },
  {
    icon: MessageCircleQuestion,
    title: "UPSC Doubt Feed",
    description: "Ask UPSC doubts publicly, get peer answers, mark best answer, and learn collaboratively with focused moderation.",
    color: "from-emerald-500 to-teal-500",
  },
];

const container = {
  hidden: { opacity: 0 },
  show: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const item = {
  hidden: { opacity: 0, y: 30 },
  show: { opacity: 1, y: 0 },
};

const FeaturesSection = () => {
  return (
    <section id="features" className="py-24 bg-gradient-to-b from-background to-secondary/20">
      <div className="container mx-auto px-4">
        {/* Section Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="text-center mb-16"
        >
          <span className="inline-block px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-4">
            Powerful Features
          </span>
          <h2 className="text-3xl md:text-5xl font-bold mb-4">
            Everything You Need to{" "}
            <span className="bg-gradient-to-r from-primary to-orange-400 bg-clip-text text-transparent">
              Crack UPSC
            </span>
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            AI-powered tools designed specifically for UPSC aspirants. From preparation to interview, we've got you covered.
          </p>
        </motion.div>

        {/* Features Grid */}
        <motion.div
          variants={container}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6"
        >
          {features.map((feature, index) => (
            <motion.div
              key={index}
              variants={item}
              whileHover={{ y: -8, scale: 1.02 }}
              transition={{ type: "spring", stiffness: 300 }}
              className="group relative p-6 rounded-2xl bg-card border border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300"
            >
              {/* Icon */}
              <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${feature.color} mb-4`}>
                <feature.icon className="w-6 h-6 text-white" />
              </div>

              {/* Content */}
              <h3 className="text-lg font-semibold mb-2 group-hover:text-primary transition-colors">
                {feature.title}
              </h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                {feature.description}
              </p>

              {/* Hover gradient overlay */}
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none" />
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default FeaturesSection;
