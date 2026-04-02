import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
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

interface ActivityDashboardProps {
  profile: any;
}

const ActivityDashboard = ({ profile }: ActivityDashboardProps) => {
  const [prelimsData, setPrelimsData] = useState<any[]>([]);
  const [mainsData, setMainsData] = useState<any[]>([]);
  const [subjectBreakdown, setSubjectBreakdown] = useState<any[]>([]);
  const [weeklyActivity, setWeeklyActivity] = useState<any[]>([]);
  const [mainsSubmissionCount, setMainsSubmissionCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchActivityData();
    const onFocus = () => fetchActivityData();
    window.addEventListener("focus", onFocus);

    return () => {
      window.removeEventListener("focus", onFocus);
    };
  }, []);

  const fetchActivityData = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) { setLoading(false); return; }

    const userId = session.user.id;

    const { data: attempts } = await supabase
      .from("prelims_attempts")
      .select("*")
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

        const subject = a.subject || "Unknown";
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
    }

    if (submissions && submissions.length > 0) {
      setMainsSubmissionCount(submissions.length);
      const scoredSubmissions = submissions.filter((s: any) => typeof s.marks === "number");
      setMainsData(
        scoredSubmissions.slice(-10).map((s: any, i: number) => ({
          attempt: `#${i + 1}`, marks: s.marks || 0, words: s.word_count || 0,
        }))
      );
    } else {
      setMainsSubmissionCount(0);
      setMainsData([]);
    }

    // Build rolling 7-day buckets so activity updates accurately with new attempts.
    const last7Days = Array.from({ length: 7 }, (_, i) => {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - (6 - i));
      return d;
    });

    const toDateKey = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;

    const activityByDate: Record<string, number> = {};
    last7Days.forEach((d) => {
      activityByDate[toDateKey(d)] = 0;
    });

    attempts?.forEach((a: any) => {
      if (!a.attempted_at) return;
      const d = new Date(a.attempted_at);
      d.setHours(0, 0, 0, 0);
      const key = toDateKey(d);
      if (activityByDate[key] !== undefined) activityByDate[key]++;
    });

    submissions?.forEach((s: any) => {
      if (!s.submitted_at) return;
      const d = new Date(s.submitted_at);
      d.setHours(0, 0, 0, 0);
      const key = toDateKey(d);
      if (activityByDate[key] !== undefined) activityByDate[key]++;
    });

    setWeeklyActivity(
      last7Days.map((d) => ({
        day: d.toLocaleDateString("en-US", { weekday: "short" }),
        activities: activityByDate[toDateKey(d)] || 0,
      }))
    );
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

  const totalAttempts = prelimsData.reduce((s, d) => s + (d.total || 0), 0);
  const avgAccuracy = totalAttempts > 0
    ? Math.round(prelimsData.reduce((s, d) => s + (d.accuracy || 0) * (d.total || 0), 0) / totalAttempts)
    : 0;
  const totalMainsSubmissions = mainsData.length;
  const avgMarks = totalMainsSubmissions > 0
    ? Math.round(mainsData.reduce((s, d) => s + (d.marks || 0), 0) / totalMainsSubmissions)
    : 0;

  const hasNoData = prelimsData.length === 0 && mainsSubmissionCount === 0;

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold flex items-center gap-2">
        <TrendingUp className="w-5 h-5 text-primary" />
        Your Activity Dashboard
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
              <p className="text-xl font-bold">{mainsSubmissionCount}</p>
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

      {hasNoData && (
        <Card className="p-6 border-0 shadow-sm text-center">
          <p className="text-muted-foreground">No activity data yet. Start practicing Prelims MCQs or submit Mains answers to see your analytics here!</p>
        </Card>
      )}

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
