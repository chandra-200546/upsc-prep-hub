import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ArrowLeft, CheckCircle, XCircle } from "lucide-react";

const Prelims = () => {
  const [questions, setQuestions] = useState<any[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showResult, setShowResult] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    loadQuestions();
  }, []);

  const loadQuestions = async () => {
    const { data } = await supabase.from("prelims_questions").select("*").limit(10);
    if (data) setQuestions(data);
  };

  const handleAnswer = async (answer: string) => {
    setSelectedAnswer(answer);
    setShowResult(true);
    
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("prelims_attempts").insert({
        user_id: user.id,
        question_id: questions[currentIndex].id,
        selected_answer: answer,
        is_correct: answer === questions[currentIndex].correct_answer,
      });
    }
  };

  const nextQuestion = () => {
    if (currentIndex < questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setSelectedAnswer(null);
      setShowResult(false);
    }
  };

  if (questions.length === 0) return <div className="min-h-screen flex items-center justify-center">Loading...</div>;

  const question = questions[currentIndex];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="font-bold">Prelims Quiz</h1>
          <p className="text-xs text-muted-foreground">Question {currentIndex + 1} of {questions.length}</p>
        </div>
      </header>

      <main className="max-w-3xl mx-auto p-4 py-6">
        <Card className="p-6 mb-4 bg-gradient-card border-0">
          <p className="text-sm text-muted-foreground mb-2">{question.subject} • {question.difficulty}</p>
          <h2 className="text-lg font-semibold mb-6">{question.question}</h2>
          
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
                  <div className="flex items-center gap-3">
                    <span className="font-bold">{opt}.</span>
                    <span>{question[`option_${opt.toLowerCase()}`]}</span>
                    {showResult && isCorrect && <CheckCircle className="ml-auto w-5 h-5 text-success" />}
                    {showResult && isSelected && !isCorrect && <XCircle className="ml-auto w-5 h-5 text-destructive" />}
                  </div>
                </button>
              );
            })}
          </div>

          {showResult && (
            <div className="mt-6 p-4 bg-muted rounded-xl">
              <p className="text-sm font-semibold mb-2">Explanation:</p>
              <p className="text-sm text-muted-foreground">{question.explanation}</p>
            </div>
          )}
        </Card>

        {showResult && (
          <Button onClick={nextQuestion} className="w-full rounded-xl h-12 bg-gradient-primary">
            {currentIndex < questions.length - 1 ? "Next Question" : "Finish Quiz"}
          </Button>
        )}
      </main>
    </div>
  );
};

export default Prelims;