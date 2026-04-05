import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-local-auth";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<{ score: number; totalQuestions: number; percentage: number } | null>(null);

  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [adminToken, setAdminToken] = useState(() => sessionStorage.getItem("weekly_admin_token") || "");
  const [adminTests, setAdminTests] = useState<TestItem[]>([]);
  const [newTest, setNewTest] = useState({ title: "", description: "", weekLabel: "", durationMinutes: "60" });
  const [newQ, setNewQ] = useState({
    testId: "",
    questionText: "",
    optionA: "",
    optionB: "",
    optionC: "",
    optionD: "",
    correctAnswer: "A",
    explanation: "",
  });

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
    if (options?.admin && adminToken) {
      headers["X-Weekly-Admin-Token"] = adminToken;
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

  const loadAdminTests = async () => {
    if (!adminToken) return;
    const data = await api("/weekly-tests/admin/tests", { admin: true });
    setAdminTests(data.tests || []);
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

  const adminLogin = async () => {
    try {
      const data = await api("/weekly-tests/admin/login", {
        method: "POST",
        body: JSON.stringify({ email: adminEmail, password: adminPassword }),
      });
      setAdminToken(data.token || "");
      sessionStorage.setItem("weekly_admin_token", data.token || "");
      toast({ title: "Admin access granted" });
      await loadAdminTests();
    } catch (error: any) {
      toast({ title: "Admin login failed", description: error?.message || "Invalid admin credentials", variant: "destructive" });
    }
  };

  const createTest = async () => {
    try {
      await api("/weekly-tests/admin/create", {
        method: "POST",
        admin: true,
        body: JSON.stringify({
          title: newTest.title,
          description: newTest.description,
          weekLabel: newTest.weekLabel,
          durationMinutes: Number(newTest.durationMinutes || 60),
          isPublished: false,
        }),
      });
      setNewTest({ title: "", description: "", weekLabel: "", durationMinutes: "60" });
      await loadAdminTests();
      await loadTests();
      toast({ title: "Weekly test created" });
    } catch (error: any) {
      toast({ title: "Create failed", description: error?.message || "Could not create test", variant: "destructive" });
    }
  };

  const addQuestion = async () => {
    try {
      await api("/weekly-tests/admin/question", {
        method: "POST",
        admin: true,
        body: JSON.stringify(newQ),
      });
      setNewQ({
        testId: newQ.testId,
        questionText: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "A",
        explanation: "",
      });
      await loadAdminTests();
      await loadTests();
      toast({ title: "Question added" });
    } catch (error: any) {
      toast({ title: "Add question failed", description: error?.message || "Could not add question", variant: "destructive" });
    }
  };

  const togglePublish = async (testId: string, isPublished: boolean) => {
    try {
      await api("/weekly-tests/admin/publish", {
        method: "POST",
        admin: true,
        body: JSON.stringify({ testId, isPublished }),
      });
      await loadAdminTests();
      await loadTests();
    } catch (error: any) {
      toast({ title: "Publish update failed", description: error?.message || "Could not update publish status", variant: "destructive" });
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
    Promise.all([loadTests(), adminToken ? loadAdminTests() : Promise.resolve()])
      .finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLocalMode, adminToken]);

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

        <Card>
          <CardHeader>
            <CardTitle>Admin Access (Weekly Tests)</CardTitle>
            <CardDescription>Only authorized admin can create tests and add questions.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {!adminToken ? (
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <Input placeholder="Admin Email" value={adminEmail} onChange={(e) => setAdminEmail(e.target.value)} />
                <Input type="password" placeholder="Admin Password" value={adminPassword} onChange={(e) => setAdminPassword(e.target.value)} />
                <Button onClick={adminLogin}>Unlock Admin</Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Input placeholder="Test title" value={newTest.title} onChange={(e) => setNewTest((p) => ({ ...p, title: e.target.value }))} />
                  <Input placeholder="Week label" value={newTest.weekLabel} onChange={(e) => setNewTest((p) => ({ ...p, weekLabel: e.target.value }))} />
                  <Input placeholder="Duration minutes" value={newTest.durationMinutes} onChange={(e) => setNewTest((p) => ({ ...p, durationMinutes: e.target.value }))} />
                  <Button onClick={createTest}>Create Test</Button>
                </div>
                <Input placeholder="Description" value={newTest.description} onChange={(e) => setNewTest((p) => ({ ...p, description: e.target.value }))} />

                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  {adminTests.map((t) => (
                    <div key={t.id} className="rounded border p-2 text-sm flex items-center justify-between">
                      <span>{t.title} ({t.questions_count}Q)</span>
                      <Button size="sm" variant="outline" onClick={() => togglePublish(t.id, !t.is_published)}>
                        {t.is_published ? "Unpublish" : "Publish"}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                  <Label className="md:col-span-3">Add Question</Label>
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={newQ.testId}
                    onChange={(e) => setNewQ((p) => ({ ...p, testId: e.target.value }))}
                  >
                    <option value="">Select Test</option>
                    {adminTests.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <Input placeholder="Correct (A/B/C/D)" value={newQ.correctAnswer} onChange={(e) => setNewQ((p) => ({ ...p, correctAnswer: e.target.value.toUpperCase() }))} />
                  <Button onClick={addQuestion}>Add Question</Button>
                </div>
                <Input placeholder="Question text" value={newQ.questionText} onChange={(e) => setNewQ((p) => ({ ...p, questionText: e.target.value }))} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input placeholder="Option A" value={newQ.optionA} onChange={(e) => setNewQ((p) => ({ ...p, optionA: e.target.value }))} />
                  <Input placeholder="Option B" value={newQ.optionB} onChange={(e) => setNewQ((p) => ({ ...p, optionB: e.target.value }))} />
                  <Input placeholder="Option C" value={newQ.optionC} onChange={(e) => setNewQ((p) => ({ ...p, optionC: e.target.value }))} />
                  <Input placeholder="Option D" value={newQ.optionD} onChange={(e) => setNewQ((p) => ({ ...p, optionD: e.target.value }))} />
                </div>
                <Input placeholder="Explanation (optional)" value={newQ.explanation} onChange={(e) => setNewQ((p) => ({ ...p, explanation: e.target.value }))} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </DashboardLayout>
  );
};

export default WeeklyTestSeries;

