import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { useSubscription } from "@/hooks/use-subscription";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  BookOpen, Brain, FileText, TrendingUp, Award, 
  Calendar, LogOut, MessageSquare, Zap, Target, Map, Video, BarChart3, GitBranch, Newspaper, GraduationCap, Mail, Phone, Crown, MoreHorizontal, LayoutDashboard, Trophy
} from "lucide-react";
import upscMentorLogo from "@/assets/upsc-mentor-logo.jpeg";
import FeedbackForm from "@/components/FeedbackForm";
import ThemeToggle from "@/components/ThemeToggle";
import FeatureCard from "@/components/FeatureCard";
import AdminDashboard from "@/components/AdminDashboard";
import ActivityDashboard from "@/components/dashboard/ActivityDashboard";
import Leaderboard from "@/components/dashboard/Leaderboard";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
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
  const { isSubscribed, loading: subLoading } = useSubscription();
  const { user, profile, isReady, isLocalMode, signOut } = useAuth();

  useEffect(() => {
    if (!isReady) return;
    if (!user) {
      navigate("/auth");
      return;
    }
    if (!profile) {
      navigate("/onboarding");
      return;
    }
    setLoading(false);
  }, [isReady, user, profile, navigate]);

  const handleLogout = async () => {
    await signOut();
    navigate("/auth");
  };

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

  // Free features (first 5)
  const freeFeatures = [
    { path: "/mentor", icon: <MessageSquare className="w-10 h-10" />, title: "AI Mentor", description: "Chat with your personal mentor" },
    { path: "/prelims", icon: <Brain className="w-10 h-10" />, title: "Prelims Quiz", description: "Practice MCQs" },
    { path: "/current-affairs", icon: <FileText className="w-10 h-10" />, title: "Current Affairs", description: "Today's updates" },
    { path: "/study-plan", icon: <Calendar className="w-10 h-10" />, title: "Study Plan", description: "Daily schedule" },
    { path: "/mains", icon: <Award className="w-10 h-10" />, title: "Mains Practice", description: "Practice essay writing" },
  ];

  // Premium features (locked for free users)
  const premiumFeatures = [
    { path: "/notes", icon: <BookOpen className="w-10 h-10" />, title: "Notes Library", description: "Your study notes" },
    { path: "/map-practice", icon: <Map className="w-10 h-10" />, title: "Map Practice", description: "India & World Geography" },
    { path: "/mock-interview", icon: <Video className="w-10 h-10" />, title: "Mock Interview", description: "AI Interview Room" },
    { path: "/pyq-engine", icon: <BarChart3 className="w-10 h-10" />, title: "PYQ Engine", description: "40-Year Analysis & Predictions" },
    { path: "/mind-map", icon: <GitBranch className="w-10 h-10" />, title: "Mind Map", description: "Visual topic visualizer" },
    { path: "/daily-intel", icon: <Newspaper className="w-10 h-10" />, title: "Daily Intel Report", description: "Officer-grade UPSC brief" },
    { path: "/optional-professor", icon: <GraduationCap className="w-10 h-10" />, title: "Optional Professor", description: "AI expert for your optional" },
    { path: "/voice-ai", icon: <div className="text-4xl">🎙️</div>, title: "Voice AI", description: "Talk & listen to AI explanations" },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <img 
              src={upscMentorLogo} 
              alt="UPSC Mentor Logo" 
              className="w-12 h-12 rounded-xl object-cover"
            />
            <div>
              <h1 className="font-bold text-lg">UPSC Mentor</h1>
              <p className="text-xs text-muted-foreground">Welcome, {profile?.name}!</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!subLoading && !isSubscribed && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => navigate("/subscription")}
                className="text-primary border-primary/30 hover:bg-primary/10"
              >
                <Crown className="w-4 h-4 mr-1" />
                Upgrade
              </Button>
            )}
            {isSubscribed && (
              <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full flex items-center gap-1">
                <Crown className="w-3 h-3" /> Premium
              </span>
            )}
            <ThemeToggle />
            <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
              <LogOut className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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

        {/* Dashboard Tabs */}
        <Tabs defaultValue="features" className="w-full">
          <TabsList className="grid w-full grid-cols-3 mb-4">
            <TabsTrigger value="features" className="flex items-center gap-1">
              <LayoutDashboard className="w-4 h-4" />
              Features
            </TabsTrigger>
            <TabsTrigger value="analytics" className="flex items-center gap-1">
              <BarChart3 className="w-4 h-4" />
              Analytics
            </TabsTrigger>
            <TabsTrigger value="leaderboard" className="flex items-center gap-1">
              <Trophy className="w-4 h-4" />
              Leaderboard
            </TabsTrigger>
          </TabsList>

          <TabsContent value="features" className="space-y-6">
            {/* Free Features */}
            <div>
              <h2 className="text-xl font-bold mb-4">Free Features</h2>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {freeFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.path}
                    path={feature.path}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    isLocked={false}
                  />
                ))}
              </div>
            </div>

            {/* Premium Features */}
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold flex items-center gap-2">
                  <Crown className="w-5 h-5 text-warning" />
                  Premium Features
                </h2>
                {!isSubscribed && (
                  <Button 
                    variant="link" 
                    size="sm" 
                    onClick={() => navigate("/subscription")}
                    className="text-primary"
                  >
                    View Plans →
                  </Button>
                )}
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {premiumFeatures.map((feature) => (
                  <FeatureCard
                    key={feature.path}
                    path={feature.path}
                    icon={feature.icon}
                    title={feature.title}
                    description={feature.description}
                    isLocked={!isSubscribed}
                  />
                ))}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="analytics">
            <ActivityDashboard profile={profile} />
          </TabsContent>

          <TabsContent value="leaderboard">
            <Leaderboard />
          </TabsContent>
        </Tabs>

        {/* Contact Developer Section */}
        <div className="mt-12 border-t pt-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Contact Developer</h2>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleAdminAccess}
              className="h-8 w-8 rounded-full opacity-50 hover:opacity-100"
            >
              <MoreHorizontal className="w-4 h-4" />
            </Button>
          </div>
          <Card className="p-6 bg-gradient-card border-0">
            <div className="flex flex-col md:flex-row items-center gap-6">
              <div className="w-20 h-20 rounded-full bg-gradient-primary flex items-center justify-center text-3xl font-bold text-primary-foreground">
                C
              </div>
              <div className="flex-1 text-center md:text-left">
                <h3 className="text-xl font-bold mb-2">Chandrashekhar</h3>
                <p className="text-muted-foreground mb-4">Full Stack Developer</p>
                <div className="flex flex-col sm:flex-row items-center gap-4">
                  <a 
                    href="mailto:chandrashekharkumbarias8055@gmail.com" 
                    className="flex items-center gap-2 text-sm text-primary hover:underline"
                  >
                    <Mail className="w-4 h-4" />
                    chandrashekharkumbarias8055@gmail.com
                  </a>
                  <button
                    type="button"
                    onClick={() => {
                      const phone = "917975256005";
                      try {
                        window.location.href = `whatsapp://send?phone=${phone}`;
                      } catch {
                        // ignore
                      }
                      setTimeout(() => {
                        window.open(`https://wa.me/${phone}`, "_blank", "noopener,noreferrer");
                      }, 200);
                    }}
                    className="flex items-center gap-2 text-sm text-success hover:underline"
                  >
                    <Phone className="w-4 h-4" />
                    +91 7975256005 (WhatsApp)
                  </button>
                </div>
              </div>
            </div>
          </Card>

          {/* Feedback Form */}
          <FeedbackForm />
        </div>
      </main>

      {/* Password Dialog for Admin Access */}
      <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Admin Access</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Input
              type="password"
              placeholder="Enter admin password"
              value={adminPassword}
              onChange={(e) => {
                setAdminPassword(e.target.value);
                setPasswordError(false);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  handlePasswordSubmit();
                }
              }}
              className={passwordError ? 'border-destructive' : ''}
            />
            {passwordError && (
              <p className="text-sm text-destructive">Incorrect password</p>
            )}
            <Button onClick={handlePasswordSubmit} className="w-full">
              Access Dashboard
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin Dashboard Modal */}
      <AdminDashboard 
        isOpen={showAdminDashboard} 
        onClose={() => setShowAdminDashboard(false)} 
      />
    </div>
  );
};

export default Dashboard;
