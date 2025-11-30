import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, BookOpen, PenTool } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const mainTopics = [
  { id: 1, topic: "Good Governance", wordLimit: 250, category: "Governance" },
  { id: 2, topic: "Ethics in Public Administration", wordLimit: 250, category: "Ethics" },
  { id: 3, topic: "Science and Technology in India", wordLimit: 250, category: "Science & Tech" },
  { id: 4, topic: "India's Foreign Policy Challenges", wordLimit: 250, category: "International Relations" },
  { id: 5, topic: "Social Justice and Inclusive Growth", wordLimit: 250, category: "Social Issues" },
  { id: 6, topic: "Climate Change and Sustainable Development", wordLimit: 250, category: "Environment" },
];

const Mains = () => {
  const navigate = useNavigate();
  const [selectedTopic, setSelectedTopic] = useState<typeof mainTopics[0] | null>(null);
  const [answer, setAnswer] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    const words = answer.trim().split(/\s+/).filter(word => word.length > 0);
    setWordCount(words.length);
  }, [answer]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const handleSubmitAnswer = async () => {
    if (!selectedTopic || !answer.trim()) {
      toast.error("Please write your answer first");
      return;
    }

    if (wordCount > selectedTopic.wordLimit + 50) {
      toast.error(`Please keep your answer within ${selectedTopic.wordLimit} words (±50)`);
      return;
    }

    setIsSubmitting(true);
    setFeedback("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const response = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `Evaluate this UPSC Mains answer. Topic: "${selectedTopic.topic}". Word limit: ${selectedTopic.wordLimit}. Answer: "${answer}". Provide constructive feedback on content, structure, relevance, and suggest improvements. Be encouraging but honest.`
            }
          ],
          chatType: "mains_evaluation",
        },
      });

      if (response.error) throw response.error;

      setFeedback(response.data.response);
      toast.success("Answer evaluated successfully!");
    } catch (error: any) {
      console.error("Error evaluating answer:", error);
      toast.error("Failed to evaluate answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNew = () => {
    setSelectedTopic(null);
    setAnswer("");
    setWordCount(0);
    setFeedback("");
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Mains Practice
              </h1>
              <p className="text-muted-foreground">Practice essay writing for UPSC Mains</p>
            </div>
          </div>
        </div>

        {!selectedTopic ? (
          <div className="grid md:grid-cols-2 gap-4">
            {mainTopics.map((topic) => (
              <Card 
                key={topic.id} 
                className="cursor-pointer hover:shadow-lg transition-all border-2 hover:border-primary"
                onClick={() => setSelectedTopic(topic)}
              >
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">{topic.topic}</CardTitle>
                      <CardDescription>{topic.category}</CardDescription>
                    </div>
                    <PenTool className="h-5 w-5 text-primary" />
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary">
                      <BookOpen className="h-3 w-3 mr-1" />
                      {topic.wordLimit} words
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>{selectedTopic.topic}</CardTitle>
                    <CardDescription className="mt-2">
                      Category: {selectedTopic.category} • Word Limit: {selectedTopic.wordLimit} words
                    </CardDescription>
                  </div>
                  <Button variant="outline" onClick={handleStartNew}>
                    Change Topic
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="text-sm font-medium">Your Answer</label>
                    <span className={`text-sm ${wordCount > selectedTopic.wordLimit + 50 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                      {wordCount} / {selectedTopic.wordLimit} words
                    </span>
                  </div>
                  <Textarea
                    value={answer}
                    onChange={(e) => setAnswer(e.target.value)}
                    placeholder="Start writing your answer here..."
                    className="min-h-[300px] resize-none"
                    disabled={isSubmitting}
                  />
                </div>

                <Button 
                  onClick={handleSubmitAnswer} 
                  disabled={isSubmitting || !answer.trim()}
                  className="w-full"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Evaluating...
                    </>
                  ) : (
                    <>
                      <Send className="mr-2 h-4 w-4" />
                      Submit for Evaluation
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>

            {feedback && (
              <Card className="border-primary/20">
                <CardHeader>
                  <CardTitle className="text-primary">AI Feedback</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="prose prose-sm max-w-none">
                    <p className="whitespace-pre-wrap text-foreground">{feedback}</p>
                  </div>
                  <Button onClick={handleStartNew} className="mt-4">
                    Practice Another Topic
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Mains;
