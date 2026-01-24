import { Button } from "@/components/ui/button";
import { Volume2, VolumeX, Pause, Play } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";

interface VoiceControlsProps {
  isSpeaking: boolean;
  isPaused: boolean;
  autoPlay: boolean;
  onSpeak: () => void;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onToggleAutoPlay: () => void;
}

export function VoiceControls({
  isSpeaking,
  isPaused,
  autoPlay,
  onSpeak,
  onPause,
  onResume,
  onStop,
  onToggleAutoPlay,
}: VoiceControlsProps) {
  return (
    <div className="flex items-center gap-2">
      {!isSpeaking ? (
        <Button
          variant="ghost"
          size="icon"
          onClick={onSpeak}
          className="h-7 w-7 rounded-full hover:bg-primary/10"
          title="Listen to response"
        >
          <Volume2 className="w-4 h-4 text-primary" />
        </Button>
      ) : (
        <>
          {isPaused ? (
            <Button
              variant="ghost"
              size="icon"
              onClick={onResume}
              className="h-7 w-7 rounded-full hover:bg-primary/10"
              title="Resume"
            >
              <Play className="w-4 h-4 text-primary" />
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="icon"
              onClick={onPause}
              className="h-7 w-7 rounded-full hover:bg-primary/10"
              title="Pause"
            >
              <Pause className="w-4 h-4 text-primary" />
            </Button>
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={onStop}
            className="h-7 w-7 rounded-full hover:bg-destructive/10"
            title="Stop"
          >
            <VolumeX className="w-4 h-4 text-destructive" />
          </Button>
        </>
      )}
    </div>
  );
}

export function AutoPlayToggle({
  autoPlay,
  onToggle,
}: {
  autoPlay: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <Switch
        id="autoplay"
        checked={autoPlay}
        onCheckedChange={onToggle}
        className="scale-75"
      />
      <Label htmlFor="autoplay" className="text-xs text-muted-foreground cursor-pointer">
        Auto-play voice
      </Label>
    </div>
  );
}
