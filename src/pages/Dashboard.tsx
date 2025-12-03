import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useToast } from "@/hooks/use-toast";
import { 
  BookOpen, Brain, FileText, TrendingUp, Award, 
  Calendar, LogOut, MessageSquare, Zap, Target, Map, Video, BarChart3, GitBranch
} from "lucide-react";

const Dashboard = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session) {
      navigate("/auth");
      return;
    }

    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", session.user.id)
      .single();

    if (error) {
      console.error("Error fetching profile:", error);
      navigate("/onboarding");
    } else {
      setProfile(data);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-secondary/20 to-accent/20">
      {/* Header */}
      <header className="bg-card/80 backdrop-blur-sm border-b sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-primary flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-lg">UPSC Mentor</h1>
              <p className="text-xs text-muted-foreground">Welcome, {profile?.name}!</p>
            </div>
          </div>
          <Button variant="ghost" size="icon" onClick={handleLogout} className="rounded-full">
            <LogOut className="w-5 h-5" />
          </Button>
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

        {/* Quick Actions */}
        <div>
          <h2 className="text-xl font-bold mb-4">Quick Actions</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <Card
              onClick={() => navigate("/mentor")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <MessageSquare className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">AI Mentor</h3>
              <p className="text-sm text-muted-foreground">Chat with your personal mentor</p>
            </Card>

            <Card
              onClick={() => navigate("/prelims")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <Brain className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Prelims Quiz</h3>
              <p className="text-sm text-muted-foreground">Practice MCQs</p>
            </Card>

            <Card
              onClick={() => navigate("/current-affairs")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <FileText className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Current Affairs</h3>
              <p className="text-sm text-muted-foreground">Today's updates</p>
            </Card>

            <Card
              onClick={() => navigate("/study-plan")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <Calendar className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Study Plan</h3>
              <p className="text-sm text-muted-foreground">Daily schedule</p>
            </Card>

            <Card
              onClick={() => navigate("/mains")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <Award className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Mains Practice</h3>
              <p className="text-sm text-muted-foreground">Practice essay writing</p>
            </Card>

            <Card
              onClick={() => navigate("/notes")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <BookOpen className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Notes Library</h3>
              <p className="text-sm text-muted-foreground">Your study notes</p>
            </Card>

            <Card
              onClick={() => navigate("/map-practice")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <Map className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Map Practice</h3>
              <p className="text-sm text-muted-foreground">India & World Geography</p>
            </Card>

            <Card
              onClick={() => navigate("/mock-interview")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <Video className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Mock Interview</h3>
              <p className="text-sm text-muted-foreground">AI Interview Room</p>
            </Card>

            <Card
              onClick={() => navigate("/pyq-engine")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <BarChart3 className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">PYQ Engine</h3>
              <p className="text-sm text-muted-foreground">40-Year Analysis & Predictions</p>
            </Card>

            <Card
              onClick={() => navigate("/mind-map")}
              className="p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105 bg-gradient-card border-0"
            >
              <GitBranch className="w-10 h-10 mb-3 text-primary" />
              <h3 className="font-semibold mb-1">Mind Map</h3>
              <p className="text-sm text-muted-foreground">Visual topic visualizer</p>
            </Card>
          </div>
        </div>
      </main>
    </div>
  );
};

export default Dashboard;