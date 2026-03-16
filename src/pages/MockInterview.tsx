import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Video, VideoOff, Mic, MicOff, Play, Square, MessageSquare } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import interviewerAvatar from "@/assets/interviewer-avatar.jpg";

type Message = {
  role: "interviewer" | "candidate";
  content: string;
};

const pickIndianMaleVoice = (voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice | undefined => {
  const maleCues = [
    "male",
    "man",
    "rahul",
    "amit",
    "ravi",
    "arjun",
    "prabhat",
    "vijay",
    "aditya",
  ];
  const femaleCues = ["female", "woman", "zira", "susan", "karen", "siri", "priya", "veena"];

  const scoreVoice = (voice: SpeechSynthesisVoice) => {
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    let score = 0;

    if (lang.startsWith("en-in") || lang.includes("en-in")) score += 100;
    else if (lang.startsWith("hi-in") || lang.includes("hi-in")) score += 80;
    else if (lang.startsWith("en")) score += 35;

    if (name.includes("india") || name.includes("indian")) score += 70;
    if (maleCues.some((cue) => name.includes(cue))) score += 45;
    if (femaleCues.some((cue) => name.includes(cue))) score -= 60;
    if (voice.localService) score += 5;

    return score;
  };

  return voices
    .filter((voice) => /^en|^hi/i.test(voice.lang))
    .sort((a, b) => scoreVoice(b) - scoreVoice(a))[0];
};

const UPSC_SYSTEM_PROMPT = `You are the Chairman of a UPSC Civil Services Interview Board. You are conducting a real personality test (interview) of a candidate. 

RULES:
- Ask ONE question at a time. Wait for the candidate's response before asking the next.
- Start with a warm greeting and ask about their background/DAF (Detailed Application Form).
- Cover areas: current affairs, optional subject, hobbies, ethics & integrity, administrative challenges, social issues, Indian polity & governance.
- Ask follow-up questions based on the candidate's answers - make it feel like a real conversation.
- Be polite but probe deeply. Challenge vague answers respectfully.
- After 8-10 exchanges, wrap up the interview naturally and provide brief feedback.
- Keep each question SHORT (1-3 sentences max) - this is spoken aloud.
- Never use markdown formatting, bullet points, or special characters.
- Sound natural and conversational, like a real UPSC chairman would speak.`;

const MockInterview = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [hasPermission, setHasPermission] = useState(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [videoEnabled, setVideoEnabled] = useState(true);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [isStarted, setIsStarted] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isThinking, setIsThinking] = useState(false);
  const [currentTranscript, setCurrentTranscript] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [interviewComplete, setInterviewComplete] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const recognitionRef = useRef<any>(null);
  const synthRef = useRef<SpeechSynthesisUtterance | null>(null);
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const exchangeCount = useRef(0);

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) navigate("/auth");
    };
    checkAuth();
  }, [navigate]);

  useEffect(() => {
    if (stream && videoRef.current) videoRef.current.srcObject = stream;
  }, [stream]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach(t => t.stop());
      recognitionRef.current?.stop();
      window.speechSynthesis.cancel();
    };
  }, [stream]);

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [messages, currentTranscript]);

  const speakText = useCallback((text: string): Promise<void> => {
    return new Promise((resolve) => {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.rate = 0.9;
      utterance.pitch = 0.8;
      utterance.lang = "en-IN";
      
      // Prefer Indian male voice for interview chairman tone
      const voices = window.speechSynthesis.getVoices();
      const indianVoice = pickIndianMaleVoice(voices);
      if (indianVoice) utterance.voice = indianVoice;

      utterance.onstart = () => setIsSpeaking(true);
      utterance.onend = () => { setIsSpeaking(false); resolve(); };
      utterance.onerror = () => { setIsSpeaking(false); resolve(); };
      
      synthRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    });
  }, []);

  const getAIResponse = useCallback(async (conversationHistory: Message[]): Promise<string> => {
    const aiMessages = conversationHistory.map(m => ({
      role: m.role === "interviewer" ? "assistant" : "user",
      content: m.content,
    }));

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
      },
      body: JSON.stringify({
        messages: [{ role: "system", content: UPSC_SYSTEM_PROMPT }, ...aiMessages],
        chatType: "voice-assistant",
      }),
    });

    if (!response.ok) throw new Error("AI response failed");

    const reader = response.body?.getReader();
    if (!reader) throw new Error("No response body");

    let fullText = "";
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value, { stream: true });
      for (const line of chunk.split("\n")) {
        if (!line.startsWith("data: ")) continue;
        const data = line.slice(6).trim();
        if (data === "[DONE]") continue;
        try {
          const parsed = JSON.parse(data);
          const content = parsed.choices?.[0]?.delta?.content;
          if (content) fullText += content;
        } catch {}
      }
    }
    return fullText;
  }, []);

  const requestPermissions = async () => {
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      setStream(mediaStream);
      setHasPermission(true);

      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        recognition.onresult = (event: any) => {
          let transcript = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            transcript += event.results[i][0].transcript;
          }
          setCurrentTranscript(transcript);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }

      // Load voices
      window.speechSynthesis.getVoices();

      toast({ title: "Ready!", description: "Camera and microphone enabled." });
    } catch {
      toast({ title: "Permission Denied", description: "Please allow camera and microphone access.", variant: "destructive" });
    }
  };

  const startInterview = async () => {
    setIsStarted(true);
    setMessages([]);
    setInterviewComplete(false);
    exchangeCount.current = 0;
    setIsThinking(true);

    try {
      const greeting = await getAIResponse([]);
      const newMessages: Message[] = [{ role: "interviewer", content: greeting }];
      setMessages(newMessages);
      setIsThinking(false);
      await speakText(greeting);
    } catch {
      setIsThinking(false);
      toast({ title: "Error", description: "Failed to start interview.", variant: "destructive" });
    }
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening && !isSpeaking) {
      setCurrentTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const submitAnswer = async () => {
    if (!currentTranscript.trim()) {
      toast({ title: "Speak first", description: "Please say your answer before submitting.", variant: "destructive" });
      return;
    }

    recognitionRef.current?.stop();
    setIsListening(false);

    const candidateMsg: Message = { role: "candidate", content: currentTranscript };
    const updatedMessages = [...messages, candidateMsg];
    setMessages(updatedMessages);
    setCurrentTranscript("");
    exchangeCount.current += 1;

    setIsThinking(true);
    try {
      // If enough exchanges, ask AI to wrap up
      let contextMessages = updatedMessages;
      if (exchangeCount.current >= 8) {
        contextMessages = [...updatedMessages, { role: "candidate" as const, content: "[System: This is the last exchange. Please wrap up the interview naturally and give brief feedback with a score out of 200.]" }];
      }

      const aiResponse = await getAIResponse(contextMessages);
      const interviewerMsg: Message = { role: "interviewer", content: aiResponse };
      setMessages(prev => [...prev, interviewerMsg]);
      setIsThinking(false);
      await speakText(aiResponse);

      if (exchangeCount.current >= 8) {
        setInterviewComplete(true);
      }
    } catch {
      setIsThinking(false);
      toast({ title: "Error", description: "Failed to get response.", variant: "destructive" });
    }
  };

  const toggleVideo = () => {
    if (stream) {
      const track = stream.getVideoTracks()[0];
      if (track) { track.enabled = !videoEnabled; setVideoEnabled(!videoEnabled); }
    }
  };

  const toggleAudio = () => {
    if (stream) {
      const track = stream.getAudioTracks()[0];
      if (track) { track.enabled = !audioEnabled; setAudioEnabled(!audioEnabled); }
    }
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
                <Video className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="font-bold text-lg">UPSC Mock Interview</h1>
                <p className="text-xs text-muted-foreground">Real-time Voice Conversation</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6">
        {!hasPermission ? (
          <Card className="p-8 text-center bg-gradient-card border-0 max-w-lg mx-auto">
            <Video className="w-16 h-16 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-bold mb-2">Enable Camera & Mic</h3>
            <p className="text-muted-foreground mb-6">Required for voice-based interview</p>
            <Button onClick={requestPermissions} size="lg">Enable Access</Button>
          </Card>
        ) : (
          <div className="grid lg:grid-cols-5 gap-6">
            {/* Left: Video feeds */}
            <div className="lg:col-span-2 space-y-4">
              {/* Interviewer */}
              <Card className="overflow-hidden border-0 bg-gradient-card">
                <div className="relative aspect-video bg-muted flex items-center justify-center">
                  <img src={interviewerAvatar} alt="UPSC Interview Chairman" className="w-full h-full object-cover" />
                  {isSpeaking && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      <div className="flex gap-0.5">
                        <div className="w-1 h-3 bg-primary rounded-full animate-pulse" />
                        <div className="w-1 h-4 bg-primary rounded-full animate-pulse delay-75" />
                        <div className="w-1 h-2 bg-primary rounded-full animate-pulse delay-150" />
                      </div>
                      <span className="text-xs font-medium">Speaking...</span>
                    </div>
                  )}
                  <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">
                    Chairman - Interview Board
                  </div>
                </div>
              </Card>

              {/* Candidate */}
              <Card className="overflow-hidden border-0">
                <div className="relative aspect-video bg-muted">
                  <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
                  <div className="absolute top-3 left-3 bg-card/90 backdrop-blur-sm px-2 py-1 rounded text-xs font-medium">You</div>
                  {isListening && (
                    <div className="absolute bottom-3 left-3 flex items-center gap-2 bg-destructive/90 px-3 py-1.5 rounded-full">
                      <div className="w-2 h-2 rounded-full bg-white animate-pulse" />
                      <span className="text-xs text-white font-medium">Listening...</span>
                    </div>
                  )}
                  <div className="absolute bottom-3 right-3 flex gap-2">
                    <Button size="icon" variant={videoEnabled ? "secondary" : "destructive"} onClick={toggleVideo} className="rounded-full h-8 w-8">
                      {videoEnabled ? <Video className="w-3.5 h-3.5" /> : <VideoOff className="w-3.5 h-3.5" />}
                    </Button>
                    <Button size="icon" variant={audioEnabled ? "secondary" : "destructive"} onClick={toggleAudio} className="rounded-full h-8 w-8">
                      {audioEnabled ? <Mic className="w-3.5 h-3.5" /> : <MicOff className="w-3.5 h-3.5" />}
                    </Button>
                  </div>
                </div>
              </Card>
            </div>

            {/* Right: Conversation */}
            <div className="lg:col-span-3 flex flex-col">
              <Card className="flex-1 flex flex-col border-0 bg-gradient-card overflow-hidden" style={{ minHeight: "500px" }}>
                {/* Conversation area */}
                <div ref={chatContainerRef} className="flex-1 overflow-y-auto p-4 space-y-4">
                  {!isStarted && !interviewComplete && (
                    <div className="h-full flex items-center justify-center">
                      <div className="text-center">
                        <Avatar className="w-20 h-20 mx-auto mb-4 border-2 border-primary">
                          <AvatarImage src={interviewerAvatar} alt="Interviewer" />
                          <AvatarFallback>IB</AvatarFallback>
                        </Avatar>
                        <h3 className="text-xl font-bold mb-2">UPSC Interview Board</h3>
                        <p className="text-muted-foreground mb-6 max-w-sm">
                          Experience a real UPSC personality test. The AI chairman will ask you questions and respond to your answers conversationally.
                        </p>
                        <Button onClick={startInterview} size="lg" className="gap-2">
                          <Play className="w-4 h-4" /> Begin Interview
                        </Button>
                      </div>
                    </div>
                  )}

                  {messages.map((msg, i) => (
                    <div key={i} className={`flex gap-3 ${msg.role === "candidate" ? "flex-row-reverse" : ""}`}>
                      <Avatar className="w-8 h-8 shrink-0">
                        {msg.role === "interviewer" ? (
                          <>
                            <AvatarImage src={interviewerAvatar} alt="Chairman" />
                            <AvatarFallback>IB</AvatarFallback>
                          </>
                        ) : (
                          <AvatarFallback className="bg-primary text-primary-foreground text-xs">You</AvatarFallback>
                        )}
                      </Avatar>
                      <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                        msg.role === "interviewer"
                          ? "bg-muted text-foreground rounded-tl-sm"
                          : "bg-primary text-primary-foreground rounded-tr-sm"
                      }`}>
                        {msg.content}
                      </div>
                    </div>
                  ))}

                  {isThinking && (
                    <div className="flex gap-3">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarImage src={interviewerAvatar} alt="Chairman" />
                        <AvatarFallback>IB</AvatarFallback>
                      </Avatar>
                      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 flex items-center gap-1">
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce" />
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-100" />
                        <div className="w-2 h-2 bg-muted-foreground/50 rounded-full animate-bounce delay-200" />
                      </div>
                    </div>
                  )}

                  {currentTranscript && isListening && (
                    <div className="flex gap-3 flex-row-reverse">
                      <Avatar className="w-8 h-8 shrink-0">
                        <AvatarFallback className="bg-primary/50 text-primary-foreground text-xs">You</AvatarFallback>
                      </Avatar>
                      <div className="max-w-[80%] rounded-2xl rounded-tr-sm px-4 py-3 text-sm bg-primary/30 text-foreground italic">
                        {currentTranscript}...
                      </div>
                    </div>
                  )}
                </div>

                {/* Controls */}
                {isStarted && !interviewComplete && (
                  <div className="border-t p-4 flex items-center gap-3">
                    {!isListening ? (
                      <Button onClick={startListening} disabled={isSpeaking || isThinking} className="flex-1 gap-2" size="lg">
                        <Mic className="w-5 h-5" />
                        {isSpeaking ? "Chairman is speaking..." : isThinking ? "Thinking..." : "Tap to Speak"}
                      </Button>
                    ) : (
                      <>
                        <Button onClick={() => { recognitionRef.current?.stop(); setIsListening(false); setCurrentTranscript(""); }} variant="outline" size="lg">
                          Cancel
                        </Button>
                        <Button onClick={submitAnswer} className="flex-1 gap-2" size="lg">
                          <MessageSquare className="w-5 h-5" /> Submit Answer
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {interviewComplete && (
                  <div className="border-t p-4 flex gap-3">
                    <Button onClick={() => { setIsStarted(false); setMessages([]); setInterviewComplete(false); }} className="flex-1">
                      New Interview
                    </Button>
                    <Button variant="outline" onClick={() => navigate("/dashboard")}>
                      Dashboard
                    </Button>
                  </div>
                )}
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default MockInterview;
