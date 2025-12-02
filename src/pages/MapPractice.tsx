import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Map, Globe, Trophy, Target, ZoomIn, ZoomOut } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import IndiaMap from "@/components/maps/IndiaMap";
import WorldMap from "@/components/maps/WorldMap";

const MapPractice = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [score, setScore] = useState(0);
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentQuestion, setCurrentQuestion] = useState(0);
  const [mapType, setMapType] = useState<"india" | "world">("india");
  const [showMap, setShowMap] = useState(true);

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

  const QuizContent = () => {
    if (loading) {
      return (
        <Card className="p-6">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-muted-foreground">Generating questions...</p>
          </div>
        </Card>
      );
    }

    if (questions.length > 0 && currentQuestion < questions.length) {
      return (
        <Card className="p-6 bg-gradient-card border-0">
          <div className="mb-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm text-muted-foreground">
                Question {currentQuestion + 1} of {questions.length}
              </span>
              <Target className="w-4 h-4 text-primary" />
            </div>
            <h2 className="text-lg font-bold">{questions[currentQuestion].question}</h2>
          </div>
          
          <div className="grid gap-2">
            {questions[currentQuestion].options.map((option: string, index: number) => (
              <Button
                key={index}
                variant="outline"
                className="h-auto p-3 text-left justify-start hover:bg-primary/10 hover:border-primary transition-all text-sm"
                onClick={() => handleAnswer(index)}
              >
                <span className="font-semibold mr-2">{String.fromCharCode(65 + index)}.</span>
                {option}
              </Button>
            ))}
          </div>
        </Card>
      );
    }

    return (
      <Card className="p-6 text-center">
        {mapType === "india" ? (
          <Map className="w-12 h-12 mx-auto mb-3 text-primary" />
        ) : (
          <Globe className="w-12 h-12 mx-auto mb-3 text-primary" />
        )}
        <h3 className="text-lg font-bold mb-2">Ready to Practice?</h3>
        <p className="text-muted-foreground text-sm mb-4">
          Test your knowledge of {mapType === "india" ? "Indian" : "world"} geography
        </p>
        <Button onClick={generateQuestions} disabled={loading}>
          Start Quiz
        </Button>
      </Card>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
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
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowMap(!showMap)}
              className="hidden md:flex items-center gap-2"
            >
              {showMap ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              {showMap ? "Hide Map" : "Show Map"}
            </Button>
            <div className="flex items-center gap-2">
              <Trophy className="w-5 h-5 text-warning" />
              <span className="font-bold">{score}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Tabs defaultValue="india" onValueChange={(v) => setMapType(v as "india" | "world")}>
          <TabsList className="grid w-full max-w-md mx-auto grid-cols-2 mb-6">
            <TabsTrigger value="india" className="flex items-center gap-2">
              <Map className="w-4 h-4" />
              India
            </TabsTrigger>
            <TabsTrigger value="world" className="flex items-center gap-2">
              <Globe className="w-4 h-4" />
              World
            </TabsTrigger>
          </TabsList>

          <TabsContent value="india">
            <div className={`grid gap-6 ${showMap ? "lg:grid-cols-2" : ""}`}>
              {/* Map Section */}
              {showMap && (
                <Card className="p-4 relative overflow-hidden h-[500px]">
                  <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border">
                    <p className="text-xs font-medium text-muted-foreground">India Map</p>
                    <p className="text-[10px] text-muted-foreground/70">Scroll to zoom • Drag to pan</p>
                  </div>
                  <IndiaMap />
                </Card>
              )}

              {/* Quiz Section */}
              <div className="space-y-4">
                <QuizContent />

                {questions.length > 0 && currentQuestion >= questions.length && (
                  <Card className="p-6 text-center bg-gradient-success">
                    <Trophy className="w-16 h-16 mx-auto mb-3 text-white" />
                    <h3 className="text-xl font-bold text-white mb-2">Quiz Complete!</h3>
                    <p className="text-white/90 mb-4">Final Score: {score}/{questions.length}</p>
                    <Button variant="secondary" onClick={generateQuestions}>
                      Try Again
                    </Button>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="world">
            <div className={`grid gap-6 ${showMap ? "lg:grid-cols-2" : ""}`}>
              {/* Map Section */}
              {showMap && (
                <Card className="p-4 relative overflow-hidden h-[500px]">
                  <div className="absolute top-4 left-4 z-10 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg border">
                    <p className="text-xs font-medium text-muted-foreground">World Map</p>
                    <p className="text-[10px] text-muted-foreground/70">Scroll to zoom • Drag to pan</p>
                  </div>
                  <WorldMap />
                </Card>
              )}

              {/* Quiz Section */}
              <div className="space-y-4">
                <QuizContent />

                {questions.length > 0 && currentQuestion >= questions.length && (
                  <Card className="p-6 text-center bg-gradient-success">
                    <Trophy className="w-16 h-16 mx-auto mb-3 text-white" />
                    <h3 className="text-xl font-bold text-white mb-2">Quiz Complete!</h3>
                    <p className="text-white/90 mb-4">Final Score: {score}/{questions.length}</p>
                    <Button variant="secondary" onClick={generateQuestions}>
                      Try Again
                    </Button>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default MapPractice;
