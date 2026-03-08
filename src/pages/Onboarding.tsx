import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Smile, Shield, TrendingUp, Laugh, Heart, Camera, User } from "lucide-react";

const mentorIcons = {
  friendly: Smile,
  strict: Shield,
  topper: TrendingUp,
  military: Shield,
  humorous: Laugh,
  spiritual: Heart,
};

const Onboarding = () => {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [targetYear, setTargetYear] = useState(2026);
  const [optionalSubject, setOptionalSubject] = useState("");
  const [studyHours, setStudyHours] = useState(4);
  const [mentorPersonality, setMentorPersonality] = useState("friendly");
  const [profilePhotoUrl, setProfilePhotoUrl] = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loading, setLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user, isLocalMode, saveProfile, refreshProfile } = useAuth();

  const handlePhotoSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onload = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const uploadPhoto = async (): Promise<string | null> => {
    if (!photoFile || !user) return null;
    setUploading(true);
    try {
      const ext = photoFile.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;
      const { error } = await supabase.storage.from("mains-answers").upload(filePath, photoFile, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("mains-answers").getPublicUrl(filePath);
      return data.publicUrl;
    } catch (err: any) {
      toast({ title: "Photo upload failed", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setUploading(false);
    }
  };

  const handleComplete = async () => {
    setLoading(true);
    try {
      if (!user) throw new Error("No user found");

      let photoUrl: string | null = null;
      if (photoFile && !isLocalMode) {
        photoUrl = await uploadPhoto();
      }

      if (isLocalMode) {
        saveProfile({
          name,
          target_year: targetYear,
          optional_subject: optionalSubject || null,
          study_hours_per_day: studyHours,
          mentor_personality: mentorPersonality,
        });
      } else {
        const { error } = await supabase.from("profiles").upsert({
          id: user.id,
          name,
          target_year: targetYear,
          optional_subject: optionalSubject || null,
          study_hours_per_day: studyHours,
          mentor_personality: mentorPersonality,
          profile_photo_url: photoUrl,
        }, { onConflict: "id" });
        if (error) throw error;
        // Refresh profile in auth context before navigating
        await new Promise<void>((resolve) => {
          refreshProfile();
          // Give time for profile state to update
          setTimeout(resolve, 500);
        });
      }

      toast({ title: "Profile created!", description: "Let's start your UPSC journey" });
      navigate("/dashboard");
    } catch (error: any) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-secondary/20 to-accent/20 p-4">
      <Card className="w-full max-w-2xl p-8 space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold mb-2">Let's Get Started! 🎯</h1>
          <p className="text-muted-foreground">Step {step} of 3</p>
        </div>

        {step === 1 ? (
          <div className="space-y-4">
            {/* Profile Photo Upload */}
            <div className="flex flex-col items-center gap-4">
              <div className="relative">
                <Avatar className="h-28 w-28 border-4 border-primary/20">
                  <AvatarImage src={photoPreview || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary text-3xl">
                    <User className="w-12 h-12" />
                  </AvatarFallback>
                </Avatar>
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2.5 shadow-lg hover:opacity-90 transition"
                >
                  <Camera className="w-5 h-5" />
                </button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoSelect}
                  className="hidden"
                />
              </div>
              <p className="text-sm text-muted-foreground">Upload your profile photo (optional)</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="name">Your Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Enter your name" className="rounded-xl" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="targetYear">Target Year</Label>
                <Select value={targetYear.toString()} onValueChange={(v) => setTargetYear(parseInt(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="2025">2025</SelectItem>
                    <SelectItem value="2026">2026</SelectItem>
                    <SelectItem value="2027">2027</SelectItem>
                    <SelectItem value="2028">2028</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="studyHours">Daily Study Hours</Label>
                <Select value={studyHours.toString()} onValueChange={(v) => setStudyHours(parseInt(v))}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2, 3, 4, 5, 6, 7, 8, 10, 12].map((h) => (
                      <SelectItem key={h} value={h.toString()}>{h} hours</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="optionalSubject">Optional Subject (if decided)</Label>
              <Input id="optionalSubject" value={optionalSubject} onChange={(e) => setOptionalSubject(e.target.value)} placeholder="e.g., History, Geography, Psychology" className="rounded-xl" />
            </div>
            <Button onClick={() => setStep(2)} className="w-full rounded-xl h-12 bg-gradient-primary" disabled={!name}>
              Next: Choose Your Mentor
            </Button>
          </div>
        ) : step === 2 ? (
          <div className="space-y-4">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-bold mb-2">Choose Your AI Mentor</h2>
              <p className="text-muted-foreground">Select the personality that motivates you best</p>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {(["friendly", "strict", "topper", "military", "humorous", "spiritual"] as const).map((type) => {
                const Icon = mentorIcons[type];
                return (
                  <button
                    key={type}
                    onClick={() => setMentorPersonality(type)}
                    className={`p-4 rounded-2xl border-2 transition-all ${
                      mentorPersonality === type
                        ? "border-primary bg-primary/10 shadow-lg scale-105"
                        : "border-border hover:border-primary/50"
                    }`}
                  >
                    <Icon className="w-8 h-8 mx-auto mb-2 text-primary" />
                    <p className="font-semibold capitalize">{type}</p>
                  </button>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Button onClick={() => setStep(1)} variant="outline" className="flex-1 rounded-xl h-12">Back</Button>
              <Button onClick={handleComplete} className="flex-1 rounded-xl h-12 bg-gradient-primary" disabled={loading || uploading}>
                {loading || uploading ? "Creating..." : "Complete Setup"}
              </Button>
            </div>
          </div>
        ) : null}
      </Card>
    </div>
  );
};

export default Onboarding;
