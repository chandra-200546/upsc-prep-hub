import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

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

const backendBase = () => {
  const configured = String(import.meta.env.VITE_BACKEND_URL || "").trim();
  if (configured) return configured.replace(/\/$/, "");
  return "http://localhost:8787";
};

const WeeklyTestSeries = () => {
  const { user, isLocalMode } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [tests, setTests] = useState<TestItem[]>([]);
  const [selectedTest, setSelectedTest] = useState<TestItem | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [announcement, setAnnouncement] = useState<WeeklyAnnouncement | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number; percentage: number } | null>(null);

  const selectedTestName = useMemo(() => selectedTest?.title || "Weekly Test", [selectedTest]);

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
  };

  const loadAnnouncement = async () => {
    const data = await api("/weekly-tests/announcement");
    setAnnouncement(data?.announcement || null);
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
          <Card className="border-primary/30 bg-primary/5">
            <CardHeader>
              <CardTitle className="text-lg">{announcement.title}</CardTitle>
              <CardDescription>{announcement.message}</CardDescription>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary">{announcement.week_label || "Weekly Update"}</Badge>
              <span>Starts: {announcement.starts_at ? new Date(announcement.starts_at).toLocaleString() : "-"}</span>
              <span>Ends: {announcement.ends_at ? new Date(announcement.ends_at).toLocaleString() : "-"}</span>
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
                    <span>#{row.rank} {row.name}</span>
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
