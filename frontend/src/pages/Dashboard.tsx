import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/use-local-auth";
import { useGamification } from "@/hooks/use-gamification";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import FeatureCard from "@/components/FeatureCard";
import FeedbackForm from "@/components/FeedbackForm";
import AdminDashboard from "@/components/AdminDashboard";
import {
  BookOpen, Brain, FileText, TrendingUp, Award,
  Calendar, MessageSquare, Zap, Target, Map, Video, BarChart3, GitBranch, Newspaper, GraduationCap, MoreHorizontal, MessageCircleQuestion
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

const ADMIN_PASSWORD = "admin@7975256005";

const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showAdminDashboard, setShowAdminDashboard] = useState(false);
  const [adminPassword, setAdminPassword] = useState("");
  const [passwordError, setPasswordError] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const streakSyncKeyRef = useRef("");
  
  const { user, profile, isReady, isLocalMode, signOut } = useAuth();
  const { updateStreak } = useGamification();

  useEffect(() => {
    if (!isReady) return;
    if (isLocalMode) {
      toast({
        title: "Backend required",
        description: "Dashboard is available only with backend-connected account.",
        variant: "destructive",
      });
      signOut();
      navigate("/auth");
      return;
    }
    if (!user) { navigate("/auth"); return; }
    if (!profile) { navigate("/onboarding"); return; }
    setLoading(false);
    // Update streak once per user per day to avoid repeated XP increments on rerenders.
    const today = new Date().toISOString().slice(0, 10);
    const syncKey = `${user.id}-${today}`;
    if (streakSyncKeyRef.current !== syncKey) {
      streakSyncKeyRef.current = syncKey;
      updateStreak();
    }
  }, [isReady, user, profile, isLocalMode, signOut, navigate]);

  const handleAdminAccess = () => {
    setShowPasswordDialog(true);
    setAdminPassword("");
    setPasswordError(false);
  };

  const handlePasswordSubmit = () => {
    if (adminPassword === ADMIN_PASSWORD) {
      setShowPasswordDialog(false);
      setShowAdminDashboard(true);
      setAdminPassword("");
      setPasswordError(false);
    } else {
      setPasswordError(true);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  const allFeatures = [
    { path: "/mentor", icon: <MessageSquare className="w-10 h-10" />, title: "AI Mentor", description: "Chat with your personal mentor" },
    { path: "/notes", icon: <BookOpen className="w-10 h-10" />, title: "UPSC Notes", description: "AI slide-wise notes with checkpoints" },
    { path: "/notes-library", icon: <BookOpen className="w-10 h-10" />, title: "Notes Library", description: "Create and manage your personal notes" },
    { path: "/prelims", icon: <Brain className="w-10 h-10" />, title: "Prelims Quiz", description: "Practice MCQs" },
    { path: "/current-affairs", icon: <FileText className="w-10 h-10" />, title: "Current Affairs", description: "Today's updates" },
    { path: "/study-plan", icon: <Calendar className="w-10 h-10" />, title: "Study Plan", description: "Daily schedule" },
    { path: "/mains", icon: <Award className="w-10 h-10" />, title: "Mains Practice", description: "Practice essay writing" },
    { path: "/map-practice", icon: <Map className="w-10 h-10" />, title: "Map Practice", description: "India & World Geography" },
    { path: "/mock-interview", icon: <Video className="w-10 h-10" />, title: "Mock Interview", description: "AI Interview Room" },
    { path: "/pyq-engine", icon: <BarChart3 className="w-10 h-10" />, title: "PYQ Engine", description: "40-Year Analysis & Predictions" },
    { path: "/mind-map", icon: <GitBranch className="w-10 h-10" />, title: "Mind Map", description: "Visual topic visualizer" },
    { path: "/daily-intel", icon: <Newspaper className="w-10 h-10" />, title: "Daily Intel Report", description: "Officer-grade UPSC brief" },
    { path: "/optional-professor", icon: <GraduationCap className="w-10 h-10" />, title: "Optional Professor", description: "AI expert for your optional" },
    { path: "/voice-ai", icon: <div className="text-4xl">🎙️</div>, title: "Voice AI", description: "Talk & listen to AI explanations" },
    { path: "/weekly-test-series", icon: <Brain className="w-10 h-10" />, title: "Weekly Test Series", description: "Prelims weekly mock tests + leaderboard" },
    { path: "/doubt-feed", icon: <MessageCircleQuestion className="w-10 h-10" />, title: "UPSC Doubt Feed", description: "Public UPSC doubt solving community" },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-4 bg-gradient-card border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Zap className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profile?.current_streak}</p>
                <p className="text-xs text-muted-foreground">Day Streak</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-card border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-success/10 flex items-center justify-center">
                <Award className="w-5 h-5 text-success" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profile?.total_xp}</p>
                <p className="text-xs text-muted-foreground">Total XP</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-card border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-info/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-info" />
              </div>
              <div>
                <p className="text-2xl font-bold">Level {profile?.level}</p>
                <p className="text-xs text-muted-foreground">Current</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 bg-gradient-card border-0 shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-warning/10 flex items-center justify-center">
                <Target className="w-5 h-5 text-warning" />
              </div>
              <div>
                <p className="text-2xl font-bold">{profile?.target_year}</p>
                <p className="text-xs text-muted-foreground">Target Year</p>
              </div>
            </div>
          </Card>
        </div>

        {/* All Features */}
        <div>
          <h2 className="text-xl font-bold mb-4">Features</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {allFeatures.map((f) => (
              <FeatureCard key={f.path} {...f} isLocked={false} />
            ))}
          </div>
        </div>

        {/* Admin Access (hidden) */}
        <div className="mt-12 flex justify-end">
          <Button variant="ghost" size="icon" onClick={handleAdminAccess} className="h-8 w-8 rounded-full opacity-50 hover:opacity-100">
            <MoreHorizontal className="w-4 h-4" />
          </Button>
        </div>
      </div>

      {/* Admin Password Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Admin Access</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => { setAdminPassword(e.target.value); setPasswordError(false); }}
              onKeyDown={(e) => { if (e.key === "Enter") handlePasswordSubmit(); }}
              className={passwordError ? "border-destructive" : ""}
            />
            {passwordError && <p className="text-sm text-destructive">Incorrect password</p>}
            <Button onClick={handlePasswordSubmit} className="w-full">Access Dashboard</Button>
          </div>
        </DialogContent>
      </Dialog>

      <AdminDashboard isOpen={showAdminDashboard} onClose={() => setShowAdminDashboard(false)} />
    </DashboardLayout>
  );
};

export default Dashboard;



