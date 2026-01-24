import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Mic, MicOff, Volume2, VolumeX, Loader2 } from "lucide-react";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const VoiceAI = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const [transcript, setTranscript] = useState("");
  const [currentResponse, setCurrentResponse] = useState("");
  const recognitionRef = useRef<any>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkAuth();
    initSpeechRecognition();
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, currentResponse]);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
    }
  };

  const initSpeechRecognition = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      toast({
        title: "Not Supported",
        description: "Speech recognition is not supported in your browser. Try Chrome.",
        variant: "destructive",
      });
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-IN";

    recognition.onresult = (event: any) => {
      let finalTranscript = "";
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      setTranscript(finalTranscript || interimTranscript);

      if (finalTranscript) {
        handleUserMessage(finalTranscript);
      }
    };

    recognition.onerror = (event: any) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
      if (event.error !== "no-speech") {
        toast({
          title: "Error",
          description: "Could not recognize speech. Please try again.",
          variant: "destructive",
        });
      }
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
  };

  const startListening = () => {
    if (recognitionRef.current && !isListening && !loading) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      setTranscript("");
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  const stopListening = () => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      setIsListening(false);
    }
  };

  const speakText = useCallback((text: string) => {
    if (!window.speechSynthesis) return;

    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 0.95;
    utterance.pitch = 1.0;
    utterance.volume = 1;

    // Try to get a good English voice
    const voices = window.speechSynthesis.getVoices();
    const englishVoice = voices.find(v => v.lang.startsWith("en") && v.name.includes("Google")) 
      || voices.find(v => v.lang.startsWith("en"));
    if (englishVoice) {
      utterance.voice = englishVoice;
    }

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }, []);

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  const handleUserMessage = async (userText: string) => {
    const userMessage: Message = { role: "user", content: userText };
    setMessages((prev) => [...prev, userMessage]);
    setTranscript("");
    setLoading(true);
    setCurrentResponse("");

    try {
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatType: "voice-assistant",
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to get response");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let assistantMessage = "";

      while (reader) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split("\n").filter((line) => line.trim() !== "");

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            if (data === "[DONE]") continue;

            try {
              const parsed = JSON.parse(data);
              const content = parsed.choices?.[0]?.delta?.content;
              if (content) {
                assistantMessage += content;
                setCurrentResponse(assistantMessage);
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Clean the response
      const cleanResponse = assistantMessage
        .replace(/\*\*/g, '')
        .replace(/\*/g, '')
        .replace(/__/g, '')
        .replace(/_/g, '');

      setMessages((prev) => [...prev, { role: "assistant", content: cleanResponse }]);
      setCurrentResponse("");

      // Automatically speak the response
      speakText(cleanResponse);

    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/10 flex flex-col">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="font-bold flex items-center gap-2">
            🎙️ Voice AI Assistant
          </h1>
          <p className="text-xs text-muted-foreground">Ask anything by voice</p>
        </div>
      </header>

      {/* Messages */}
      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && !transcript && (
          <Card className="p-6 text-center bg-gradient-to-br from-primary/10 to-accent/10 border-0">
            <div className="text-4xl mb-3">🎤</div>
            <h2 className="text-xl font-bold mb-2">Talk to AI</h2>
            <p className="text-muted-foreground text-sm mb-4">
              Ask me anything! Try:
            </p>
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>"Explain Article 21 like a story"</p>
              <p>"What is the difference between Lok Sabha and Rajya Sabha?"</p>
              <p>"Tell me about the Green Revolution"</p>
            </div>
          </Card>
        )}

        {messages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <Card
              className={`max-w-[85%] p-4 ${
                msg.role === "user"
                  ? "bg-gradient-primary text-white border-0"
                  : "bg-card"
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
            </Card>
          </div>
        ))}

        {currentResponse && (
          <div className="flex justify-start">
            <Card className="max-w-[85%] p-4 bg-card">
              <p className="text-sm whitespace-pre-wrap">{currentResponse}</p>
            </Card>
          </div>
        )}

        {transcript && (
          <div className="flex justify-end">
            <Card className="max-w-[85%] p-4 bg-primary/20 border-primary/30">
              <p className="text-sm italic text-muted-foreground">🎤 {transcript}...</p>
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Voice Controls */}
      <div className="border-t bg-card/80 backdrop-blur-sm p-6">
        <div className="flex flex-col items-center gap-4">
          {/* Status */}
          <div className="text-sm text-muted-foreground">
            {isListening ? (
              <span className="text-primary animate-pulse">🎤 Listening...</span>
            ) : isSpeaking ? (
              <span className="text-success">🔊 Speaking...</span>
            ) : loading ? (
              <span className="text-warning">💭 Thinking...</span>
            ) : (
              <span>Tap the mic to speak</span>
            )}
          </div>

          {/* Main Controls */}
          <div className="flex items-center gap-4">
            {isSpeaking && (
              <Button
                variant="outline"
                size="icon"
                onClick={stopSpeaking}
                className="w-12 h-12 rounded-full"
              >
                <VolumeX className="w-5 h-5" />
              </Button>
            )}

            <Button
              onClick={isListening ? stopListening : startListening}
              disabled={loading}
              className={`w-20 h-20 rounded-full transition-all ${
                isListening
                  ? "bg-red-500 hover:bg-red-600 scale-110 animate-pulse"
                  : "bg-gradient-primary hover:opacity-90"
              }`}
            >
              {loading ? (
                <Loader2 className="w-8 h-8 animate-spin" />
              ) : isListening ? (
                <MicOff className="w-8 h-8" />
              ) : (
                <Mic className="w-8 h-8" />
              )}
            </Button>

            {isSpeaking && (
              <div className="w-12 h-12 flex items-center justify-center">
                <Volume2 className="w-5 h-5 text-success animate-pulse" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceAI;
