import { useState, useCallback, useEffect, useRef } from "react";

type MentorPersonality = "friendly" | "strict" | "topper" | "military" | "humorous" | "spiritual";

interface VoiceSettings {
  rate: number;
  pitch: number;
  voiceIndex: number;
}

const personalityVoiceMap: Record<MentorPersonality, VoiceSettings> = {
  friendly: { rate: 1.0, pitch: 1.1, voiceIndex: 0 },
  strict: { rate: 0.9, pitch: 0.8, voiceIndex: 1 },
  topper: { rate: 1.1, pitch: 1.0, voiceIndex: 2 },
  military: { rate: 0.85, pitch: 0.7, voiceIndex: 1 },
  humorous: { rate: 1.15, pitch: 1.2, voiceIndex: 0 },
  spiritual: { rate: 0.8, pitch: 0.9, voiceIndex: 2 },
};

export function useVoiceSynthesis() {
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [autoPlay, setAutoPlay] = useState(() => {
    if (typeof window !== "undefined") {
      return localStorage.getItem("mentor-autoplay") === "true";
    }
    return false;
  });
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  useEffect(() => {
    const loadVoices = () => {
      const availableVoices = window.speechSynthesis.getVoices();
      // Prefer English voices
      const englishVoices = availableVoices.filter(
        (v) => v.lang.startsWith("en")
      );
      setVoices(englishVoices.length > 0 ? englishVoices : availableVoices);
    };

    loadVoices();
    window.speechSynthesis.onvoiceschanged = loadVoices;

    return () => {
      window.speechSynthesis.cancel();
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("mentor-autoplay", autoPlay.toString());
  }, [autoPlay]);

  const speak = useCallback(
    (text: string, personality: MentorPersonality = "friendly") => {
      if (!window.speechSynthesis) {
        console.warn("Speech synthesis not supported");
        return;
      }

      // Cancel any ongoing speech
      window.speechSynthesis.cancel();

      const settings = personalityVoiceMap[personality] || personalityVoiceMap.friendly;
      const utterance = new SpeechSynthesisUtterance(text);

      // Select voice based on personality
      if (voices.length > 0) {
        const voiceIndex = Math.min(settings.voiceIndex, voices.length - 1);
        utterance.voice = voices[voiceIndex];
      }

      utterance.rate = settings.rate;
      utterance.pitch = settings.pitch;
      utterance.volume = 1;

      utterance.onstart = () => {
        setIsSpeaking(true);
        setIsPaused(false);
      };

      utterance.onend = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utterance.onerror = () => {
        setIsSpeaking(false);
        setIsPaused(false);
      };

      utteranceRef.current = utterance;
      window.speechSynthesis.speak(utterance);
    },
    [voices]
  );

  const pause = useCallback(() => {
    if (window.speechSynthesis.speaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    }
  }, []);

  const resume = useCallback(() => {
    if (window.speechSynthesis.paused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    }
  }, []);

  const stop = useCallback(() => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
    setIsPaused(false);
  }, []);

  const toggleAutoPlay = useCallback(() => {
    setAutoPlay((prev) => !prev);
  }, []);

  return {
    speak,
    pause,
    resume,
    stop,
    isSpeaking,
    isPaused,
    autoPlay,
    toggleAutoPlay,
    isSupported: typeof window !== "undefined" && "speechSynthesis" in window,
  };
}
