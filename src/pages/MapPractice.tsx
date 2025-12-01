import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Map, Globe, Trophy, Target } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const MapPractice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [mapType, setMapType] = useState<"india" | "world">("india");

  useEffect(() => {
    checkAuth();
    generateQuestions();
  }, [mapType]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const generateQuestions = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('map-questions', {
        body: { mapType }
      });

      if (error) throw error;

      if (data?.questions) {
        setQuestions(data.questions);
        setCurrentQuestion(0);
        setScore(0);
      } else {
        throw new Error('No questions received');
      }
    } catch (error) {
      console.error("Error generating questions:", error);
      toast({
        title: "Error",
        description: "Failed to generate questions. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (selectedIndex: number) => {
    if (!questions[currentQuestion]) return;
    
    const isCorrect = selectedIndex === questions[currentQuestion].correct;
    
    if (isCorrect) {
      setScore(score + 1);
      toast({
        title: "Correct! 🎉",
        description: questions[currentQuestion].explanation,
      });
    } else {
      toast({
        title: "Incorrect",
        description: questions[currentQuestion].explanation,
        variant: "destructive",
      });
    }

    if (currentQuestion < questions.length - 1) {
      setCurrentQuestion(currentQuestion + 1);
    } else {
      toast({
        title: "Quiz Complete!",
        description: `Your score: ${isCorrect ? score + 1 : score}/${questions.length}`,
      });
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
                <Map className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AI Map Practice</h1>
                <p className="text-xs text-muted-foreground">Master Geography</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Trophy className="w-5 h-5 text-warning" />
            <span className="font-bold">{score}</span>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <Tabs defaultValue="india" onValueChange={(v) => setMapType(v as "india" | "world")}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2">
            <TabsTrigger value="india" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              India
            </TabsTrigger>
            <TabsTrigger value="world" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              World
            </TabsTrigger>
          </TabsList>

          <TabsContent value="india" className="space-y-6">
            {loading ? (
              <Card className="p-8">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Generating questions...</p>
                </div>
              </Card>
            ) : questions.length > 0 && currentQuestion < questions.length ? (
              <Card className="p-8 bg-gradient-card border-0">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Question {currentQuestion + 1} of {questions.length}</span>
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-6">{questions[currentQuestion].question}</h2>
                </div>
                
                <div className="grid gap-3">
                  {questions[currentQuestion].options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto p-4 text-left justify-start hover:bg-primary/10 hover:border-primary transition-all"
                      onClick={() => handleAnswer(index)}
                    >
                      <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                      {option}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Target className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Ready to Practice?</h3>
                <p className="text-muted-foreground mb-6">Test your knowledge of Indian geography</p>
                <Button onClick={generateQuestions} disabled={loading}>
                  Start Quiz
                </Button>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="world" className="space-y-6">
            {loading ? (
              <Card className="p-8">
                <div className="text-center">
                  <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                  <p className="text-muted-foreground">Generating questions...</p>
                </div>
              </Card>
            ) : questions.length > 0 && currentQuestion < questions.length ? (
              <Card className="p-8 bg-gradient-card border-0">
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">Question {currentQuestion + 1} of {questions.length}</span>
                    <Target className="w-5 h-5 text-primary" />
                  </div>
                  <h2 className="text-2xl font-bold mb-6">{questions[currentQuestion].question}</h2>
                </div>
                
                <div className="grid gap-3">
                  {questions[currentQuestion].options.map((option: string, index: number) => (
                    <Button
                      key={index}
                      variant="outline"
                      className="h-auto p-4 text-left justify-start hover:bg-primary/10 hover:border-primary transition-all"
                      onClick={() => handleAnswer(index)}
                    >
                      <span className="font-semibold mr-3">{String.fromCharCode(65 + index)}.</span>
                      {option}
                    </Button>
                  ))}
                </div>
              </Card>
            ) : (
              <Card className="p-8 text-center">
                <Globe className="w-16 h-16 mx-auto mb-4 text-primary" />
                <h3 className="text-xl font-bold mb-2">Ready to Practice?</h3>
                <p className="text-muted-foreground mb-6">Test your knowledge of world geography</p>
                <Button onClick={generateQuestions} disabled={loading}>
                  Start Quiz
                </Button>
              </Card>
            )}
          </TabsContent>
        </Tabs>

        {questions.length > 0 && currentQuestion >= questions.length && (
          <Card className="p-8 text-center bg-gradient-success">
            <Trophy className="w-20 h-20 mx-auto mb-4 text-white" />
            <h3 className="text-2xl font-bold text-white mb-2">Quiz Complete!</h3>
            <p className="text-white/90 text-lg mb-6">Final Score: {score}/{questions.length}</p>
            <Button variant="secondary" onClick={generateQuestions}>
              Try Again
            </Button>
          </Card>
        )}
      </main>
    </div>
  );
};

export default MapPractice;
