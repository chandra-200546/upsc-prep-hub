import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Trophy, Medal, Award, Crown, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

interface LeaderboardEntry {
  id: string;
  name: string;
  total_xp: number;
  level: number;
  profile_photo_url: string | null;
}

const PRIZES = [
  { icon: <Trophy className="w-6 h-6 text-warning" />, label: "🥇 1st Place", prize: "₹500 + Gold Certificate" },
  { icon: <Medal className="w-6 h-6 text-muted-foreground" />, label: "🥈 2nd Place", prize: "₹300 + Silver Certificate" },
  { icon: <Award className="w-6 h-6 text-primary" />, label: "🥉 3rd Place", prize: "₹200 + Bronze Certificate" },
];

const Leaderboard = () => {
  const [leaders, setLeaders] = useState<LeaderboardEntry[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [daysLeft, setDaysLeft] = useState(0);

  useEffect(() => {
    calculateDaysLeft();
    fetchLeaderboard();
  }, []);

  const calculateDaysLeft = () => {
    const now = new Date();
    const lastDay = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    setDaysLeft(lastDay.getDate() - now.getDate());
  };

  const fetchLeaderboard = async () => {
    setLoading(true);
    const { data: { session } } = await supabase.auth.getSession();
    if (session) setCurrentUserId(session.user.id);

    const { data, error } = await supabase
      .from("profiles")
      .select("id, name, total_xp, level, profile_photo_url")
      .order("total_xp", { ascending: false })
      .limit(50);

    if (!error && data) {
      setLeaders(data as LeaderboardEntry[]);
    }
    setLoading(false);
  };

  const currentUserRank = leaders.findIndex((l) => l.id === currentUserId) + 1;
  const initials = (name: string) =>
    String(name || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0]?.toUpperCase() || "")
      .join("") || "A";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold flex items-center gap-2">
          <Crown className="w-5 h-5 text-warning" />
          Monthly Leaderboard
        </h2>
        <Button variant="ghost" size="sm" onClick={fetchLeaderboard} disabled={loading}>
          <RefreshCw className={`w-4 h-4 mr-1 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <Card className="border-0 bg-gradient-primary p-4 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium opacity-90">Leaderboard resets in</p>
            <p className="text-2xl font-bold">{daysLeft} days</p>
          </div>
          <div className="text-right">
            <p className="text-sm font-medium opacity-90">Your Rank</p>
            <p className="text-2xl font-bold">#{currentUserRank || "—"}</p>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-3 gap-3">
        {PRIZES.map((p, i) => (
          <Card key={i} className="p-3 border-0 shadow-sm text-center bg-gradient-card">
            <div className="flex justify-center mb-1">{p.icon}</div>
            <p className="text-xs font-bold">{p.label}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{p.prize}</p>
          </Card>
        ))}
      </div>

      {leaders.length >= 3 && (
        <div className="flex items-end justify-center gap-3 py-4">
          <div className="flex flex-col items-center">
            <Avatar className="w-14 h-14 border-2 border-muted-foreground/50">
              <AvatarImage src={leaders[1]?.profile_photo_url || ""} alt={leaders[1]?.name || "Second user"} />
              <AvatarFallback className="bg-secondary text-lg font-bold">{initials(leaders[1]?.name || "")}</AvatarFallback>
            </Avatar>
            <p className="text-xs font-semibold mt-1 truncate max-w-16">{leaders[1]?.name?.split(" ")[0]}</p>
            <Badge variant="secondary" className="text-[10px] mt-1">{leaders[1]?.total_xp} XP</Badge>
            <div className="w-16 h-16 bg-secondary/50 rounded-t-lg mt-2 flex items-center justify-center font-bold text-lg text-muted-foreground">2</div>
          </div>
          <div className="flex flex-col items-center">
            <Crown className="w-6 h-6 text-warning mb-1" />
            <Avatar className="w-16 h-16 border-2 border-warning">
              <AvatarImage src={leaders[0]?.profile_photo_url || ""} alt={leaders[0]?.name || "Top user"} />
              <AvatarFallback className="bg-primary/20 text-xl font-bold">{initials(leaders[0]?.name || "")}</AvatarFallback>
            </Avatar>
            <p className="text-xs font-bold mt-1 truncate max-w-20">{leaders[0]?.name?.split(" ")[0]}</p>
            <Badge className="text-[10px] mt-1 bg-primary text-primary-foreground">{leaders[0]?.total_xp} XP</Badge>
            <div className="w-16 h-24 bg-primary/20 rounded-t-lg mt-2 flex items-center justify-center font-bold text-lg text-primary">1</div>
          </div>
          <div className="flex flex-col items-center">
            <Avatar className="w-14 h-14 border-2 border-primary/50">
              <AvatarImage src={leaders[2]?.profile_photo_url || ""} alt={leaders[2]?.name || "Third user"} />
              <AvatarFallback className="bg-secondary text-lg font-bold">{initials(leaders[2]?.name || "")}</AvatarFallback>
            </Avatar>
            <p className="text-xs font-semibold mt-1 truncate max-w-16">{leaders[2]?.name?.split(" ")[0]}</p>
            <Badge variant="secondary" className="text-[10px] mt-1">{leaders[2]?.total_xp} XP</Badge>
            <div className="w-16 h-12 bg-secondary/50 rounded-t-lg mt-2 flex items-center justify-center font-bold text-lg text-muted-foreground">3</div>
          </div>
        </div>
      )}

      <Card className="border-0 shadow-sm">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-semibold">All Rankings</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1 max-h-80 overflow-y-auto">
          {loading ? (
            <div className="space-y-2">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-12 rounded-lg animate-pulse bg-muted/50" />
              ))}
            </div>
          ) : leaders.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No users yet. Start earning XP!</p>
          ) : (
            leaders.map((user, index) => (
              <div
                key={user.id}
                className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
                  user.id === currentUserId ? "bg-primary/10 border border-primary/20" : "hover:bg-muted/50"
                }`}
              >
                <span className={`text-sm font-bold w-6 text-center ${index < 3 ? "text-primary" : "text-muted-foreground"}`}>
                  {index + 1}
                </span>
                <Avatar className="w-8 h-8">
                  <AvatarImage src={user.profile_photo_url || ""} alt={user.name} />
                  <AvatarFallback className="text-sm font-bold">{initials(user.name || "")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {user.name}
                    {user.id === currentUserId && <span className="text-xs text-primary ml-1">(You)</span>}
                  </p>
                  <p className="text-xs text-muted-foreground">Level {user.level}</p>
                </div>
                <Badge variant="outline" className="text-xs font-bold">{user.total_xp || 0} XP</Badge>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground text-center">
        Leaderboard resets on the 1st of every month. Top 3 winners receive prizes & certificates.
      </p>
    </div>
  );
};

export default Leaderboard;
