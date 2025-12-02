import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  ArrowLeft, TrendingUp, Target, BookOpen, Brain, 
  BarChart3, Lightbulb, Zap, Calendar, RefreshCw,
  ChevronRight, Sparkles, LineChart
} from "lucide-react";

type ExamType = "prelims" | "mains" | "optional" | "essay";
type AnalysisSection = "trends" | "predictions" | "strategy" | "practice" | "quiz";

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
  options: string[];
  correctAnswer: string;
  explanation: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
}

const PYQEngine = () => {
  const [selectedExam, setSelectedExam] = useState<ExamType>("prelims");
  const [activeSection, setActiveSection] = useState<AnalysisSection>("trends");
  const [loading, setLoading] = useState(false);
  const [trends, setTrends] = useState<TrendData[]>([]);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [strategy, setStrategy] = useState<StrategyItem[]>([]);
  const [pyqQuestions, setPyqQuestions] = useState<PYQQuestion[]>([]);
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [analysisGenerated, setAnalysisGenerated] = useState(false);
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
  }, []);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const generateAnalysis = async () => {
    setLoading(true);
    setAnalysisGenerated(false);
    
    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/pyq-analysis`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({ examType: selectedExam, analysisType: "full" }),
        }
      );

      if (!response.ok) {
        throw new Error("Failed to generate analysis");
      }

      const data = await response.json();
      
      setTrends(data.trends || []);
      setPredictions(data.predictions || []);
      setStrategy(data.strategy || []);
      setPyqQuestions(data.pyqQuestions || []);
      setAnalysisGenerated(true);
      
      toast({
        title: "Analysis Generated!",
        description: `40-year analysis for ${selectedExam.toUpperCase()} is ready.`,
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

  const handleAnswerSelect = (answer: string) => {
    setSelectedAnswer(answer);
    setShowExplanation(true);
  };

  const nextQuestion = () => {
    if (currentQuestionIndex < pyqQuestions.length - 1) {
      setCurrentQuestionIndex(prev => prev + 1);
      setSelectedAnswer(null);
      setShowExplanation(false);
    }
  };

  const getTrendIcon = (trend: string) => {
    switch (trend) {
      case "rising": return <TrendingUp className="w-4 h-4 text-success" />;
      case "declining": return <TrendingUp className="w-4 h-4 text-destructive rotate-180" />;
      default: return <LineChart className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getProbabilityColor = (prob: string) => {
    switch (prob) {
      case "high": return "bg-success/20 text-success border-success/30";
      case "medium": return "bg-warning/20 text-warning border-warning/30";
      default: return "bg-muted text-muted-foreground border-border";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
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
            <p className="text-xs text-muted-foreground">AI-Powered 40-Year Analysis</p>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Exam Type Selection */}
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
                onClick={() => {
                  setSelectedExam(exam);
                  setAnalysisGenerated(false);
                }}
              >
                {exam === "prelims" && <Brain className="w-4 h-4 mr-2" />}
                {exam === "mains" && <BookOpen className="w-4 h-4 mr-2" />}
                {exam === "optional" && <Target className="w-4 h-4 mr-2" />}
                {exam === "essay" && <Lightbulb className="w-4 h-4 mr-2" />}
                {exam}
              </Button>
            ))}
          </div>
          
          <Button 
            onClick={generateAnalysis} 
            disabled={loading}
            className="w-full mt-4 bg-gradient-primary h-12"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Analyzing 40 Years of PYQs...
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 mr-2" />
                Generate AI Analysis
              </>
            )}
          </Button>
        </Card>

        {/* Analysis Sections */}
        {(loading || analysisGenerated) && (
          <Tabs value={activeSection} onValueChange={(v) => setActiveSection(v as AnalysisSection)}>
            <TabsList className="grid grid-cols-5 w-full h-auto p-1">
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
              <TabsTrigger value="quiz" className="text-xs py-2">
                <BookOpen className="w-3 h-3 mr-1" />
                Quiz
              </TabsTrigger>
            </TabsList>

            {/* Trend Analysis */}
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
                            <span className={`text-sm font-semibold ${
                              trend.trend === "rising" ? "text-success" : 
                              trend.trend === "declining" ? "text-destructive" : "text-muted-foreground"
                            }`}>
                              {trend.weightage}%
                            </span>
                          </div>
                        </div>
                        <div className="h-2 bg-muted rounded-full overflow-hidden mb-2">
                          <div 
                            className={`h-full rounded-full transition-all ${
                              trend.trend === "rising" ? "bg-success" : 
                              trend.trend === "declining" ? "bg-destructive" : "bg-primary"
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

            {/* Predictions */}
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

            {/* Personalized Strategy */}
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
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                          item.priority === 1 ? "bg-success/20 text-success" :
                          item.priority === 2 ? "bg-warning/20 text-warning" :
                          "bg-muted text-muted-foreground"
                        }`}>
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

            {/* Smart Practice */}
            <TabsContent value="practice" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <Brain className="w-5 h-5 text-primary" />
                  Smart PYQ Practice (Weak Areas Focus)
                </h3>
                
                {loading ? (
                  <Skeleton className="h-64 w-full" />
                ) : pyqQuestions.length > 0 ? (
                  <div>
                    <div className="flex items-center justify-between mb-4 text-sm text-muted-foreground">
                      <span>Question {currentQuestionIndex + 1} of {pyqQuestions.length}</span>
                      <span className="px-2 py-1 rounded-full bg-primary/10 text-primary text-xs">
                        Year: {pyqQuestions[currentQuestionIndex]?.year}
                      </span>
                    </div>
                    
                    <div className="p-4 rounded-xl bg-background/50 border border-border/50 mb-4">
                      <p className="font-medium mb-4">{pyqQuestions[currentQuestionIndex]?.question}</p>
                      
                      <div className="space-y-2">
                        {pyqQuestions[currentQuestionIndex]?.options.map((option, idx) => {
                          const optionLetter = String.fromCharCode(65 + idx);
                          const isCorrect = optionLetter === pyqQuestions[currentQuestionIndex]?.correctAnswer;
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
                          <p className="text-sm text-muted-foreground">
                            {pyqQuestions[currentQuestionIndex]?.explanation}
                          </p>
                        </div>
                      )}
                    </div>
                    
                    {showExplanation && currentQuestionIndex < pyqQuestions.length - 1 && (
                      <Button onClick={nextQuestion} className="w-full bg-gradient-primary">
                        Next Question
                        <ChevronRight className="w-4 h-4 ml-2" />
                      </Button>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Generate analysis to start practicing PYQs
                  </p>
                )}
              </Card>
            </TabsContent>

            {/* PYQ to Quiz */}
            <TabsContent value="quiz" className="space-y-4 mt-4">
              <Card className="p-6 bg-gradient-card border-0">
                <h3 className="font-semibold mb-4 flex items-center gap-2">
                  <BookOpen className="w-5 h-5 text-primary" />
                  PYQ to Modern Quiz Converter
                </h3>
                
                {loading ? (
                  <div className="space-y-4">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-32 w-full" />
                    ))}
                  </div>
                ) : pyqQuestions.length > 0 ? (
                  <div className="space-y-4">
                    <p className="text-sm text-muted-foreground mb-4">
                      {pyqQuestions.length} PYQs converted to modern MCQ format with detailed explanations
                    </p>
                    
                    {pyqQuestions.slice(0, 5).map((q, index) => (
                      <div key={index} className="p-4 rounded-xl bg-background/50 border border-border/50">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-primary/10 text-primary">
                            {q.subject} • {q.year}
                          </span>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            q.difficulty === "easy" ? "bg-success/20 text-success" :
                            q.difficulty === "hard" ? "bg-destructive/20 text-destructive" :
                            "bg-warning/20 text-warning"
                          }`}>
                            {q.difficulty}
                          </span>
                        </div>
                        <p className="font-medium text-sm mb-2">{q.question}</p>
                        <p className="text-xs text-muted-foreground">
                          Answer: {q.correctAnswer}
                        </p>
                      </div>
                    ))}
                    
                    {pyqQuestions.length > 5 && (
                      <p className="text-center text-sm text-muted-foreground">
                        + {pyqQuestions.length - 5} more questions available in Practice tab
                      </p>
                    )}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">
                    Generate analysis to convert PYQs to quiz format
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
