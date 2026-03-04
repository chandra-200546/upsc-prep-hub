import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  LineChart, Line, PieChart, Pie, Cell, AreaChart, Area
} from "recharts";
import { TrendingUp, Brain, FileText, Clock } from "lucide-react";

const CHART_COLORS = [
  "hsl(20, 90%, 55%)",
  "hsl(145, 65%, 48%)",
  "hsl(210, 80%, 55%)",
  "hsl(40, 95%, 55%)",
  "hsl(280, 60%, 55%)",
  "hsl(0, 72%, 55%)",
];

// Sample data for local/demo mode
const SAMPLE_WEEKLY = [
  { day: "Mon", activities: 3 },
  { day: "Tue", activities: 5 },
  { day: "Wed", activities: 2 },
  { day: "Thu", activities: 7 },
  { day: "Fri", activities: 4 },
  { day: "Sat", activities: 6 },
  { day: "Sun", activities: 1 },
];
const SAMPLE_PRELIMS = [
  { day: "Mon", accuracy: 60, total: 5, correct: 3 },
  { day: "Tue", accuracy: 80, total: 5, correct: 4 },
  { day: "Wed", accuracy: 40, total: 5, correct: 2 },
  { day: "Thu", accuracy: 100, total: 4, correct: 4 },
  { day: "Fri", accuracy: 75, total: 4, correct: 3 },
];
const SAMPLE_SUBJECTS = [
  { name: "History", value: 12, accuracy: 67 },
  { name: "Polity", value: 8, accuracy: 75 },
  { name: "Geography", value: 6, accuracy: 50 },
  { name: "Economy", value: 5, accuracy: 80 },
];
const SAMPLE_MAINS = [
  { attempt: "#1", marks: 5, words: 220 },
  { attempt: "#2", marks: 7, words: 240 },
  { attempt: "#3", marks: 6, words: 230 },
];

interface ActivityDashboardProps {
  profile: any;
}

const ActivityDashboard = ({ profile }: ActivityDashboardProps) => {
  const [prelimsData, setPrelimsData] = useState<any[]>([]);
  const [mainsData, setMainsData] = useState<any[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isLocalMode } = useAuth();

  useEffect(() => {
    if (isLocalMode) {
      // Use sample data in local mode
      setPrelimsData(SAMPLE_PRELIMS);
      setMainsData(SAMPLE_MAINS);
      setSubjectBreakdown(SAMPLE_SUBJECTS);
      setWeeklyActivity(SAMPLE_WEEKLY);
      setLoading(false);
    } else {
      fetchActivityData();
    }
  }, [isLocalMode]);

  const fetchActivityData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const userId = session.user.id;

    const { data: attempts } = await supabase
      .from("prelims_attempts")
      .select("*, prelims_questions(subject)")
      .eq("user_id", userId)
      .order("attempted_at", { ascending: true });

    const { data: submissions } = await supabase
      .from("mains_submissions")
      .select("*")
      .eq("user_id", userId)
      .order("submitted_at", { ascending: true });

    if (attempts && attempts.length > 0) {
      const dailyMap: Record<string, { correct: number; total: number }> = {};
      const subjectMap: Record<string, { correct: number; total: number }> = {};

      attempts.forEach((a: any) => {
        const day = new Date(a.attempted_at).toLocaleDateString("en-US", { weekday: "short" });
        if (!dailyMap[day]) dailyMap[day] = { correct: 0, total: 0 };
        dailyMap[day].total++;
        if (a.is_correct) dailyMap[day].correct++;

        const subject = a.prelims_questions?.subject || "Unknown";
        if (!subjectMap[subject]) subjectMap[subject] = { correct: 0, total: 0 };
        subjectMap[subject].total++;
        if (a.is_correct) subjectMap[subject].correct++;
      });

      setPrelimsData(
        Object.entries(dailyMap).slice(-7).map(([day, d]) => ({
          day, accuracy: Math.round((d.correct / d.total) * 100), total: d.total, correct: d.correct,
        }))
      );
      setSubjectBreakdown(
        Object.entries(subjectMap).map(([name, d]) => ({
          name: name.length > 12 ? name.slice(0, 12) + "…" : name,
          value: d.total, accuracy: Math.round((d.correct / d.total) * 100),
        }))
      );
    } else {
      // No prelims data — use sample
      setPrelimsData(SAMPLE_PRELIMS);
      setSubjectBreakdown(SAMPLE_SUBJECTS);
    }

    if (submissions && submissions.length > 0) {
      setMainsData(
        submissions.slice(-10).map((s: any, i: number) => ({
          attempt: `#${i + 1}`, marks: s.marks || 0, words: s.word_count || 0,
        }))
      );
    } else {
      // No mains data — use sample
      setMainsData(SAMPLE_MAINS);
    }

    if (attempts && attempts.length > 0) {
      const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
      const activityByDay: Record<string, number> = {};
      days.forEach((d) => (activityByDay[d] = 0));
      attempts?.forEach((a: any) => {
        const day = new Date(a.attempted_at).toLocaleDateString("en-US", { weekday: "short" });
        if (activityByDay[day] !== undefined) activityByDay[day]++;
      });
      submissions?.forEach((s: any) => {
        const day = new Date(s.submitted_at).toLocaleDateString("en-US", { weekday: "short" });
        if (activityByDay[day] !== undefined) activityByDay[day]++;
      });
      setWeeklyActivity(days.map((d) => ({ day: d, activities: activityByDay[d] })));
    } else {
      setWeeklyActivity(SAMPLE_WEEKLY);
    }
    setLoading(false);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <Card key={i} className="h-64 animate-pulse bg-muted/50" />
        ))}
      </div>
    );
  }

  const totalAttempts = prelimsData.reduce((s, d) => s + d.total, 0);
  const avgAccuracy = totalAttempts > 0
    ? Math.round(prelimsData.reduce((s, d) => s + d.accuracy * d.total, 0) / totalAttempts)
    : 0;
  const totalMainsSubmissions = mainsData.length;
  const avgMarks = totalMainsSubmissions > 0
    ? Math.round(mainsData.reduce((s, d) => s + d.marks, 0) / totalMainsSubmissions)
    : 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Your Activity Dashboard
        {isLocalMode && <span className="text-xs text-muted-foreground font-normal">(Demo Data)</span>}
      </h2>

      {/* Quick Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-4 border-0 bg-gradient-card shadow-sm">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <div>
              <p className="text-xl font-bold">{totalAttempts}</p>
              <p className="text-xs text-muted-foreground">MCQs Attempted</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-card shadow-sm">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-success" />
            <div>
              <p className="text-xl font-bold">{avgAccuracy}%</p>
              <p className="text-xs text-muted-foreground">Avg Accuracy</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-card shadow-sm">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-info" />
            <div>
              <p className="text-xl font-bold">{totalMainsSubmissions}</p>
              <p className="text-xs text-muted-foreground">Mains Answers</p>
            </div>
          </div>
        </Card>
        <Card className="p-4 border-0 bg-gradient-card shadow-sm">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-warning" />
            <div>
              <p className="text-xl font-bold">{avgMarks}</p>
              <p className="text-xs text-muted-foreground">Avg Mains Marks</p>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Weekly Activity</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={weeklyActivity}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="activities" stroke="hsl(20, 90%, 55%)" fill="hsl(20, 90%, 55%)" fillOpacity={0.2} strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Prelims Accuracy Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={prelimsData.length > 0 ? prelimsData : [{ day: "No data", accuracy: 0, total: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="day" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} domain={[0, 100]} />
                  <Tooltip formatter={(val: number) => `${val}%`} />
                  <Bar dataKey="accuracy" fill="hsl(145, 65%, 48%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Subject Distribution</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={subjectBreakdown.length > 0 ? subjectBreakdown : [{ name: "No data", value: 1 }]} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={3} dataKey="value" label={({ name }) => name}>
                    {(subjectBreakdown.length > 0 ? subjectBreakdown : [{ name: "No data", value: 1 }]).map((_, index) => (
                      <Cell key={`cell-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-2"><CardTitle className="text-sm font-semibold">Mains Score Trend</CardTitle></CardHeader>
          <CardContent>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mainsData.length > 0 ? mainsData : [{ attempt: "No data", marks: 0 }]}>
                  <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                  <XAxis dataKey="attempt" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="marks" stroke="hsl(210, 80%, 55%)" strokeWidth={2} dot={{ fill: "hsl(210, 80%, 55%)", r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ActivityDashboard;
