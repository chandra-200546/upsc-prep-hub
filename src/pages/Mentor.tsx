import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, Loader2, Mic } from "lucide-react";
import { useVoiceSynthesis } from "@/hooks/use-voice-synthesis";
import { VoiceControls, AutoPlayToggle } from "@/components/VoiceControls";

type Message = {
  role: "user" | "assistant";
  content: string;
};

const Mentor = () => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [profile, setProfile] = useState<any>(null);
  const [speakingMessageIdx, setSpeakingMessageIdx] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const voice = useVoiceSynthesis();

  useEffect(() => {
    loadProfile();
    loadMessages();
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const loadProfile = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      navigate("/auth");
      return;
    }

    const { data } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", user.id)
      .single();

    setProfile(data);
  };

  const loadMessages = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("user_id", user.id)
      .eq("chat_type", "mentor")
      .order("created_at", { ascending: true })
      .limit(50);

    if (data) {
      const formattedMessages = data
        .filter((msg) => msg.role !== "system")
        .map((msg) => ({
          role: msg.role as "user" | "assistant",
          content: msg.content,
        }));
      setMessages(formattedMessages);
    }
  };

  const sendMessage = async () => {
    if (!input.trim() || loading) return;

    const userMessage: Message = { role: "user", content: input };
    setMessages((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user");

      // Save user message
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        chat_type: "mentor",
        role: "user",
        content: input,
      });

      // Call AI
      const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-chat`;
      const response = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          messages: [...messages, userMessage],
          chatType: "mentor",
          mentorPersonality: profile?.mentor_personality || "friendly",
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
                setMessages((prev) => {
                  const newMessages = [...prev];
                  const lastMessage = newMessages[newMessages.length - 1];
                  if (lastMessage?.role === "assistant") {
                    lastMessage.content = assistantMessage;
                  } else {
                    newMessages.push({ role: "assistant", content: assistantMessage });
                  }
                  return newMessages;
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }

      // Save assistant message
      await supabase.from("chat_messages").insert({
        user_id: user.id,
        chat_type: "mentor",
        role: "assistant",
        content: assistantMessage,
      });

      // Auto-play voice if enabled
      if (voice.autoPlay && assistantMessage) {
        const cleanText = assistantMessage.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
        voice.speak(cleanText, profile?.mentor_personality || "friendly");
      }
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

  const handleSpeakMessage = (idx: number, content: string) => {
    if (speakingMessageIdx === idx && voice.isSpeaking) {
      voice.stop();
      setSpeakingMessageIdx(null);
    } else {
      const cleanText = content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '');
      voice.speak(cleanText, profile?.mentor_personality || "friendly");
      setSpeakingMessageIdx(idx);
    }
  };

  // Reset speaking index when speech ends
  useEffect(() => {
    if (!voice.isSpeaking) {
      setSpeakingMessageIdx(null);
    }
  }, [voice.isSpeaking]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20 flex flex-col">
      <header className="bg-card/80 backdrop-blur-sm border-b px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")} className="rounded-full">
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="font-bold flex items-center gap-2">
              AI Mentor
              <Mic className="w-4 h-4 text-primary" />
            </h1>
            <p className="text-xs text-muted-foreground capitalize">{profile?.mentor_personality || "Friendly"} voice</p>
          </div>
        </div>
        <AutoPlayToggle autoPlay={voice.autoPlay} onToggle={voice.toggleAutoPlay} />
      </header>

      <main className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <Card className="p-6 text-center bg-gradient-card border-0">
            <h2 className="text-xl font-bold mb-2">Hi {profile?.name}! 👋</h2>
            <p className="text-muted-foreground">
              I'm your personal UPSC mentor. Ask me anything about your studies, planning, or motivation!
            </p>
          </Card>
        )}

        {messages.map((msg, idx) => {
          // Strip markdown formatting (**, *, _, etc.) from AI responses
          const cleanContent = msg.role === "assistant" 
            ? msg.content.replace(/\*\*/g, '').replace(/\*/g, '').replace(/__/g, '').replace(/_/g, '')
            : msg.content;
          
          const isCurrentlySpeaking = speakingMessageIdx === idx && voice.isSpeaking;
          
          return (
            <div
              key={idx}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <Card
                className={`max-w-[80%] p-4 ${
                  msg.role === "user"
                    ? "bg-gradient-primary text-white border-0"
                    : "bg-card"
                } ${isCurrentlySpeaking ? "ring-2 ring-primary/50" : ""}`}
              >
                <p className="text-sm whitespace-pre-wrap">{cleanContent}</p>
                {msg.role === "assistant" && (
                  <div className="mt-2 pt-2 border-t border-border/50">
                    <VoiceControls
                      isSpeaking={isCurrentlySpeaking}
                      isPaused={isCurrentlySpeaking && voice.isPaused}
                      autoPlay={voice.autoPlay}
                      onSpeak={() => handleSpeakMessage(idx, msg.content)}
                      onPause={voice.pause}
                      onResume={voice.resume}
                      onStop={voice.stop}
                      onToggleAutoPlay={voice.toggleAutoPlay}
                    />
                  </div>
                )}
              </Card>
            </div>
          );
        })}

        {loading && (
          <div className="flex justify-start">
            <Card className="p-4 bg-card">
              <Loader2 className="w-5 h-5 animate-spin text-primary" />
            </Card>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      <div className="border-t bg-card/80 backdrop-blur-sm p-4">
        <div className="flex gap-2 max-w-4xl mx-auto">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={(e) => e.key === "Enter" && sendMessage()}
            placeholder="Type your message..."
            className="flex-1 rounded-xl"
            disabled={loading}
          />
          <Button
            onClick={sendMessage}
            disabled={loading || !input.trim()}
            className="rounded-xl bg-gradient-primary"
            size="icon"
          >
            <Send className="w-5 h-5" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default Mentor;