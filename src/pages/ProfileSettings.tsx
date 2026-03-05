import { useState, useRef } from "react";
import { useAuth } from "@/hooks/use-local-auth";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Camera, Save, User } from "lucide-react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";

const ProfileSettings = () => {
  const { user, profile, isLocalMode, saveProfile, refreshProfile } = useAuth();
  const { toast } = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(profile?.name || "");
  const [targetYear, setTargetYear] = useState(profile?.target_year?.toString() || "2026");
  const [optionalSubject, setOptionalSubject] = useState(profile?.optional_subject || "");
  const [studyHours, setStudyHours] = useState(profile?.study_hours_per_day?.toString() || "4");
  const [mentorPersonality, setMentorPersonality] = useState(profile?.mentor_personality || "friendly");
  const [photoUrl, setPhotoUrl] = useState(profile?.profile_photo_url || "");
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const filePath = `${user.id}/avatar.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("mains-answers")
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data } = supabase.storage.from("mains-answers").getPublicUrl(filePath);
      const url = data.publicUrl + "?t=" + Date.now();
      setPhotoUrl(url);

      // Update profile with new photo
      if (!isLocalMode) {
        await supabase.from("profiles").update({ profile_photo_url: url }).eq("id", user.id);
      }
      refreshProfile();
      toast({ title: "Photo updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const updates = {
        name,
        target_year: parseInt(targetYear),
        optional_subject: optionalSubject || null,
        study_hours_per_day: parseInt(studyHours),
        mentor_personality: mentorPersonality,
        profile_photo_url: photoUrl || null,
      };

      if (isLocalMode) {
        saveProfile(updates as any);
      } else {
        const { error } = await supabase.from("profiles").update(updates).eq("id", user.id);
        if (error) throw error;
        refreshProfile();
      }
      toast({ title: "Profile saved!", description: "Your changes have been saved." });
    } catch (err: any) {
      toast({ title: "Save failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto p-6 space-y-6">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <User className="w-6 h-6" /> Profile Settings
        </h1>

        {/* Avatar Section */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Profile Photo</CardTitle>
          </CardHeader>
          <CardContent className="flex items-center gap-6">
            <div className="relative">
              <Avatar className="h-24 w-24">
                <AvatarImage src={photoUrl || undefined} alt={name} />
                <AvatarFallback className="bg-primary/10 text-primary text-2xl font-bold">
                  {name?.charAt(0)?.toUpperCase() || "U"}
                </AvatarFallback>
              </Avatar>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 bg-primary text-primary-foreground rounded-full p-2 shadow-lg hover:opacity-90 transition"
                disabled={uploading}
              >
                <Camera className="w-4 h-4" />
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoUpload}
                className="hidden"
              />
            </div>
            <div>
              <p className="font-medium">{profile?.name}</p>
              <p className="text-sm text-muted-foreground">
                {uploading ? "Uploading..." : "Click the camera icon to change your photo"}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Profile Details */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Personal Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={name} onChange={(e) => setName(e.target.value)} className="rounded-xl" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Target Year</Label>
                <Select value={targetYear} onValueChange={setTargetYear}>
                  <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {[2025, 2026, 2027, 2028].map((y) => (
                      <SelectItem key={y} value={y.toString()}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Daily Study Hours</Label>
                <Select value={studyHours} onValueChange={setStudyHours}>
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
              <Label>Optional Subject</Label>
              <Input
                value={optionalSubject}
                onChange={(e) => setOptionalSubject(e.target.value)}
                placeholder="e.g., History, Geography, Psychology"
                className="rounded-xl"
              />
            </div>

            <div className="space-y-2">
              <Label>Mentor Personality</Label>
              <Select value={mentorPersonality} onValueChange={setMentorPersonality}>
                <SelectTrigger className="rounded-xl"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["friendly", "strict", "topper", "military", "humorous", "spiritual"].map((p) => (
                    <SelectItem key={p} value={p} className="capitalize">{p}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button onClick={handleSave} disabled={saving} className="gap-2">
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </CardContent>
        </Card>

        {/* Stats Card */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Your Stats</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-2xl font-bold text-primary">{profile?.total_xp || 0}</p>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">{profile?.current_streak || 0}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-primary">Level {profile?.level || 1}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default ProfileSettings;
