import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, CheckCircle, XCircle, Loader2, Trophy, Zap, Target, Brain, Sparkles } from "lucide-react";
import { toast } from "sonner";

const QUESTIONS_PER_LEVEL = 5;
const PASS_THRESHOLD = 0.6; // 60% correct to advance

const LEVEL_CONFIG = [
  { level: 1, name: "Beginner", color: "bg-green-500", icon: Target, description: "Basic factual questions" },
  { level: 2, name: "Elementary", color: "bg-blue-500", icon: Zap, description: "Concept understanding" },
  { level: 3, name: "Intermediate", color: "bg-yellow-500", icon: Brain, description: "Application based" },
  { level: 4, name: "Advanced", color: "bg-orange-500", icon: Sparkles, description: "Analytical questions" },
  { level: 5, name: "Expert", color: "bg-red-500", icon: Trophy, description: "UPSC exam level" },
];

const SUBJECTS = [
  "Indian History",
  "Indian Polity", 
  "Geography",
  "Economy",
  "Environment & Ecology",
  "Science & Technology",
  "Current Affairs",
  "Art & Culture"
];

const Prelims = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [correctCount, setCorrectCount] = useState(0);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [quizStarted, setQuizStarted] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  const navigate = useNavigate();

  const generateQuestions = async (level: number, subject?: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-prelims-questions', {
        body: { 
          level, 
          count: QUESTIONS_PER_LEVEL,
          subject: subject 
        }
      });

      if (error) throw error;
      
      if (data.questions && data.questions.length > 0) {
        setQuestions(data.questions);
        setCurrentIndex(0);
        setSelectedAnswer(null);
        setShowResult(false);
        setCorrectCount(0);
        setQuizComplete(false);
        toast.success(`Level ${level} questions loaded!`);
      } else {
        throw new Error('No questions generated');
      }
    } catch (error) {
      console.error('Error generating questions:', error);
      toast.error('Failed to generate questions. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const startQuiz = (subject?: string) => {
    setSelectedSubject(subject || null);
    setQuizStarted(true);
    setCurrentLevel(1);
    generateQuestions(1, subject);
  };

  const handleAnswer = async (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const isCorrect = answer === questions[currentIndex].correct_answer;
    if (isCorrect) {
      setCorrectCount(prev => prev + 1);
    }

    // Save attempt to database
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("prelims_attempts").insert({
        user_id: user.id,
        question_id: questions[currentIndex].id,
        selected_answer: answer,
        is_correct: isCorrect,
      });
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    } else {
      // Quiz complete for this level
      evaluateLevel();
    }
  };

  const evaluateLevel = () => {
    const accuracy = correctCount / QUESTIONS_PER_LEVEL;
    setQuizComplete(true);

    if (accuracy >= PASS_THRESHOLD) {
      if (currentLevel < 5) {
        toast.success(`🎉 Great job! You passed Level ${currentLevel} with ${Math.round(accuracy * 100)}% accuracy!`);
      } else {
        toast.success(`🏆 Congratulations! You've mastered all 5 levels!`);
      }
    } else {
      toast.info(`You scored ${Math.round(accuracy * 100)}%. Need ${Math.round(PASS_THRESHOLD * 100)}% to advance.`);
    }
  };

  const advanceToNextLevel = () => {
    if (currentLevel < 5) {
      setCurrentLevel(prev => prev + 1);
      generateQuestions(currentLevel + 1, selectedSubject || undefined);
    }
  };

  const retryLevel = () => {
    generateQuestions(currentLevel, selectedSubject || undefined);
  };

  const currentLevelConfig = LEVEL_CONFIG[currentLevel - 1];
  const LevelIcon = currentLevelConfig?.icon || Target;

  // Subject selection screen
  if (!quizStarted) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
        <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold text-lg">Prelims Quiz</h1>
            <p className="text-xs text-muted-foreground">AI-Powered Question Bank</p>
          </div>
        </header>

        <main className="max-w-4xl mx-auto p-4 py-6">
          <Card className="p-6 mb-6 bg-gradient-card border-0">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Choose Your Challenge</h2>
              <p className="text-muted-foreground">
                AI generates fresh questions every time. Progress through 5 difficulty levels!
              </p>
            </div>

            {/* Level Progress Display */}
            <div className="flex justify-center gap-2 mb-8">
              {LEVEL_CONFIG.map((config) => {
                const Icon = config.icon;
                return (
                  <div 
                    key={config.level}
                    className={`flex flex-col items-center p-3 rounded-xl ${
                      config.level === 1 ? 'bg-primary/20 ring-2 ring-primary' : 'bg-muted/50'
                    }`}
                  >
                    <Icon className={`w-6 h-6 mb-1 ${config.level === 1 ? 'text-primary' : 'text-muted-foreground'}`} />
                    <span className="text-xs font-medium">L{config.level}</span>
                  </div>
                );
              })}
            </div>

            {/* Subject Selection */}
            <div className="space-y-3">
              <Button 
                onClick={() => startQuiz()} 
                className="w-full h-14 text-lg bg-gradient-primary rounded-xl"
              >
                <Sparkles className="w-5 h-5 mr-2" />
                Random Mix (All Subjects)
              </Button>

              <div className="grid grid-cols-2 gap-3 mt-4">
                {SUBJECTS.map((subject) => (
                  <Button
                    key={subject}
                    variant="outline"
                    onClick={() => startQuiz(subject)}
                    className="h-12 rounded-xl hover:bg-primary/10 hover:border-primary"
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex flex-col items-center justify-center gap-4">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
        <p className="text-lg font-medium">Generating Level {currentLevel} Questions...</p>
        <p className="text-sm text-muted-foreground">AI is crafting unique UPSC-style questions</p>
      </div>
    );
  }

  // Quiz complete screen
  if (quizComplete) {
    const accuracy = correctCount / QUESTIONS_PER_LEVEL;
    const passed = accuracy >= PASS_THRESHOLD;

    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
        <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="font-bold">Level {currentLevel} Complete</h1>
          </div>
        </header>

        <main className="max-w-lg mx-auto p-4 py-8">
          <Card className="p-8 text-center bg-gradient-card border-0">
            <div className={`w-20 h-20 mx-auto rounded-full flex items-center justify-center mb-4 ${
              passed ? 'bg-success/20' : 'bg-muted'
            }`}>
              {passed ? (
                <Trophy className="w-10 h-10 text-success" />
              ) : (
                <Target className="w-10 h-10 text-muted-foreground" />
              )}
            </div>

            <h2 className="text-2xl font-bold mb-2">
              {passed ? 'Level Passed!' : 'Keep Practicing!'}
            </h2>

            <div className="flex justify-center gap-4 my-6">
              <div className="text-center">
                <p className="text-3xl font-bold text-primary">{correctCount}/{QUESTIONS_PER_LEVEL}</p>
                <p className="text-sm text-muted-foreground">Correct</p>
              </div>
              <div className="text-center">
                <p className="text-3xl font-bold">{Math.round(accuracy * 100)}%</p>
                <p className="text-sm text-muted-foreground">Accuracy</p>
              </div>
            </div>

            <Progress value={accuracy * 100} className="h-3 mb-6" />

            {passed && currentLevel < 5 && (
              <p className="text-sm text-muted-foreground mb-6">
                Ready for Level {currentLevel + 1}? The questions will get more challenging!
              </p>
            )}

            {passed && currentLevel === 5 && (
              <p className="text-sm text-success mb-6">
                🏆 You've mastered all 5 levels! You're UPSC ready!
              </p>
            )}

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

              <Button 
                onClick={() => setQuizStarted(false)} 
                variant="ghost" 
                className="w-full h-12 rounded-xl"
              >
                Change Subject
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  // No questions loaded
  if (questions.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p>No questions available. Please try again.</p>
      </div>
    );
  }

  const question = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => setQuizStarted(false)} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <Badge className={`${currentLevelConfig.color} text-white`}>
                <LevelIcon className="w-3 h-3 mr-1" />
                Level {currentLevel}
              </Badge>
              <span className="text-sm text-muted-foreground">{currentLevelConfig.name}</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              Question {currentIndex + 1} of {questions.length} • {correctCount} correct
            </p>
          </div>
          {selectedSubject && (
            <Badge variant="outline" className="hidden sm:flex">
              {selectedSubject}
            </Badge>
          )}
        </div>
        <Progress 
          value={((currentIndex + 1) / questions.length) * 100} 
          className="h-1 mt-3" 
        />
      </header>

      <main className="max-w-3xl mx-auto p-4 py-6">
        <Card className="p-6 mb-4 bg-gradient-card border-0">
          <div className="flex flex-wrap gap-2 mb-3">
            <Badge variant="secondary">{question.subject}</Badge>
            <Badge variant="outline">{question.topic}</Badge>
            <Badge variant="outline">{question.difficulty}</Badge>
          </div>
          
          <h2 className="text-lg font-semibold mb-6 leading-relaxed">{question.question}</h2>
          
          <div className="space-y-3">
            {['A', 'B', 'C', 'D'].map((opt) => {
              const isCorrect = opt === question.correct_answer;
              const isSelected = opt === selectedAnswer;
              
              return (
                <button
                  key={opt}
                  onClick={() => !showResult && handleAnswer(opt)}
                  disabled={showResult}
                  className={`w-full p-4 rounded-xl text-left transition-all border-2 ${
                    showResult
                      ? isCorrect
                        ? "border-success bg-success/10"
                        : isSelected
                        ? "border-destructive bg-destructive/10"
                        : "border-border"
                      : isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`font-bold text-sm px-2 py-1 rounded ${
                      showResult && isCorrect ? 'bg-success text-white' : 
                      showResult && isSelected && !isCorrect ? 'bg-destructive text-white' : 
                      'bg-muted'
                    }`}>
                      {opt}
                    </span>
                    <span className="flex-1">{question[`option_${opt.toLowerCase()}`]}</span>
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
                <Brain className="w-4 h-4" />
                Explanation:
              </p>
              <p className="text-sm text-muted-foreground leading-relaxed">{question.explanation}</p>
            </div>
          )}
        </Card>

        {showResult && (
          <Button onClick={nextQuestion} className="w-full rounded-xl h-12 bg-gradient-primary">
            {currentIndex < questions.length - 1 ? "Next Question" : "See Results"}
          </Button>
        )}
      </main>
    </div>
  );
};

export default Prelims;
