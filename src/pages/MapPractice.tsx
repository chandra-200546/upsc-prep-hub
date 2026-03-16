import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useGamification } from "@/hooks/use-gamification";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, Globe, Loader2, Map, Sparkles, Target, Trophy, XCircle, Zap } from "lucide-react";
import IndiaMap from "@/components/maps/IndiaMap";
import WorldMap from "@/components/maps/WorldMap";
import { toast } from "sonner";

type MapType = "india" | "world";

const QUESTIONS_PER_LEVEL = 5;
const PASS_THRESHOLD = 0.6;

const LEVEL_CONFIG = [
  { level: 1, name: "Beginner", color: "bg-green-500", description: "Identify basic locations and features" },
  { level: 2, name: "Elementary", color: "bg-blue-500", description: "Connect places with facts" },
  { level: 3, name: "Intermediate", color: "bg-yellow-500", description: "Apply map concepts" },
  { level: 4, name: "Advanced", color: "bg-orange-500", description: "Analyze regional patterns" },
  { level: 5, name: "Expert", color: "bg-red-500", description: "UPSC-level map reasoning" },
];

const MAP_OPTIONS: { label: string; value: MapType; icon: typeof Map }[] = [
  { label: "India", value: "india", icon: Map },
  { label: "World", value: "world", icon: Globe },
];

const MapPractice = () => {
  const navigate = useNavigate();
  const { awardXP, XP_REWARDS } = useGamification();

  const [loading, setLoading] = useState(false);
  const [showMap, setShowMap] = useState(true);
  const [mapType, setMapType] = useState<MapType>("india");
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const [pointsEarned, setPointsEarned] = useState(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  const generateQuestions = async (level: number, selectedMapType: MapType) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("map-questions", {
        body: {
          mapType: selectedMapType,
          level,
          count: QUESTIONS_PER_LEVEL,
        },
      });

      if (error) throw error;
      if (!data?.questions || data.questions.length === 0) {
        throw new Error("No questions received");
      }

      setQuestions(data.questions);
      setCurrentIndex(0);
      setSelectedAnswer(null);
      setShowResult(false);
      setCorrectCount(0);
      setQuizComplete(false);
      toast.success(`Level ${level} map questions loaded!`);
    } catch (error) {
      console.error("Error generating map questions:", error);
      toast.error("Failed to generate map questions. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = (selectedMapType: MapType) => {
    setMapType(selectedMapType);
    setQuizStarted(true);
    setCurrentLevel(1);
    setPointsEarned(0);
    generateQuestions(1, selectedMapType);
  };

  const handleAnswer = async (selectedIndex: number) => {
    if (!questions[currentIndex] || showResult) return;

    setSelectedAnswer(selectedIndex);
    setShowResult(true);

    const isCorrect = selectedIndex === questions[currentIndex].correct;
    if (isCorrect) {
      setCorrectCount((prev) => prev + 1);
      setPointsEarned((prev) => prev + XP_REWARDS.CORRECT_ANSWER);
      await awardXP(XP_REWARDS.CORRECT_ANSWER, "Correct map answer!");
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex((prev) => prev + 1);
      setSelectedAnswer(null);
      setShowResult(false);
      return;
    }
    evaluateLevel();
  };

  const evaluateLevel = async () => {
    const accuracy = correctCount / QUESTIONS_PER_LEVEL;
    setQuizComplete(true);

    if (accuracy >= PASS_THRESHOLD) {
      setPointsEarned((prev) => prev + XP_REWARDS.LEVEL_CLEARANCE);
      await awardXP(XP_REWARDS.LEVEL_CLEARANCE, `Map Level ${currentLevel} cleared!`);
      if (currentLevel < 5) {
        toast.success(`Great job! Level ${currentLevel} cleared with ${Math.round(accuracy * 100)}% accuracy.`);
      } else {
        toast.success("Congratulations! You mastered all 5 map levels.");
      }
    } else {
      toast.info(`You scored ${Math.round(accuracy * 100)}%. Need ${Math.round(PASS_THRESHOLD * 100)}% to advance.`);
    }
  };

  const advanceToNextLevel = () => {
    if (currentLevel < 5) {
      const nextLevel = currentLevel + 1;
      setCurrentLevel(nextLevel);
      generateQuestions(nextLevel, mapType);
    }
  };

  const retryLevel = () => {
    generateQuestions(currentLevel, mapType);
  };

  const currentLevelConfig = LEVEL_CONFIG[currentLevel - 1];
  const currentQuestion = questions[currentIndex];
  const accuracy = correctCount / QUESTIONS_PER_LEVEL;
  const passed = accuracy >= PASS_THRESHOLD;
  const activeMapLabel = mapType === "india" ? "India" : "World";

  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
        <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Map Practice</h1>
            <p className="text-xs text-muted-foreground">Level-Based Geography Challenge</p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 py-6">
          <Card className="p-6 mb-6 bg-gradient-card border-0">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Choose Your Map Challenge</h2>
              <p className="text-muted-foreground">Clear 5 levels with increasing difficulty and earn points for each correct answer.</p>
            </div>

            <div className="flex justify-center gap-2 mb-8 flex-wrap">
              {LEVEL_CONFIG.map((config) => (
                <div key={config.level} className="flex flex-col items-center p-3 rounded-xl bg-muted/50 min-w-20">
                  <span className="text-xs font-semibold mb-1">L{config.level}</span>
                  <span className="text-[10px] text-center text-muted-foreground">{config.name}</span>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {MAP_OPTIONS.map((option) => {
                const Icon = option.icon;
                return (
                  <Button
                    key={option.value}
                    variant="outline"
                    onClick={() => startQuiz(option.value)}
                    className="h-14 rounded-xl hover:bg-primary/10 hover:border-primary"
                  >
                    <Icon className="w-5 h-5 mr-2" />
                    Start {option.label} Quiz
                  </Button>
                );
              })}
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Generating Level {currentLevel} Map Questions...</p>
        <p className="text-sm text-muted-foreground">Crafting unique geography questions</p>
      </div>
    );
  }

  if (quizComplete) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
        <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold">Map Level {currentLevel} Complete</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto p-4 py-8">
          <Card className="p-8 text-center bg-gradient-card border-0">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${passed ? "bg-success/20" : "bg-muted"}`}>
              {passed ? <Trophy className="w-10 h-10 text-success" /> : <Target className="w-10 h-10 text-muted-foreground" />}
            </div>

            <h2 className="text-2xl font-bold mb-2">{passed ? "Level Passed!" : "Try Again!"}</h2>

            <div className="flex justify-center gap-4 my-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{correctCount}/{QUESTIONS_PER_LEVEL}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{Math.round(accuracy * 100)}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold text-warning">{pointsEarned}</p>
                <p className="text-sm text-muted-foreground">Points</p>
              </div>
            </div>

            <Progress value={accuracy * 100} className="h-3 mb-6" />

            <div className="space-y-3">
              {passed && currentLevel < 5 && (
                <Button onClick={advanceToNextLevel} className="w-full h-12 bg-gradient-primary rounded-xl">
                  <Zap className="w-5 h-5 mr-2" />
                  Advance to Level {currentLevel + 1}
                </Button>
              )}

              <Button onClick={retryLevel} variant="outline" className="w-full h-12 rounded-xl">
                Retry Level {currentLevel}
              </Button>

              <Button onClick={() => setQuizStarted(false)} variant="ghost" className="w-full h-12 rounded-xl">
                Change Map
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  if (!currentQuestion) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No map questions available. Please try again.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 sticky top-0 z-10">
        <div className="max-w-7xl mx-auto flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setQuizStarted(false)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className={`${currentLevelConfig.color} text-white`}>Level {currentLevel}</Badge>
              <span className="text-sm text-muted-foreground">{currentLevelConfig.name}</span>
              <Badge variant="outline">{activeMapLabel} Map</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Question {currentIndex + 1} of {questions.length} | {correctCount} correct | {pointsEarned} points
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => setShowMap((prev) => !prev)}>
            {showMap ? "Hide Map" : "Show Map"}
          </Button>
        </div>
        <div className="max-w-7xl mx-auto">
          <Progress value={((currentIndex + 1) / questions.length) * 100} className="h-1 mt-3" />
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        <div className={`grid gap-6 ${showMap ? "lg:grid-cols-2" : ""}`}>
          {showMap && (
            <Card className="p-4 relative overflow-hidden h-[500px]">
              <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border">
                <p className="text-xs font-medium text-muted-foreground">{activeMapLabel} Map</p>
                <p className="text-[10px] text-muted-foreground/70">Scroll to zoom | Drag to pan</p>
              </div>
              {mapType === "india" ? <IndiaMap /> : <WorldMap />}
            </Card>
          )}

          <Card className="p-6 bg-gradient-card border-0">
            <div className="mb-4">
              <div className="flex flex-wrap gap-2 mb-3">
                <Badge variant="secondary">{activeMapLabel} Geography</Badge>
                <Badge variant="outline">{currentLevelConfig.description}</Badge>
              </div>
              <h2 className="text-lg font-semibold leading-relaxed">{currentQuestion.question}</h2>
            </div>

            <div className="grid gap-2">
              {currentQuestion.options.map((option: string, index: number) => {
                const isCorrect = index === currentQuestion.correct;
                const isSelected = index === selectedAnswer;

                return (
                  <button
                    key={index}
                    onClick={() => handleAnswer(index)}
                    disabled={showResult}
                    className={`w-full p-3 rounded-xl text-left transition-all border-2 ${
                      showResult
                        ? isCorrect
                          ? "border-success bg-success/10"
                          : isSelected
                          ? "border-destructive bg-destructive/10"
                          : "border-border"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <span className={`font-bold text-sm px-2 py-1 rounded ${
                        showResult && isCorrect
                          ? "bg-success text-white"
                          : showResult && isSelected && !isCorrect
                          ? "bg-destructive text-white"
                          : "bg-muted"
                      }`}>
                        {String.fromCharCode(65 + index)}
                      </span>
                      <span className="flex-1">{option}</span>
                      {showResult && isCorrect && <CheckCircle className="w-5 h-5 text-success shrink-0" />}
                      {showResult && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                    </div>
                  </button>
                );
              })}
            </div>

            {showResult && (
              <div className="mt-6 p-4 bg-muted rounded-xl">
                <p className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <Sparkles className="w-4 h-4" />
                  Explanation
                </p>
                <p className="text-sm text-muted-foreground leading-relaxed">{currentQuestion.explanation}</p>
              </div>
            )}

            {showResult && (
              <Button onClick={nextQuestion} className="w-full mt-6 rounded-xl h-12 bg-gradient-primary">
                {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
              </Button>
            )}
          </Card>
        </div>
      </main>
    </div>
  );
};

export default MapPractice;
