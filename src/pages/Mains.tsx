import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Send, Loader2, BookOpen, Upload, Image as ImageIcon, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface DailyQuestion {
  id: string;
  question_text: string;
  category: string;
  word_limit: number;
  date: string;
}

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
      const { error: insertError } = await supabase
        .from('mains_submissions')
        .insert({
          user_id: user.id,
          question_id: dailyQuestion.id,
          answer_text: submitMode === "text" ? answer : null,
          answer_image_url: imageUrl,
          word_count: wordCount,
        });

      if (insertError) throw insertError;

      // Get AI evaluation
      const evaluationPrompt = submitMode === "text"
        ? `Evaluate this UPSC Mains answer. Question: "${dailyQuestion.question_text}". Category: ${dailyQuestion.category}. Word limit: ${dailyQuestion.word_limit}. Answer: "${answer}". 

Provide detailed feedback covering:
1. Content Quality (out of 10)
2. Structure & Organization (out of 10)
3. Relevance to Question (out of 10)
4. Use of Examples (out of 10)
5. Overall Presentation (out of 10)

Then give:
- Total Marks: X/50
- Key Strengths (2-3 points)
- Areas for Improvement (2-3 points)
- Specific Suggestions

Be encouraging but constructive.`
        : `The student has submitted an image of their handwritten answer for this UPSC Mains question: "${dailyQuestion.question_text}". Category: ${dailyQuestion.category}. Word limit: ${dailyQuestion.word_limit}.

Since you cannot see the image, provide general feedback on what makes a good UPSC Mains answer:
1. Tips for structure and organization
2. How to answer within word limit
3. Key elements to include for this topic (${dailyQuestion.category})
4. Common mistakes to avoid
5. Presentation tips for handwritten answers

Encourage them to practice more and mention that detailed evaluation requires text input.`;

      // Stream the evaluation
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
          },
          body: JSON.stringify({
            messages: [{ role: "user", content: evaluationPrompt }],
            chatType: "mains_evaluation",
          }),
        }
      );

      if (!response.ok) throw new Error("Failed to get evaluation");

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let accumulatedFeedback = "";

      if (reader) {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const parsed = JSON.parse(data);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) {
                  accumulatedFeedback += content;
                  setFeedback(accumulatedFeedback);
                }
              } catch (e) {
                // Skip invalid JSON
              }
            }
          }
        }
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
                <CardTitle className="text-primary">AI Evaluation & Feedback</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="prose prose-sm max-w-none dark:prose-invert">
                  <div className="whitespace-pre-wrap text-foreground leading-relaxed">
                    {feedback}
                  </div>
                </div>
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