import { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, BookOpen, Upload, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { streamOpenAIText } from "@/lib/openai-client";

interface DailyQuestion {
  id: string;
  question_text: string;
  category: string;
  word_limit: number;
  date: string;
}

interface ScoreSection {
  title: string;
  score: number;
  maxScore: number;
}

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

const extractTotalMarks = (text: string): number | null => {
  const cleaned = cleanFeedbackText(text);
  const totalMatch = cleaned.match(/Total\s*Marks\s*[:\-]?\s*(\d+)\s*\/\s*(\d+)/i);
  if (!totalMatch) return null;
  const marks = Number(totalMatch[1]);
  return Number.isNaN(marks) ? null : marks;
};

const Mains = () => {
  const navigate = useNavigate();
  const [dailyQuestion, setDailyQuestion] = useState<DailyQuestion | null>(null);
  const [answer, setAnswer] = useState("");
  const [wordCount, setWordCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingQuestion, setIsLoadingQuestion] = useState(true);
  const [feedback, setFeedback] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitMode, setSubmitMode] = useState<"text" | "image">("text");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const parsedFeedback = useMemo(() => {
    const cleaned = cleanFeedbackText(feedback);
    const sectionScores = SCORE_SECTION_TITLES
      .map((title) => extractSectionScore(cleaned, title))
      .filter((section): section is ScoreSection => section !== null);

    const totalMatch = cleaned.match(/Total\s*Marks\s*[:\-]?\s*(\d+)\s*\/\s*(\d+)/i);
    const totalScore = totalMatch ? Number(totalMatch[1]) : null;
    const totalMax = totalMatch ? Number(totalMatch[2]) : null;

    return {
      cleaned,
      sectionScores,
      totalScore,
      totalMax,
      strengths: parseLabeledSection(cleaned, "Key Strengths"),
      improvements: parseLabeledSection(cleaned, "Areas for Improvement"),
      suggestions: parseLabeledSection(cleaned, "Specific Suggestions"),
      summary: parseLabeledSection(cleaned, "Overall Summary"),
    };
  }, [feedback]);

  const allSectionsPassed =
    parsedFeedback.sectionScores.length > 0 &&
    parsedFeedback.sectionScores.every((section) => section.score >= Math.ceil(section.maxScore * 0.6));

  useEffect(() => {
    checkAuth();
    fetchDailyQuestion();
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

  const fetchDailyQuestion = async () => {
    try {
      setIsLoadingQuestion(true);
      const { data, error } = await supabase.functions.invoke("mains-question");
      
      if (error) throw error;
      
      setDailyQuestion(data);
    } catch (error: any) {
      console.error("Error fetching daily question:", error);
      toast.error("Failed to load today's question");
    } finally {
      setIsLoadingQuestion(false);
    }
  };

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Image size should be less than 5MB");
        return;
      }
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (userId: string): Promise<string | null> => {
    if (!imageFile) return null;

    try {
      const fileExt = imageFile.name.split('.').pop();
      const fileName = `${userId}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from('mains-answers')
        .upload(fileName, imageFile);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('mains-answers')
        .getPublicUrl(fileName);

      return publicUrl;
    } catch (error) {
      console.error("Error uploading image:", error);
      toast.error("Failed to upload image");
      return null;
    }
  };

  const handleSubmitAnswer = async () => {
    if (!dailyQuestion) {
      toast.error("No question loaded");
      return;
    }

    if (submitMode === "text" && !answer.trim()) {
      toast.error("Please write your answer first");
      return;
    }

    if (submitMode === "image" && !imageFile) {
      toast.error("Please select an image to upload");
      return;
    }

    if (submitMode === "text" && wordCount > dailyQuestion.word_limit + 50) {
      toast.error(`Please keep your answer within ${dailyQuestion.word_limit} words (±50)`);
      return;
    }

    setIsSubmitting(true);
    setFeedback("");

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      let imageUrl: string | null = null;
      if (submitMode === "image") {
        imageUrl = await uploadImage(user.id);
        if (!imageUrl) throw new Error("Failed to upload image");
      }

      // Store submission in database
      const { data: insertedSubmission, error: insertError } = await supabase
        .from('mains_submissions')
        .insert({
          user_id: user.id,
          question_id: dailyQuestion.id,
          answer_text: submitMode === "text" ? answer : null,
          answer_image_url: imageUrl,
          word_count: wordCount,
        })
        .select("id")
        .single();

      if (insertError) throw insertError;

      // Get AI evaluation
      const evaluationPrompt = submitMode === "text"
        ? `Evaluate this UPSC Mains answer. Question: "${dailyQuestion.question_text}". Category: ${dailyQuestion.category}. Word limit: ${dailyQuestion.word_limit}. Answer: "${answer}". 

Return the evaluation in this exact plain-text template with NO markdown symbols (#, *, -, bullets):
Content Quality: X/10
Structure & Organization: X/10
Relevance to Question: X/10
Use of Examples: X/10
Overall Presentation: X/10
Total Marks: X/50
Overall Summary: 2-3 lines in a friendly tone
Key Strengths: 2-3 short points in one paragraph
Areas for Improvement: 2-3 short points in one paragraph
Specific Suggestions: 3-4 actionable suggestions in one paragraph

Be encouraging but constructive.`
        : `The student has submitted an image of their handwritten answer for this UPSC Mains question: "${dailyQuestion.question_text}". Category: ${dailyQuestion.category}. Word limit: ${dailyQuestion.word_limit}.

Since you cannot see the image, provide general feedback on what makes a good UPSC Mains answer:
1. Tips for structure and organization
2. How to answer within word limit
3. Key elements to include for this topic (${dailyQuestion.category})
4. Common mistakes to avoid
5. Presentation tips for handwritten answers

Encourage them to practice more and mention that detailed evaluation requires text input.
Use plain text only and avoid markdown symbols.`;

      let accumulatedFeedback = "";
      await streamOpenAIText({
        messages: [
          {
            role: "system",
            content:
              "You are a strict but supportive UPSC mains evaluator. Return plain text only in requested format.",
          },
          { role: "user", content: evaluationPrompt },
        ],
        onDelta: (content) => {
          accumulatedFeedback += content;
          setFeedback(accumulatedFeedback);
        },
      });

      if (insertedSubmission?.id) {
        const extractedMarks = submitMode === "text" ? extractTotalMarks(accumulatedFeedback) : null;
        await supabase
          .from("mains_submissions")
          .update({
            evaluation: accumulatedFeedback || null,
            marks: extractedMarks,
          })
          .eq("id", insertedSubmission.id);
      }

      toast.success("Answer submitted and evaluated!");
    } catch (error: any) {
      console.error("Error submitting answer:", error);
      toast.error("Failed to submit answer");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartNew = () => {
    setAnswer("");
    setWordCount(0);
    setFeedback("");
    setImageFile(null);
    setImagePreview(null);
    setSubmitMode("text");
  };

  if (isLoadingQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading today's question...</p>
        </div>
      </div>
    );
  }

  if (!dailyQuestion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20 flex items-center justify-center">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>No Question Available</CardTitle>
            <CardDescription>Unable to load today's question</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={fetchDailyQuestion} className="w-full">
              <RefreshCw className="mr-2 h-4 w-4" />
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

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
              <p className="text-muted-foreground">Today's question • Practice essay writing</p>
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-xl mb-3">{dailyQuestion.question_text}</CardTitle>
                  <div className="flex gap-2">
                    <Badge variant="secondary">
                      {dailyQuestion.category}
                    </Badge>
                    <Badge variant="outline">
                      <BookOpen className="h-3 w-3 mr-1" />
                      {dailyQuestion.word_limit} words
                    </Badge>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <Tabs value={submitMode} onValueChange={(v) => setSubmitMode(v as "text" | "image")}>
                <TabsList className="grid w-full grid-cols-2">
                  <TabsTrigger value="text">Write Answer</TabsTrigger>
                  <TabsTrigger value="image">Upload Image</TabsTrigger>
                </TabsList>

                <TabsContent value="text" className="space-y-4">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="text-sm font-medium">Your Answer</label>
                      <span className={`text-sm ${wordCount > dailyQuestion.word_limit + 50 ? 'text-destructive font-semibold' : 'text-muted-foreground'}`}>
                        {wordCount} / {dailyQuestion.word_limit} words
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
                </TabsContent>

                <TabsContent value="image" className="space-y-4">
                  <div className="border-2 border-dashed rounded-lg p-8 text-center">
                    {imagePreview ? (
                      <div className="space-y-4">
                        <img
                          src={imagePreview}
                          alt="Answer preview"
                          className="max-h-96 mx-auto rounded-lg"
                        />
                        <Button
                          variant="outline"
                          onClick={() => {
                            setImageFile(null);
                            setImagePreview(null);
                          }}
                        >
                          Remove Image
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <ImageIcon className="h-12 w-12 mx-auto text-muted-foreground" />
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">
                            Upload a photo of your handwritten answer
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Max file size: 5MB • Supported: JPG, PNG
                          </p>
                        </div>
                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <Upload className="mr-2 h-4 w-4" />
                          Select Image
                        </Button>
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                      </div>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <Button 
                onClick={handleSubmitAnswer} 
                disabled={isSubmitting || (submitMode === "text" ? !answer.trim() : !imageFile)}
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
                <CardTitle className="text-slate-900 dark:text-slate-100">AI Evaluation & Feedback</CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                {parsedFeedback.sectionScores.length > 0 && (
                  <div className="space-y-3">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Section-wise Marks</h3>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {parsedFeedback.sectionScores.map((section) => {
                        const passMark = Math.ceil(section.maxScore * 0.6);
                        const passed = section.score >= passMark;
                        return (
                          <div
                            key={section.title}
                            className="rounded-lg border p-3 flex items-center justify-between bg-card"
                          >
                            <span className="text-sm font-medium text-slate-900 dark:text-slate-100">{section.title}</span>
                            <span className={`text-sm font-semibold ${passed ? "text-green-600" : "text-red-600"}`}>
                              {section.score}/{section.maxScore}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {parsedFeedback.totalScore !== null && parsedFeedback.totalMax !== null && (
                  <div className="rounded-lg border p-4 bg-secondary/20 flex items-center justify-between">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Total Marks</h3>
                    <span
                      className={`text-lg font-bold ${
                        (parsedFeedback.sectionScores.length > 0
                          ? allSectionsPassed
                          : parsedFeedback.totalScore >= Math.ceil(parsedFeedback.totalMax * 0.6))
                          ? "text-green-600"
                          : "text-red-600"
                      }`}
                    >
                      {parsedFeedback.totalScore}/{parsedFeedback.totalMax}
                    </span>
                  </div>
                )}

                {parsedFeedback.summary && (
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Overall Summary</h3>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{parsedFeedback.summary}</p>
                  </div>
                )}

                {parsedFeedback.strengths && (
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Key Strengths</h3>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{parsedFeedback.strengths}</p>
                  </div>
                )}

                {parsedFeedback.improvements && (
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Areas for Improvement</h3>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{parsedFeedback.improvements}</p>
                  </div>
                )}

                {parsedFeedback.suggestions && (
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Specific Suggestions</h3>
                    <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">{parsedFeedback.suggestions}</p>
                  </div>
                )}

                {parsedFeedback.cleaned && parsedFeedback.sectionScores.length === 0 && !parsedFeedback.summary && (
                  <div className="space-y-1">
                    <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Feedback</h3>
                    <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-700 dark:text-slate-300">
                      {parsedFeedback.cleaned}
                    </p>
                  </div>
                )}

                <Button onClick={handleStartNew} className="mt-6">
                  Practice Again
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
};

export default Mains;
