import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  BookOpen, 
  TrendingUp, 
  FileCheck, 
  Calendar, 
  FileText,
  Send,
  Loader2,
  Brain,
  Target,
  CheckCircle,
  AlertCircle,
  Lightbulb,
  GraduationCap
} from "lucide-react";

interface Profile {
  optional_subject: string | null;
}

const OPTIONAL_SUBJECTS = [
  "Anthropology",
  "Geography",
  "Political Science & IR",
  "Sociology",
  "Public Administration",
  "History",
  "Philosophy",
  "Psychology",
  "Economics",
  "Law",
  "Commerce & Accountancy",
  "Medical Science",
  "Mathematics",
  "Physics",
  "Chemistry",
  "Zoology",
  "Botany",
  "Agriculture",
  "Animal Husbandry",
  "Civil Engineering",
  "Electrical Engineering",
  "Mechanical Engineering",
  "Kannada Literature",
  "Hindi Literature",
  "English Literature",
  "Sanskrit Literature",
  "Tamil Literature",
  "Telugu Literature",
  "Marathi Literature",
  "Bengali Literature",
  "Gujarati Literature",
  "Malayalam Literature"
];

export default function OptionalProfessor() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("explain");
  
  // Topic Explanation
  const [topic, setTopic] = useState("");
  const [explanation, setExplanation] = useState<any>(null);
  const [explainLoading, setExplainLoading] = useState(false);
  
  // Trends
  const [trends, setTrends] = useState<any>(null);
  const [trendsLoading, setTrendsLoading] = useState(false);
  
  // Answer Evaluation
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState("");
  const [evaluation, setEvaluation] = useState<any>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  
  // Daily Practice
  const [dailyQuestion, setDailyQuestion] = useState<any>(null);
  const [practiceAnswer, setPracticeAnswer] = useState("");
  const [practiceFeedback, setPracticeFeedback] = useState<any>(null);
  const [practiceLoading, setPracticeLoading] = useState(false);
  
  // Revision
  const [revisionTopic, setRevisionTopic] = useState("");
  const [revisionSheet, setRevisionSheet] = useState<any>(null);
  const [revisionLoading, setRevisionLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/auth");
        return;
      }

      const { data, error } = await supabase
        .from("profiles")
        .select("optional_subject")
        .eq("id", user.id)
        .single();

      if (error) throw error;
      setProfile(data);
      if (data?.optional_subject) {
        setSelectedSubject(data.optional_subject);
      }
    } catch (error) {
      console.error("Error fetching profile:", error);
    } finally {
      setLoading(false);
    }
  };

  const updateOptionalSubject = async (subject: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("profiles")
        .update({ optional_subject: subject })
        .eq("id", user.id);

      if (error) throw error;
      setSelectedSubject(subject);
      setProfile({ ...profile, optional_subject: subject });
      toast.success(`Optional subject set to ${subject}`);
    } catch (error) {
      console.error("Error updating subject:", error);
      toast.error("Failed to update subject");
    }
  };

  const callAI = async (mode: string, payload: any) => {
    const response = await supabase.functions.invoke("optional-professor", {
      body: { mode, subject: selectedSubject, ...payload }
    });
    
    if (response.error) throw response.error;
    return response.data;
  };

  const handleExplainTopic = async () => {
    if (!topic.trim()) {
      toast.error("Please enter a topic");
      return;
    }
    
    setExplainLoading(true);
    setExplanation(null);
    
    try {
      const data = await callAI("explain", { topic });
      setExplanation(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to get explanation");
    } finally {
      setExplainLoading(false);
    }
  };

  const handleGetTrends = async () => {
    setTrendsLoading(true);
    setTrends(null);
    
    try {
      const data = await callAI("trends", {});
      setTrends(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to get trends");
    } finally {
      setTrendsLoading(false);
    }
  };

  const handleEvaluateAnswer = async () => {
    if (!question.trim() || !answer.trim()) {
      toast.error("Please enter both question and answer");
      return;
    }
    
    setEvalLoading(true);
    setEvaluation(null);
    
    try {
      const data = await callAI("evaluate", { question, answer });
      setEvaluation(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to evaluate answer");
    } finally {
      setEvalLoading(false);
    }
  };

  const handleGetDailyPractice = async () => {
    setPracticeLoading(true);
    setDailyQuestion(null);
    setPracticeFeedback(null);
    setPracticeAnswer("");
    
    try {
      const data = await callAI("daily-practice", {});
      setDailyQuestion(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to get practice question");
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleSubmitPractice = async () => {
    if (!practiceAnswer.trim()) {
      toast.error("Please write your answer");
      return;
    }
    
    setPracticeLoading(true);
    
    try {
      const data = await callAI("evaluate", { 
        question: dailyQuestion.question, 
        answer: practiceAnswer 
      });
      setPracticeFeedback(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to evaluate practice answer");
    } finally {
      setPracticeLoading(false);
    }
  };

  const handleGetRevision = async () => {
    if (!revisionTopic.trim()) {
      toast.error("Please enter a topic for revision");
      return;
    }
    
    setRevisionLoading(true);
    setRevisionSheet(null);
    
    try {
      const data = await callAI("revision", { topic: revisionTopic });
      setRevisionSheet(data);
    } catch (error: any) {
      console.error("Error:", error);
      toast.error(error.message || "Failed to generate revision sheet");
    } finally {
      setRevisionLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!selectedSubject) {
    return (
      <div className="min-h-screen bg-background">
        <div className="container mx-auto px-4 py-6 max-w-4xl">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
            className="mb-6"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Dashboard
          </Button>

          <Card className="border-primary/20">
            <CardHeader className="text-center">
              <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                <GraduationCap className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">Select Your Optional Subject</CardTitle>
              <CardDescription>
                Choose your UPSC optional subject to get personalized AI assistance
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {OPTIONAL_SUBJECTS.map((subject) => (
                  <Button
                    key={subject}
                    variant="outline"
                    className="h-auto py-3 px-4 text-left justify-start hover:bg-primary/10 hover:border-primary"
                    onClick={() => updateOptionalSubject(subject)}
                  >
                    {subject}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-6 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate("/dashboard")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <Badge variant="secondary" className="text-sm">
            <GraduationCap className="mr-1 h-3 w-3" />
            {selectedSubject}
          </Badge>
        </div>

        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-2">
            Optional Subject Professor
          </h1>
          <p className="text-muted-foreground">
            Your personalized AI teacher for {selectedSubject}
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid grid-cols-5 w-full">
            <TabsTrigger value="explain" className="flex items-center gap-1">
              <BookOpen className="h-4 w-4" />
              <span className="hidden sm:inline">Explain</span>
            </TabsTrigger>
            <TabsTrigger value="trends" className="flex items-center gap-1">
              <TrendingUp className="h-4 w-4" />
              <span className="hidden sm:inline">Trends</span>
            </TabsTrigger>
            <TabsTrigger value="evaluate" className="flex items-center gap-1">
              <FileCheck className="h-4 w-4" />
              <span className="hidden sm:inline">Evaluate</span>
            </TabsTrigger>
            <TabsTrigger value="practice" className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span className="hidden sm:inline">Practice</span>
            </TabsTrigger>
            <TabsTrigger value="revision" className="flex items-center gap-1">
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">Revision</span>
            </TabsTrigger>
          </TabsList>

          {/* Topic Explanation Tab */}
          <TabsContent value="explain">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  Topic-wise Explanation
                </CardTitle>
                <CardDescription>
                  Get UPSC-oriented explanations with diagrams, examples & case studies
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter topic (e.g., Kinship in Anthropology, Federalism, Geomorphology)"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleExplainTopic()}
                  />
                  <Button onClick={handleExplainTopic} disabled={explainLoading}>
                    {explainLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>

                {explanation && (
                  <ScrollArea className="h-[500px] rounded-lg border p-4">
                    <div className="space-y-6">
                      <div>
                        <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                          <Brain className="h-5 w-5 text-primary" />
                          Concept Overview
                        </h3>
                        <p className="text-muted-foreground whitespace-pre-wrap">{explanation.overview}</p>
                      </div>

                      {explanation.keyPoints && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">Key Points</h3>
                          <ul className="space-y-2">
                            {explanation.keyPoints.map((point: string, i: number) => (
                              <li key={i} className="flex items-start gap-2">
                                <CheckCircle className="h-4 w-4 text-green-500 mt-1 flex-shrink-0" />
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {explanation.examples && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                            <Lightbulb className="h-5 w-5 text-yellow-500" />
                            Examples & Case Studies
                          </h3>
                          <div className="space-y-2">
                            {explanation.examples.map((ex: string, i: number) => (
                              <div key={i} className="bg-muted/50 rounded-lg p-3">
                                <p>{ex}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {explanation.upscRelevance && (
                        <div className="bg-primary/10 rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-2 flex items-center gap-2">
                            <Target className="h-5 w-5 text-primary" />
                            UPSC Relevance
                          </h3>
                          <p>{explanation.upscRelevance}</p>
                        </div>
                      )}

                      {explanation.diagram && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">Diagram/Structure</h3>
                          <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap">
                            {explanation.diagram}
                          </pre>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Trends Tab */}
          <TabsContent value="trends">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  PYQ Trends Analysis
                </CardTitle>
                <CardDescription>
                  40 years of question patterns, predictions & high-probability topics
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button onClick={handleGetTrends} disabled={trendsLoading} className="w-full">
                  {trendsLoading ? (
                    <>
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                      Analyzing Trends...
                    </>
                  ) : (
                    <>
                      <TrendingUp className="mr-2 h-4 w-4" />
                      Analyze PYQ Trends
                    </>
                  )}
                </Button>

                {trends && (
                  <ScrollArea className="h-[500px] rounded-lg border p-4">
                    <div className="space-y-6">
                      {trends.recurringTopics && (
                        <div>
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Target className="h-5 w-5 text-green-500" />
                            Recurring High-Frequency Topics
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {trends.recurringTopics.map((topic: string, i: number) => (
                              <Badge key={i} variant="secondary" className="bg-green-500/10 text-green-700">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {trends.predictions && (
                        <div>
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <Brain className="h-5 w-5 text-primary" />
                            High-Probability Questions (2025)
                          </h3>
                          <div className="space-y-2">
                            {trends.predictions.map((pred: string, i: number) => (
                              <div key={i} className="bg-primary/10 rounded-lg p-3 flex items-start gap-2">
                                <AlertCircle className="h-4 w-4 text-primary mt-1 flex-shrink-0" />
                                <span>{pred}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {trends.ignoredTopics && (
                        <div>
                          <h3 className="font-semibold text-lg mb-3 flex items-center gap-2">
                            <AlertCircle className="h-5 w-5 text-orange-500" />
                            Topics Ignored Recently (Likely to Appear)
                          </h3>
                          <div className="flex flex-wrap gap-2">
                            {trends.ignoredTopics.map((topic: string, i: number) => (
                              <Badge key={i} variant="outline" className="border-orange-500 text-orange-600">
                                {topic}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {trends.yearWiseBreakdown && (
                        <div>
                          <h3 className="font-semibold text-lg mb-3">Year-wise Topic Frequency</h3>
                          <div className="space-y-2">
                            {trends.yearWiseBreakdown.map((item: any, i: number) => (
                              <div key={i} className="flex justify-between items-center bg-muted/50 rounded-lg p-3">
                                <span className="font-medium">{item.topic}</span>
                                <Badge>{item.frequency} times</Badge>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {trends.strategy && (
                        <div className="bg-muted rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-2">Preparation Strategy</h3>
                          <p className="whitespace-pre-wrap">{trends.strategy}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Answer Evaluation Tab */}
          <TabsContent value="evaluate">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileCheck className="h-5 w-5 text-primary" />
                  Answer Evaluation Coach
                </CardTitle>
                <CardDescription>
                  Get detailed scoring on structure, content, examples & presentation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium mb-2 block">Question</label>
                    <Textarea
                      placeholder="Enter the question..."
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      rows={2}
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium mb-2 block">Your Answer</label>
                    <Textarea
                      placeholder="Write or paste your answer here..."
                      value={answer}
                      onChange={(e) => setAnswer(e.target.value)}
                      rows={8}
                    />
                  </div>
                  <Button onClick={handleEvaluateAnswer} disabled={evalLoading} className="w-full">
                    {evalLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Evaluating...
                      </>
                    ) : (
                      <>
                        <FileCheck className="mr-2 h-4 w-4" />
                        Evaluate Answer
                      </>
                    )}
                  </Button>
                </div>

                {evaluation && (
                  <div className="space-y-4 mt-6">
                    <div className="flex items-center justify-center gap-4 p-4 bg-primary/10 rounded-lg">
                      <div className="text-center">
                        <p className="text-4xl font-bold text-primary">{evaluation.score}</p>
                        <p className="text-sm text-muted-foreground">out of 20</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {evaluation.breakdown && Object.entries(evaluation.breakdown).map(([key, value]: [string, any]) => (
                        <div key={key} className="bg-muted/50 rounded-lg p-3 text-center">
                          <p className="text-lg font-semibold">{value}/5</p>
                          <p className="text-xs text-muted-foreground capitalize">{key}</p>
                        </div>
                      ))}
                    </div>

                    {evaluation.strengths && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-green-600">
                          <CheckCircle className="h-4 w-4" />
                          Strengths
                        </h4>
                        <ul className="space-y-1">
                          {evaluation.strengths.map((s: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.improvements && (
                      <div>
                        <h4 className="font-semibold mb-2 flex items-center gap-2 text-orange-600">
                          <AlertCircle className="h-4 w-4" />
                          Areas to Improve
                        </h4>
                        <ul className="space-y-1">
                          {evaluation.improvements.map((s: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">• {s}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {evaluation.modelAnswer && (
                      <div className="bg-muted rounded-lg p-4">
                        <h4 className="font-semibold mb-2">Model Answer Approach</h4>
                        <p className="text-sm whitespace-pre-wrap">{evaluation.modelAnswer}</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Daily Practice Tab */}
          <TabsContent value="practice">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  Daily Practice
                </CardTitle>
                <CardDescription>
                  Practice with AI-generated questions and get instant feedback
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!dailyQuestion ? (
                  <Button onClick={handleGetDailyPractice} disabled={practiceLoading} className="w-full">
                    {practiceLoading ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Generating Question...
                      </>
                    ) : (
                      <>
                        <Calendar className="mr-2 h-4 w-4" />
                        Get Today's Practice Question
                      </>
                    )}
                  </Button>
                ) : (
                  <div className="space-y-4">
                    <div className="bg-primary/10 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge>{dailyQuestion.type || "Long Answer"}</Badge>
                        <Badge variant="outline">{dailyQuestion.marks || 20} marks</Badge>
                      </div>
                      <p className="font-medium">{dailyQuestion.question}</p>
                      {dailyQuestion.hint && (
                        <p className="text-sm text-muted-foreground mt-2">
                          <Lightbulb className="inline h-3 w-3 mr-1" />
                          Hint: {dailyQuestion.hint}
                        </p>
                      )}
                    </div>

                    {!practiceFeedback && (
                      <>
                        <Textarea
                          placeholder="Write your answer here..."
                          value={practiceAnswer}
                          onChange={(e) => setPracticeAnswer(e.target.value)}
                          rows={10}
                        />
                        <div className="flex gap-2">
                          <Button onClick={handleSubmitPractice} disabled={practiceLoading} className="flex-1">
                            {practiceLoading ? (
                              <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Evaluating...
                              </>
                            ) : (
                              <>
                                <Send className="mr-2 h-4 w-4" />
                                Submit Answer
                              </>
                            )}
                          </Button>
                          <Button variant="outline" onClick={handleGetDailyPractice}>
                            New Question
                          </Button>
                        </div>
                      </>
                    )}

                    {practiceFeedback && (
                      <div className="space-y-4">
                        <div className="flex items-center justify-center gap-4 p-4 bg-primary/10 rounded-lg">
                          <div className="text-center">
                            <p className="text-4xl font-bold text-primary">{practiceFeedback.score}</p>
                            <p className="text-sm text-muted-foreground">out of {dailyQuestion.marks || 20}</p>
                          </div>
                        </div>

                        {practiceFeedback.feedback && (
                          <div className="bg-muted rounded-lg p-4">
                            <h4 className="font-semibold mb-2">Detailed Feedback</h4>
                            <p className="text-sm whitespace-pre-wrap">{practiceFeedback.feedback}</p>
                          </div>
                        )}

                        <Button onClick={handleGetDailyPractice} className="w-full">
                          Try Another Question
                        </Button>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Revision Tab */}
          <TabsContent value="revision">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-primary" />
                  Rapid Revision Sheets
                </CardTitle>
                <CardDescription>
                  Auto-generated revision notes, mind maps & last-minute summaries
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    placeholder="Enter topic for revision sheet (e.g., Kinship Systems, Indian Monsoon)"
                    value={revisionTopic}
                    onChange={(e) => setRevisionTopic(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleGetRevision()}
                  />
                  <Button onClick={handleGetRevision} disabled={revisionLoading}>
                    {revisionLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
                  </Button>
                </div>

                {revisionSheet && (
                  <ScrollArea className="h-[500px] rounded-lg border p-4">
                    <div className="space-y-6">
                      <div className="text-center bg-primary/10 rounded-lg p-4">
                        <h2 className="text-xl font-bold">{revisionSheet.topic}</h2>
                        <p className="text-sm text-muted-foreground">Quick Revision Sheet</p>
                      </div>

                      {revisionSheet.keyPoints && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">🔑 Key Points</h3>
                          <ul className="space-y-2">
                            {revisionSheet.keyPoints.map((point: string, i: number) => (
                              <li key={i} className="flex items-start gap-2 bg-muted/50 rounded p-2">
                                <span className="font-semibold text-primary">{i + 1}.</span>
                                <span>{point}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {revisionSheet.mindMap && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">🧠 Mind Map</h3>
                          <pre className="bg-muted rounded-lg p-4 text-sm overflow-x-auto whitespace-pre-wrap font-mono">
                            {revisionSheet.mindMap}
                          </pre>
                        </div>
                      )}

                      {revisionSheet.oneLiners && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">📝 One-Liners</h3>
                          <div className="space-y-1">
                            {revisionSheet.oneLiners.map((line: string, i: number) => (
                              <p key={i} className="text-sm bg-yellow-500/10 rounded px-3 py-2">
                                • {line}
                              </p>
                            ))}
                          </div>
                        </div>
                      )}

                      {revisionSheet.importantFacts && (
                        <div>
                          <h3 className="font-semibold text-lg mb-2">📊 Important Facts & Figures</h3>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {revisionSheet.importantFacts.map((fact: string, i: number) => (
                              <div key={i} className="bg-muted rounded p-2 text-sm">
                                {fact}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {revisionSheet.pyqConnection && (
                        <div className="bg-primary/10 rounded-lg p-4">
                          <h3 className="font-semibold text-lg mb-2">🎯 PYQ Connections</h3>
                          <p className="text-sm whitespace-pre-wrap">{revisionSheet.pyqConnection}</p>
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <div className="mt-6 text-center">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setSelectedSubject("");
              setProfile({ ...profile, optional_subject: null });
            }}
          >
            Change Optional Subject
          </Button>
        </div>
      </div>
    </div>
  );
}
