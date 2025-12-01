import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Play, Square } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";

const MockInterview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isRecording, setIsRecording] = useState(false);
  const [hasPermission, setHasPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [currentQuestion, setCurrentQuestion] = useState<string>("");
  const [questionIndex, setQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<string[]>([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [interviewComplete, setInterviewComplete] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [loadingFeedback, setLoadingFeedback] = useState(false);
  
  const videoRef = useRef<HTMLVideoElement>(null);

  const interviewQuestions = [
    "Tell us about yourself and your background.",
    "Why do you want to join the civil services?",
    "What are your strengths and weaknesses?",
    "Describe a challenging situation you faced and how you handled it.",
    "What is your vision for India in the next 10 years?",
  ];

  useEffect(() => {
    checkAuth();
  }, []);

  useEffect(() => {
    if (stream && videoRef.current) {
      videoRef.current.srcObject = stream;
    }
  }, [stream]);

  const checkAuth = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      navigate("/auth");
    }
  };

  const requestPermissions = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });
      setStream(mediaStream);
      setHasPermission(true);
      toast({
        title: "Camera Access Granted",
        description: "You can now start the mock interview.",
      });
    } catch (error) {
      console.error("Error accessing media devices:", error);
      toast({
        title: "Permission Denied",
        description: "Please allow camera and microphone access to continue.",
        variant: "destructive",
      });
    }
  };

  const startInterview = () => {
    if (!hasPermission) {
      toast({
        title: "Camera Required",
        description: "Please enable camera access first.",
        variant: "destructive",
      });
      return;
    }
    setIsRecording(true);
    setCurrentQuestion(interviewQuestions[0]);
    setQuestionIndex(0);
    setAnswers([]);
    setInterviewComplete(false);
    setFeedback("");
  };

  const nextQuestion = () => {
    if (currentAnswer.trim()) {
      setAnswers([...answers, currentAnswer]);
      setCurrentAnswer("");
      
      if (questionIndex < interviewQuestions.length - 1) {
        setQuestionIndex(questionIndex + 1);
        setCurrentQuestion(interviewQuestions[questionIndex + 1]);
      } else {
        finishInterview([...answers, currentAnswer]);
      }
    } else {
      toast({
        title: "Answer Required",
        description: "Please provide an answer before moving to the next question.",
        variant: "destructive",
      });
    }
  };

  const finishInterview = async (finalAnswers: string[]) => {
    setIsRecording(false);
    setInterviewComplete(true);
    setLoadingFeedback(true);

    try {
      const interviewTranscript = interviewQuestions
        .map((q, i) => `Q${i + 1}: ${q}\nA${i + 1}: ${finalAnswers[i] || "No answer provided"}`)
        .join("\n\n");

      const { data, error } = await supabase.functions.invoke("ai-chat", {
        body: {
          messages: [
            {
              role: "user",
              content: `You are an expert UPSC interview panel member. Analyze this mock interview and provide comprehensive feedback:\n\n${interviewTranscript}\n\nProvide feedback on:\n1. Communication skills\n2. Content depth and knowledge\n3. Confidence and body language\n4. Areas of improvement\n5. Overall rating (out of 10)\n\nBe constructive and specific.`
            }
          ],
          chatType: "assistant",
        },
      });

      if (error) throw error;
      setFeedback(data.generatedText || "Feedback generation failed.");
    } catch (error) {
      console.error("Error generating feedback:", error);
      toast({
        title: "Error",
        description: "Failed to generate feedback. Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoadingFeedback(false);
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const videoTrack = stream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoEnabled;
        setVideoEnabled(!videoEnabled);
      }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioEnabled;
        setAudioEnabled(!audioEnabled);
      }
    }
  };

  const stopCamera = () => {
    if (stream) {
      stream.getTracks().forEach(track => track.stop());
      setStream(null);
      setHasPermission(false);
    }
  };

  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [stream]);

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
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">AI Mock Interview</h1>
                <p className="text-xs text-muted-foreground">Practice with AI Feedback</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {/* Video Preview */}
        <Card className="overflow-hidden bg-gradient-card border-0">
          <div className="aspect-video bg-muted relative">
            {hasPermission ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <div className="text-center">
                  <Video className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">Camera access required</p>
                </div>
              </div>
            )}
            
            {/* Camera Controls */}
            {hasPermission && (
              <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-3">
                <Button
                  size="icon"
                  variant={videoEnabled ? "default" : "destructive"}
                  onClick={toggleVideo}
                  className="rounded-full"
                >
                  {videoEnabled ? <Video className="w-5 h-5" /> : <VideoOff className="w-5 h-5" />}
                </Button>
                <Button
                  size="icon"
                  variant={audioEnabled ? "default" : "destructive"}
                  onClick={toggleAudio}
                  className="rounded-full"
                >
                  {audioEnabled ? <Mic className="w-5 h-5" /> : <MicOff className="w-5 h-5" />}
                </Button>
              </div>
            )}
          </div>
        </Card>

        {/* Interview Content */}
        {!hasPermission && !interviewComplete && (
          <Card className="p-8 text-center bg-gradient-card border-0">
            <Video className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Enable Camera Access</h3>
            <p className="text-muted-foreground mb-6">
              Camera and microphone access is required for the mock interview
            </p>
            <Button onClick={requestPermissions} size="lg">
              Enable Camera & Microphone
            </Button>
          </Card>
        )}

        {hasPermission && !isRecording && !interviewComplete && (
          <Card className="p-8 text-center bg-gradient-card border-0">
            <Play className="w-16 h-16 mx-auto mb-4 text-success" />
            <h3 className="text-xl font-bold mb-2">Ready to Start?</h3>
            <p className="text-muted-foreground mb-6">
              You will be asked {interviewQuestions.length} questions. Answer thoughtfully and professionally.
            </p>
            <Button onClick={startInterview} size="lg">
              Start Interview
            </Button>
          </Card>
        )}

        {isRecording && (
          <Card className="p-8 bg-gradient-card border-0">
            <div className="space-y-6">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm text-muted-foreground">
                    Question {questionIndex + 1} of {interviewQuestions.length}
                  </span>
                  <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-destructive animate-pulse" />
                    <span className="text-sm font-medium">Recording</span>
                  </div>
                </div>
                <h3 className="text-2xl font-bold mb-6">{currentQuestion}</h3>
              </div>

              <div className="space-y-4">
                <label className="text-sm font-medium">Your Answer:</label>
                <Textarea
                  value={currentAnswer}
                  onChange={(e) => setCurrentAnswer(e.target.value)}
                  placeholder="Type your answer here... (simulating voice transcription)"
                  className="min-h-[150px]"
                />
              </div>

              <div className="flex justify-end gap-3">
                {questionIndex === interviewQuestions.length - 1 ? (
                  <Button onClick={nextQuestion} size="lg" className="gap-2">
                    <Square className="w-4 h-4" />
                    Finish Interview
                  </Button>
                ) : (
                  <Button onClick={nextQuestion} size="lg">
                    Next Question
                  </Button>
                )}
              </div>
            </div>
          </Card>
        )}

        {interviewComplete && (
          <Card className="p-8 bg-gradient-card border-0">
            <h3 className="text-2xl font-bold mb-6">Interview Feedback</h3>
            
            {loadingFeedback ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                <p className="text-muted-foreground">Analyzing your performance...</p>
              </div>
            ) : (
              <div className="space-y-6">
                <div className="prose prose-sm max-w-none">
                  <div className="whitespace-pre-wrap text-foreground">{feedback}</div>
                </div>
                
                <div className="flex gap-3 pt-6 border-t">
                  <Button onClick={() => {
                    setInterviewComplete(false);
                    setAnswers([]);
                    setQuestionIndex(0);
                    setCurrentAnswer("");
                  }}>
                    Try Again
                  </Button>
                  <Button variant="outline" onClick={() => navigate("/dashboard")}>
                    Back to Dashboard
                  </Button>
                </div>
              </div>
            )}
          </Card>
        )}
      </main>
    </div>
  );
};

export default MockInterview;
