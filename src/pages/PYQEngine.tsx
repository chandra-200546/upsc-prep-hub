import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/use-gamification";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  BarChart3,
  Brain,
  Calendar,
  ChevronRight,
  Lightbulb,
  LineChart,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Zap,
  BookOpen,
} from "lucide-react";

type ExamType = "prelims" | "mains" | "optional" | "essay";
type AnalysisSection = "trends" | "predictions" | "strategy" | "practice";

interface TrendData {
  subject: string;
  weightage: number;
  trend: "rising" | "stable" | "declining";
  yearsAnalyzed: string;
  keyInsight: string;
}

interface Prediction {
  topic: string;
  probability: "high" | "medium" | "low";
  questionType: string;
  reasoning: string;
}

interface StrategyItem {
  priority: number;
  action: string;
  reason: string;
  timeframe: string;
}

interface PYQQuestion {
  id: string;
  year: number;
  question: string;
  options?: string[];
  correctAnswer?: string;
  explanation?: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
  level?: number;
  wordLimit?: number;
  expectedApproach?: string;
}

interface ScoreSection {
  title: string;
  score: number;
  maxScore: number;
}

const PRELIMS_SUBJECT_OPTIONS = [
  "Indian Economy",
  "Indian Polity",
  "Ancient History",
  "Modern History",
  "Geography",
  "Current Events / General Knowledge",
  "Social Development / Government Schemes",
  "Environment & Ecology",
  "Science & Technology",
];

const normalizeSubject = (subject: string): string => {
  const s = subject.toLowerCase();
  if (s.includes("econom")) return "Indian Economy";
  if (s.includes("polity") || s.includes("governance")) return "Indian Polity";
  if (s.includes("ancient")) return "Ancient History";
  if (s.includes("modern")) return "Modern History";
  if (s.includes("history")) return "Ancient History";
  if (s.includes("geograph")) return "Geography";
  if (s.includes("current") || s.includes("general knowledge") || s.includes("gk")) return "Current Events / General Knowledge";
  if (s.includes("social") || s.includes("scheme") || s.includes("welfare")) return "Social Development / Government Schemes";
  if (s.includes("environment") || s.includes("ecology")) return "Environment & Ecology";
  if (s.includes("science") || s.includes("technology")) return "Science & Technology";
  return subject || "General";
};

const extractTotalMarks = (text: string): number | null => {
  const match = text.match(/Total\s*Marks\s*[:\-]?\s*(\d+)\s*\/\s*(\d+)/i);
  if (!match) return null;
  const score = Number(match[1]);
  return Number.isNaN(score) ? null : score;
};

const SCORE_SECTION_TITLES = [
  "Content Quality",
  "Structure & Organization",
  "Relevance to Question",
  "Use of Examples",
  "Overall Presentation",
];

const cleanFeedbackText = (input: string) =>
  input
    .replace(/\r/g, "")
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/^\s*[-*]\s+/gm, "")
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .trim();

const extractSectionScore = (text: string, sectionTitle: string): ScoreSection | null => {
  const escaped = sectionTitle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*[:\\-]?\\s*\\(?\\s*(\\d+)\\s*\\/\\s*(\\d+)\\s*\\)?`, "i");
  const match = text.match(pattern);
  if (!match) return null;
  const score = Number(match[1]);
  const maxScore = Number(match[2]);
  if (Number.isNaN(score) || Number.isNaN(maxScore)) return null;
  return { title: sectionTitle, score, maxScore };
};

const parseLabeledSection = (text: string, label: string): string => {
  const escaped = label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const pattern = new RegExp(`${escaped}\\s*:?([\\s\\S]*?)(?=\\n\\s*[A-Za-z][A-Za-z &]+\\s*:|$)`, "i");
  const match = text.match(pattern);
  return (match?.[1] || "").trim();
};

const PYQEngine = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { awardXP, XP_REWARDS } = useGamification();

  const [selectedExam, setSelectedExam] = useState<ExamType>("prelims");
  const [activeSection, setActiveSection] = useState<AnalysisSection>("trends");
  const [loading, setLoading] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [strategy, setStrategy] = useState<StrategyItem[]>([]);
  const [pyqQuestions, setPyqQuestions] = useState<PYQQuestion[]>([]);

  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [selectedLevel, setSelectedLevel] = useState<number>(1);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  const [writingQuestionIndex, setWritingQuestionIndex] = useState(0);
  const [writingAnswer, setWritingAnswer] = useState("");
  const [writingFeedback, setWritingFeedback] = useState("");
  const [isEvaluatingWriting, setIsEvaluatingWriting] = useState(false);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    setActiveSection("trends");
    setAnalysisGenerated(false);
    setPyqQuestions([]);
    setSelectedAnswer(null);
    setShowExplanation(false);
    setCurrentQuestionIndex(0);
    setWritingQuestionIndex(0);
    setWritingAnswer("");
    setWritingFeedback("");
  }, [selectedExam]);

  const generateAnalysis = async () => {
    setLoading(true);
    setAnalysisGenerated(false);

    try {
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pyq-analysis`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ examType: selectedExam, analysisType: "full" }),
      });

      if (!response.ok) throw new Error("Failed to generate analysis");

      const data = await response.json();
      const incomingQuestions: PYQQuestion[] = (data.pyqQuestions || []).map((q: any, idx: number) => ({
        id: q.id || `pyq-${idx}`,
        year: Number(q.year) || 2000,
        question: q.question || "",
        options: Array.isArray(q.options) ? q.options.slice(0, 4) : undefined,
        correctAnswer: q.correctAnswer,
        explanation: q.explanation || "",
        subject: selectedExam === "prelims" ? normalizeSubject(q.subject || "General") : (q.subject || "General"),
        difficulty: q.difficulty || "medium",
        level: Number.isInteger(q.level) ? q.level : q.difficulty === "easy" ? 1 : q.difficulty === "hard" ? 4 : 2,
        wordLimit: Number(q.wordLimit) || (selectedExam === "essay" ? 1000 : 250),
        expectedApproach: q.expectedApproach || "",
      }));

      setTrends(data.trends || []);
      setPredictions(data.predictions || []);
      setStrategy(data.strategy || []);
      setPyqQuestions(incomingQuestions);

      if (selectedExam === "prelims") {
        const firstSubject = PRELIMS_SUBJECT_OPTIONS[0];
        setSelectedSubject(firstSubject);
        setSelectedLevel(1);
      }

      setAnalysisGenerated(true);
      setCurrentQuestionIndex(0);
      setWritingQuestionIndex(0);
      setWritingAnswer("");
      setWritingFeedback("");

      toast({
        title: "Analysis Generated!",
        description: `PYQ analysis and practice set for ${selectedExam.toUpperCase()} is ready.`,
      });
    } catch (error) {
      console.error("Error generating analysis:", error);
      toast({
        title: "Error",
        description: "Failed to generate analysis. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const prelimsSubjects = PRELIMS_SUBJECT_OPTIONS;

  const filteredPrelimsQuestions = useMemo(() => {
    return pyqQuestions.filter((q) => {
      const matchSubject = selectedSubject ? q.subject === selectedSubject : true;
      const level = q.level || 1;
      const matchLevel = level === selectedLevel;
      const hasOptions = Array.isArray(q.options) && q.options.length === 4;
      return matchSubject && matchLevel && hasOptions;
    });
  }, [pyqQuestions, selectedSubject, selectedLevel]);

  const effectivePrelimsQuestions = useMemo(() => {
    if (filteredPrelimsQuestions.length > 0) return filteredPrelimsQuestions;

    const sameSubjectAnyLevel = pyqQuestions.filter(
      (q) => q.subject === selectedSubject && Array.isArray(q.options) && q.options.length === 4
    );
    if (sameSubjectAnyLevel.length > 0) return sameSubjectAnyLevel;

    const anySubjectSameLevel = pyqQuestions.filter(
      (q) => (q.level || 1) === selectedLevel && Array.isArray(q.options) && q.options.length === 4
    );
    if (anySubjectSameLevel.length > 0) return anySubjectSameLevel;

    return pyqQuestions.filter((q) => Array.isArray(q.options) && q.options.length === 4);
  }, [filteredPrelimsQuestions, pyqQuestions, selectedLevel, selectedSubject]);

  const descriptiveQuestions = useMemo(
    () => pyqQuestions.filter((q) => !q.options || q.options.length === 0),
    [pyqQuestions]
  );

  const currentPrelimsQuestion = effectivePrelimsQuestions[currentQuestionIndex];
  const currentWritingQuestion = descriptiveQuestions[writingQuestionIndex];
  const writingWordCount = writingAnswer.trim().split(/\s+/).filter(Boolean).length;

  const parsedWritingFeedback = useMemo(() => {
    const cleaned = cleanFeedbackText(writingFeedback);
    const sectionScores = SCORE_SECTION_TITLES
      .map((title) => extractSectionScore(cleaned, title))
      .filter((section): section is ScoreSection => section !== null);
    const totalMatch = cleaned.match(/Total\s*Marks\s*[:\-]?\s*(\d+)\s*\/\s*(\d+)/i);
    return {
      cleaned,
      sectionScores,
      totalScore: totalMatch ? Number(totalMatch[1]) : null,
      totalMax: totalMatch ? Number(totalMatch[2]) : null,
      summary: parseLabeledSection(cleaned, "Overall Summary"),
      strengths: parseLabeledSection(cleaned, "Key Strengths"),
      improvements: parseLabeledSection(cleaned, "Areas for Improvement"),
      suggestions: parseLabeledSection(cleaned, "Specific Suggestions"),
      modelAnswer: parseLabeledSection(cleaned, "Model Answer"),
    };
  }, [writingFeedback]);

  const handleAnswerSelect = async (answer: string) => {
    setSelectedAnswer(answer);
    setShowExplanation(true);
    if (currentPrelimsQuestion && answer === currentPrelimsQuestion.correctAnswer) {
      await awardXP(XP_REWARDS.CORRECT_ANSWER, "PYQ correct answer!");
    }
  };

  const nextPrelimsQuestion = () => {
    if (currentQuestionIndex < effectivePrelimsQuestions.length - 1) {
      setCurrentQuestionIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const evaluateWritingAnswer = async () => {
    if (!currentWritingQuestion || !writingAnswer.trim()) {
      toast({ title: "Answer required", description: "Please write your answer before evaluation.", variant: "destructive" });
      return;
    }

    setIsEvaluatingWriting(true);
    setWritingFeedback("");

    try {
      const evaluationPrompt = `Evaluate this UPSC PYQ answer in a friendly but strict examiner style.

Exam Type: ${selectedExam}
Question (${currentWritingQuestion.year}) [${currentWritingQuestion.subject}]:
${currentWritingQuestion.question}

Expected approach:
${currentWritingQuestion.expectedApproach || "Assess against UPSC standards of structure, relevance, examples, and conclusion."}

Word Limit: ${currentWritingQuestion.wordLimit || 250}
Candidate Answer:
${writingAnswer}

Return plain text only (no markdown symbols) in this template:
Content Quality: X/10
Structure & Organization: X/10
Relevance to Question: X/10
Use of Examples: X/10
Overall Presentation: X/10
Total Marks: X/50
Overall Summary: 2-3 lines
Key Strengths: 2-3 points in one paragraph
Areas for Improvement: 2-3 points in one paragraph
Specific Suggestions: 3-4 actionable suggestions in one paragraph
Model Answer: 150-200 word model answer in simple UPSC language`;

      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: evaluationPrompt }],
          chatType: "mains_evaluation",
        }),
      });

      if (!response.ok) throw new Error("Failed to evaluate answer");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const data = line.slice(6);
            if (data === "[DONE]") continue;
            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                accumulated += content;
                setWritingFeedback(accumulated);
              }
            } catch {
              // Skip invalid chunk
            }
          }
        }
      }

      const totalMarks = extractTotalMarks(accumulated);
      await awardXP(XP_REWARDS.MAINS_SUBMISSION, "PYQ descriptive answer submitted!");
      if (totalMarks !== null && totalMarks >= 30) {
        await awardXP(XP_REWARDS.CORRECT_ANSWER, "Strong PYQ answer quality bonus");
      }

      toast({ title: "Evaluation ready", description: "Your PYQ answer has been evaluated." });
    } catch (error) {
      console.error("Error evaluating answer:", error);
      toast({ title: "Error", description: "Failed to evaluate answer. Please try again.", variant: "destructive" });
    } finally {
      setIsEvaluatingWriting(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising":
        return <TrendingUp className="w-4 h-4 text-success" />;
      case "declining":
        return <TrendingUp className="w-4 h-4 text-destructive rotate-180" />;
      default:
        return <LineChart className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case "high":
        return "bg-success/20 text-success border-success/30";
      case "medium":
        return "bg-warning/20 text-warning border-warning/30";
      default:
        return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              PYQ Breakdown Engine
            </h1>
            <p className="text-xs text-muted-foreground">Trends, Predictions, Strategy, and PYQ Practice</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <Card className="p-6 bg-gradient-card border-0 shadow-sm">
          <h2 className="font-semibold mb-4 flex items-center gap-2">
            <Target className="w-5 h-5 text-primary" />
            Select Exam Type
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(["prelims", "mains", "optional", "essay"] as ExamType[]).map((exam) => (
              <Button
                key={exam}
                variant={selectedExam === exam ? "default" : "outline"}
                className={`capitalize h-14 ${selectedExam === exam ? "bg-gradient-primary" : ""}`}
                onClick={() => setSelectedExam(exam)}
              >
                {exam === "prelims" && <Brain className="w-4 h-4 mr-2" />}
                {exam === "mains" && <BookOpen className="w-4 h-4 mr-2" />}
                {exam === "optional" && <Target className="w-4 h-4 mr-2" />}
                {exam === "essay" && <Lightbulb className="w-4 h-4 mr-2" />}
                {exam}
              </Button>
            ))}
          </div>

          <Button onClick={generateAnalysis} disabled={loading} className="w-full mt-4 bg-gradient-primary h-12">
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing PYQs...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Analysis
              </>
            )}
          </Button>
        </Card>

        {(loading || analysisGenerated) && (
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as AnalysisSection)}>
            <TabsList className="grid grid-cols-4 w-full h-auto p-1">
              <TabsTrigger value="trends" className="text-xs py-2">
                <TrendingUp className="w-3 h-3 mr-1" />
                Trends
              </TabsTrigger>
              <TabsTrigger value="predictions" className="text-xs py-2">
                <Target className="w-3 h-3 mr-1" />
                Predict
              </TabsTrigger>
              <TabsTrigger value="strategy" className="text-xs py-2">
                <Zap className="w-3 h-3 mr-1" />
                Strategy
              </TabsTrigger>
              <TabsTrigger value="practice" className="text-xs py-2">
                <Brain className="w-3 h-3 mr-1" />
                Practice
              </TabsTrigger>
            </TabsList>

            <TabsContent value="trends" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-5 h-5 text-primary" />
                  40-Year Trend Analysis
                </h3>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div key={i} className="flex items-center gap-4">
                        <Skeleton className="h-12 w-full" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {trends.map((trend, index) => (
                      <div key={index} className="p-4 rounded-xl bg-background/50 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="font-medium">{trend.subject}</span>
                          <div className="flex items-center gap-2">
                            {getTrendIcon(trend.trend)}
                            <span
                              className={`text-sm font-semibold ${
                                trend.trend === "rising"
                                  ? "text-success"
                                  : trend.trend === "declining"
                                  ? "text-destructive"
                                  : "text-muted-foreground"
                              }`}
                            >
                              {trend.weightage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div
                            className={`h-full rounded-full transition-all ${
                              trend.trend === "rising"
                                ? "bg-success"
                                : trend.trend === "declining"
                                ? "bg-destructive"
                                : "bg-primary"
                            }`}
                            style={{ width: `${Math.min(trend.weightage, 100)}%` }}
                          />
                        </div>
                        <p className="text-xs text-muted-foreground">{trend.keyInsight}</p>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="predictions" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-primary" />
                  AI Predictions for Next Attempt
                </h3>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-24 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {predictions.map((pred, index) => (
                      <div key={index} className="p-4 rounded-xl bg-background/50 border border-border/50">
                        <div className="flex items-start justify-between mb-2">
                          <span className="font-medium">{pred.topic}</span>
                          <span className={`text-xs px-2 py-1 rounded-full border ${getProbabilityColor(pred.probability)}`}>
                            {pred.probability.toUpperCase()} chance
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mb-2">{pred.reasoning}</p>
                        <div className="flex items-center gap-2 text-xs text-primary">
                          <Lightbulb className="w-3 h-3" />
                          Expected: {pred.questionType}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="strategy" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Zap className="w-5 h-5 text-primary" />
                  Personalized PYQ Strategy
                </h3>

                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3, 4].map((i) => (
                      <Skeleton key={i} className="h-20 w-full" />
                    ))}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {strategy.map((item, index) => (
                      <div key={index} className="p-4 rounded-xl bg-background/50 border border-border/50 flex gap-4">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                            item.priority === 1
                              ? "bg-success/20 text-success"
                              : item.priority === 2
                              ? "bg-warning/20 text-warning"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {item.priority}
                        </div>
                        <div className="flex-1">
                          <p className="font-medium mb-1">{item.action}</p>
                          <p className="text-sm text-muted-foreground mb-2">{item.reason}</p>
                          <div className="flex items-center gap-2 text-xs text-primary">
                            <Calendar className="w-3 h-3" />
                            {item.timeframe}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            <TabsContent value="practice" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  PYQ Practice
                </h3>

                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : selectedExam === "prelims" ? (
                  <div className="space-y-4">
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm font-medium mb-2">Subject</p>
                        <div className="flex flex-wrap gap-2">
                          {prelimsSubjects.map((subject) => (
                            <Button
                              key={subject}
                              variant={selectedSubject === subject ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedSubject(subject);
                                setCurrentQuestionIndex(0);
                                setSelectedAnswer(null);
                                setShowExplanation(false);
                              }}
                            >
                              {subject}
                            </Button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <p className="text-sm font-medium mb-2">Level</p>
                        <div className="flex flex-wrap gap-2">
                          {[1, 2, 3, 4, 5].map((level) => (
                            <Button
                              key={level}
                              variant={selectedLevel === level ? "default" : "outline"}
                              size="sm"
                              onClick={() => {
                                setSelectedLevel(level);
                                setCurrentQuestionIndex(0);
                                setSelectedAnswer(null);
                                setShowExplanation(false);
                              }}
                            >
                              L{level}
                            </Button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {currentPrelimsQuestion ? (
                      <div>
                        {filteredPrelimsQuestions.length === 0 && effectivePrelimsQuestions.length > 0 && (
                          <div className="p-3 rounded-lg bg-warning/10 border border-warning/30 text-warning text-sm mb-3">
                            Exact subject + level match is unavailable. Showing best available PYQs.
                          </div>
                        )}
                        <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                          <span>
                            Question {currentQuestionIndex + 1} of {effectivePrelimsQuestions.length}
                          </span>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{currentPrelimsQuestion.subject}</Badge>
                            <Badge variant="secondary">{currentPrelimsQuestion.year}</Badge>
                            <Badge variant="outline">L{currentPrelimsQuestion.level || 1}</Badge>
                          </div>
                        </div>

                        <div className="p-4 rounded-xl bg-background/50 border border-border/50 mb-4">
                          <p className="font-medium mb-4">{currentPrelimsQuestion.question}</p>
                          <div className="space-y-2">
                            {currentPrelimsQuestion.options?.map((option, idx) => {
                              const optionLetter = String.fromCharCode(65 + idx);
                              const isCorrect = optionLetter === currentPrelimsQuestion.correctAnswer;
                              const isSelected = selectedAnswer === optionLetter;

                              return (
                                <button
                                  key={idx}
                                  onClick={() => !showExplanation && handleAnswerSelect(optionLetter)}
                                  disabled={showExplanation}
                                  className={`w-full p-3 rounded-lg border text-left transition-all ${
                                    showExplanation
                                      ? isCorrect
                                        ? "bg-success/20 border-success text-success"
                                        : isSelected
                                        ? "bg-destructive/20 border-destructive text-destructive"
                                        : "bg-muted/50 border-border"
                                      : "hover:bg-primary/10 hover:border-primary border-border"
                                  }`}
                                >
                                  <span className="font-medium mr-2">{optionLetter}.</span>
                                  {option}
                                </button>
                              );
                            })}
                          </div>

                          {showExplanation && (
                            <div className="mt-4 p-4 rounded-lg bg-primary/10 border border-primary/30">
                              <p className="text-sm font-medium mb-1">Explanation:</p>
                              <p className="text-sm text-muted-foreground">{currentPrelimsQuestion.explanation}</p>
                            </div>
                          )}
                        </div>

                        {showExplanation && currentQuestionIndex < effectivePrelimsQuestions.length - 1 && (
                          <Button onClick={nextPrelimsQuestion} className="w-full bg-gradient-primary">
                            Next Question
                            <ChevronRight className="w-4 h-4 ml-2" />
                          </Button>
                        )}
                      </div>
                    ) : (
                      <p className="text-center text-muted-foreground py-8">
                        No PYQs available for this subject and level. Try another level or regenerate analysis.
                      </p>
                    )}
                  </div>
                ) : descriptiveQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">
                        Question {writingQuestionIndex + 1} of {descriptiveQuestions.length}
                      </span>
                      <Button
                        variant="outline"
                        onClick={() => {
                          const next = (writingQuestionIndex + 1) % descriptiveQuestions.length;
                          setWritingQuestionIndex(next);
                          setWritingAnswer("");
                          setWritingFeedback("");
                        }}
                      >
                        Next PYQ
                      </Button>
                    </div>

                    <Card className="p-4 border">
                      <div className="flex flex-wrap gap-2 mb-3">
                        <Badge variant="secondary">{currentWritingQuestion?.subject}</Badge>
                        <Badge variant="outline">{currentWritingQuestion?.year}</Badge>
                        <Badge variant="outline">{currentWritingQuestion?.wordLimit || 250} words</Badge>
                      </div>
                      <p className="font-medium mb-3">{currentWritingQuestion?.question}</p>
                      {currentWritingQuestion?.expectedApproach && (
                        <p className="text-sm text-muted-foreground">
                          <span className="font-medium text-foreground">Expected approach:</span> {currentWritingQuestion.expectedApproach}
                        </p>
                      )}
                    </Card>

                    <div>
                      <div className="flex justify-between items-center mb-2">
                        <label className="text-sm font-medium">Your Answer</label>
                        <span className="text-sm text-muted-foreground">
                          {writingWordCount} / {currentWritingQuestion?.wordLimit || 250} words
                        </span>
                      </div>
                      <Textarea
                        value={writingAnswer}
                        onChange={(e) => setWritingAnswer(e.target.value)}
                        placeholder="Write your PYQ answer here..."
                        className="min-h-[260px] resize-none"
                        disabled={isEvaluatingWriting}
                      />
                    </div>

                    <Button onClick={evaluateWritingAnswer} disabled={isEvaluatingWriting || !writingAnswer.trim()} className="w-full">
                      {isEvaluatingWriting ? "Evaluating..." : "Submit for Evaluation"}
                    </Button>

                    {writingFeedback && (
                      <Card className="p-4 border-primary/20 space-y-4">
                        <h4 className="font-semibold">AI Evaluation</h4>

                        {parsedWritingFeedback.sectionScores.length > 0 && (
                          <div className="space-y-2">
                            <h5 className="text-sm font-semibold">Section-wise Marks</h5>
                            <div className="grid gap-2 sm:grid-cols-2">
                              {parsedWritingFeedback.sectionScores.map((section) => {
                                const passed = section.score >= Math.ceil(section.maxScore * 0.6);
                                return (
                                  <div key={section.title} className="rounded-lg border p-3 flex items-center justify-between bg-card">
                                    <span className="text-sm font-medium">{section.title}</span>
                                    <span className={`text-sm font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>
                                      {section.score}/{section.maxScore}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        )}

                        {parsedWritingFeedback.totalScore !== null && parsedWritingFeedback.totalMax !== null && (
                          <div className="rounded-lg border p-3 bg-secondary/20 flex items-center justify-between">
                            <span className="font-semibold">Total Marks</span>
                            <span
                              className={`font-bold ${
                                parsedWritingFeedback.totalScore >= Math.ceil(parsedWritingFeedback.totalMax * 0.6)
                                  ? "text-green-600"
                                  : "text-red-600"
                              }`}
                            >
                              {parsedWritingFeedback.totalScore}/{parsedWritingFeedback.totalMax}
                            </span>
                          </div>
                        )}

                        {parsedWritingFeedback.summary && (
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Overall Summary</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed">{parsedWritingFeedback.summary}</p>
                          </div>
                        )}
                        {parsedWritingFeedback.strengths && (
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Key Strengths</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed">{parsedWritingFeedback.strengths}</p>
                          </div>
                        )}
                        {parsedWritingFeedback.improvements && (
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Areas for Improvement</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed">{parsedWritingFeedback.improvements}</p>
                          </div>
                        )}
                        {parsedWritingFeedback.suggestions && (
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Specific Suggestions</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed">{parsedWritingFeedback.suggestions}</p>
                          </div>
                        )}
                        {parsedWritingFeedback.modelAnswer && (
                          <div>
                            <h5 className="text-sm font-semibold mb-1">Model Answer</h5>
                            <p className="text-sm text-muted-foreground leading-relaxed whitespace-pre-wrap">{parsedWritingFeedback.modelAnswer}</p>
                          </div>
                        )}

                        {!parsedWritingFeedback.sectionScores.length && (
                          <p className="whitespace-pre-wrap text-sm text-muted-foreground leading-relaxed">{parsedWritingFeedback.cleaned}</p>
                        )}
                      </Card>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Generate analysis to start PYQ practice.
                  </p>
                )}
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
};

export default PYQEngine;
