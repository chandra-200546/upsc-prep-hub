import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useToast } from "@/hooks/use-toast";
import { Bell, CalendarDays, Sparkles } from "lucide-react";

type TestItem = {
  id: string;
  title: string;
  description?: string | null;
  week_label?: string | null;
  duration_minutes: number;
  start_at?: string | null;
  end_at?: string | null;
  is_published?: boolean;
  questions_count: number;
};

type TestQuestion = {
  id: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
};

type WeeklyAnnouncement = {
  id: string;
  title: string;
  message: string;
  week_label?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
};

type LeaderboardRow = {
  rank: number;
  userId: string;
  name: string;
  profilePhotoUrl?: string | null;
  score: number;
  totalQuestions: number;
  percentage: number;
  submittedAt: string;
};

const backendBase = () => {
  const configured = String(import.meta.env.VITE_BACKEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:8787";
};

const formatAnnouncementWindow = (weekLabel?: string | null, startsAt?: string | null, endsAt?: string | null) => {
  const label = String(weekLabel || "").trim();
  if (label) return label;
  const start = startsAt ? new Date(startsAt).toLocaleString() : "";
  const end = endsAt ? new Date(endsAt).toLocaleString() : "";
  if (start && end) return `${start} to ${end}`;
  return start || end || "Weekly Update";
};

const formatDateRange = (startsAt?: string | null, endsAt?: string | null) => {
  const start = startsAt ? new Date(startsAt).toLocaleString() : "";
  const end = endsAt ? new Date(endsAt).toLocaleString() : "";
  if (start && end) return `${start} - ${end}`;
  return start || end || "";
};

const WeeklyTestSeries = () => {
  const { user, isLocalMode } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tests, setTests] = useState<TestItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leaderboard, setLeaderboard] = useState<LeaderboardRow[]>([]);
  const [announcement, setAnnouncement] = useState<WeeklyAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number; percentage: number } | null>(null);

  const selectedTestName = useMemo(() => selectedTest?.title || "Weekly Test", [selectedTest]);
  const initials = (name: string) =>
    String(name || "A")
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((x) => x[0]?.toUpperCase() || "")
      .join("") || "A";

  const api = async (path: string, options?: RequestInit & { auth?: boolean; admin?: boolean }) => {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(options?.headers as Record<string, string> || {}),
    };
    if (options?.auth) {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(`${backendBase()}/functions/v1${path}`, {
      ...options,
      headers,
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data?.message || data?.error || "Request failed");
    }
    return data;
  };

  const loadTests = async () => {
    const data = await api("/weekly-tests/list");
    setTests(data.tests || []);
    if (data?.announcement) {
      setAnnouncement(data.announcement);
    }
  };

  const loadAnnouncement = async () => {
    try {
      const data = await api("/weekly-tests/announcement");
      setAnnouncement(data?.announcement || null);
    } catch {
      // Keep whatever announcement came from /weekly-tests/list.
    }
  };

  const loadLeaderboard = async (testId: string) => {
    const data = await api(`/weekly-tests/${testId}/leaderboard`);
    setLeaderboard(data.leaderboard || []);
  };

  const openTest = async (test: TestItem) => {
    setSelectedTest(test);
    setAnswers({});
    setResult(null);
    const data = await api(`/weekly-tests/${test.id}`);
    setQuestions(data.questions || []);
    await loadLeaderboard(test.id);
  };

  const submitTest = async () => {
    if (!selectedTest) return;
    if (!Object.keys(answers).length) {
      toast({ title: "No answers", description: "Please answer at least one question.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        answers: Object.entries(answers).map(([questionId, selectedAnswer]) => ({ questionId, selectedAnswer })),
      };
      const data = await api(`/weekly-tests/${selectedTest.id}/submit`, {
        method: "POST",
        body: JSON.stringify(payload),
        auth: true,
      });
      setResult({ score: data.score, totalQuestions: data.totalQuestions, percentage: data.percentage });
      await loadLeaderboard(selectedTest.id);
      toast({ title: "Test submitted", description: `Score: ${data.score}/${data.totalQuestions}` });
    } catch (error: any) {
      toast({ title: "Submit failed", description: error?.message || "Could not submit test", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };


  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isLocalMode) {
      toast({ title: "Backend required", description: "Weekly Test Series requires backend-connected account.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    Promise.all([loadTests(), loadAnnouncement()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLocalMode]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading weekly tests...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Weekly Test Series</h1>
          <p className="text-sm text-muted-foreground">Prelims weekly tests with per-test leaderboard.</p>
        </div>

        {announcement && (
          <Card className="relative overflow-hidden border-0 shadow-lg bg-gradient-to-r from-blue-600 via-indigo-600 to-slate-800 text-white">
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
            <CardHeader className="relative pb-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-white/20">
                    <Bell className="h-4 w-4" />
                  </span>
                  <Badge className="bg-white/20 text-white hover:bg-white/25 border-0">
                    Weekly Test Announcement
                  </Badge>
                </div>
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/20 px-3 py-1 text-xs font-medium text-emerald-100">
                  <Sparkles className="h-3.5 w-3.5" />
                  Live
                </span>
              </div>
              <CardTitle className="text-xl text-white mt-3">{announcement.title}</CardTitle>
              <CardDescription className="text-white/90 text-sm leading-relaxed">
                {announcement.message}
              </CardDescription>
            </CardHeader>
            <CardContent className="relative pt-0 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <Badge className="bg-white text-slate-900 hover:bg-white/95 border-0">
                  {formatAnnouncementWindow(announcement.week_label, announcement.starts_at, announcement.ends_at)}
                </Badge>
                {formatDateRange(announcement.starts_at, announcement.ends_at) && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-white/15 px-3 py-1 text-white/90">
                    <CalendarDays className="h-3.5 w-3.5" />
                    {formatDateRange(announcement.starts_at, announcement.ends_at)}
                  </span>
                )}
              </div>
              <Button
                onClick={() => {
                  const firstPublished = tests[0];
                  if (firstPublished) {
                    void openTest(firstPublished);
                  }
                }}
                className="bg-white text-slate-900 hover:bg-white/90"
              >
                Start Weekly Test
              </Button>
            </CardContent>
          </Card>
        )}

        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {tests.map((test) => (
            <Card key={test.id} className="border">
              <CardHeader>
                <CardTitle className="text-lg">{test.title}</CardTitle>
                <CardDescription>{test.description || "Weekly prelims test"}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline">{test.week_label || "Current Week"}</Badge>
                  <Badge variant="secondary">{test.questions_count} Questions</Badge>
                  <Badge variant="outline">{test.duration_minutes} mins</Badge>
                </div>
                <Button className="w-full" onClick={() => openTest(test)}>Start Test</Button>
              </CardContent>
            </Card>
          ))}
          {tests.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                No weekly tests published yet.
              </CardContent>
            </Card>
          )}
        </div>

        {selectedTest && (
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader>
                <CardTitle>{selectedTestName}</CardTitle>
                <CardDescription>Answer all questions and submit.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {questions.map((q, idx) => (
                  <Card key={q.id} className="border">
                    <CardContent className="p-4 space-y-3">
                      <p className="font-medium">{idx + 1}. {q.question_text}</p>
                      {(["A", "B", "C", "D"] as const).map((opt) => {
                        const text = opt === "A" ? q.option_a : opt === "B" ? q.option_b : opt === "C" ? q.option_c : q.option_d;
                        return (
                          <label key={`${q.id}-${opt}`} className="flex items-center gap-2 text-sm">
                            <input
                              type="radio"
                              name={`q-${q.id}`}
                              checked={answers[q.id] === opt}
                              onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                            />
                            <span>{opt}. {text}</span>
                          </label>
                        );
                      })}
                    </CardContent>
                  </Card>
                ))}
                <Button onClick={submitTest} disabled={submitting}>
                  {submitting ? "Submitting..." : "Submit Test"}
                </Button>
                {result && (
                  <div className="rounded-md border p-3 text-sm">
                    Score: <span className="font-semibold">{result.score}/{result.totalQuestions}</span> ({result.percentage}%)
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Leaderboard</CardTitle>
                <CardDescription>{selectedTestName}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-2">
                {leaderboard.map((row) => (
                  <div key={row.userId} className="flex items-center justify-between rounded border p-2 text-sm">
                    <div className="flex items-center gap-2 min-w-0">
                      <Avatar className="h-7 w-7">
                        <AvatarImage src={row.profilePhotoUrl || ""} alt={row.name} />
                        <AvatarFallback>{initials(row.name)}</AvatarFallback>
                      </Avatar>
                      <span className="truncate">#{row.rank} {row.name}</span>
                    </div>
                    <span>{row.score}/{row.totalQuestions}</span>
                  </div>
                ))}
                {!leaderboard.length && <p className="text-sm text-muted-foreground">No attempts yet.</p>}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
};

export default WeeklyTestSeries;
