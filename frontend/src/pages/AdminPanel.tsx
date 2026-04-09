import { useEffect, useMemo, useState } from "react";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

type OverviewResponse = {
  admin?: { id: string; email: string };
  counts?: Record<string, number>;
  latest?: Record<string, string | null>;
};

type ActivityItem = {
  type: string;
  id: string;
  userId: string | null;
  email: string | null;
  name: string;
  summary: string;
  createdAt: string;
};

type UsersResponse = {
  page: number;
  limit: number;
  total: number;
  hasMore: boolean;
  users: Array<{
    id: string;
    email: string;
    accountName: string;
    accountCreatedAt: string;
    profileName: string;
    currentStreak: number;
    totalXp: number;
    level: number;
    lastLoginDate: string | null;
  }>;
};

type FullReportResponse = {
  admin?: { id: string; email: string };
  generatedAt?: string;
  database?: {
    tables: Array<{ name: string; rows: number }>;
    totalTables: number;
  };
  metrics?: {
    usersTotal: number;
    profilesTotal: number;
    activeSessions: number;
    notifications: number;
    doubt: { posts: number; answers: number; solved: number; likes: number; saves: number; shares: number };
    notes: { posts: number; likes: number; saves: number; shares: number };
    tests: { weeklyTests: number; weeklyQuestions: number; weeklyAttempts: number; prelimAttempts: number; mainsSubmissions: number };
    ai: { logs: number; cacheEntries: number };
  };
  latest?: Record<string, string | null>;
  topUsers?: Array<{
    id: string;
    email: string;
    name: string;
    total_xp: number;
    current_streak: number;
    level: number;
    created_at: string;
    last_login_date: string | null;
  }>;
  recent?: {
    doubts?: Array<{ id: string; title: string; category: string; status: string; created_at: string; author: string }>;
    notes?: Array<{ id: string; title: string; category: string; created_at: string; author: string }>;
    tests?: Array<{ id: string; title: string; week_label: string | null; is_published: boolean; created_at: string }>;
    aiLogs?: Array<{ id: number; function_name: string; cache_key: string | null; created_at: string }>;
  };
};

type WeeklyTestItem = {
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

const backendBase = () => String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

const formatTs = (value?: string | null) => {
  if (!value) return "-";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleString();
};

const AdminPanel = () => {
  const { toast } = useToast();
  const [accessChecked, setAccessChecked] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(false);
  const [overview, setOverview] = useState<OverviewResponse>({});
  const [activities, setActivities] = useState<ActivityItem[]>([]);
  const [users, setUsers] = useState<UsersResponse["users"]>([]);
  const [fullReport, setFullReport] = useState<FullReportResponse>({});
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "oldest" | "xp_desc">("newest");
  const [weeklyTests, setWeeklyTests] = useState<WeeklyTestItem[]>([]);
  const [weeklyBusy, setWeeklyBusy] = useState(false);
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

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const adminApi = async (path: string, options?: RequestInit) => {
    const headers = await authHeaders();
    const response = await fetch(`${backendBase()}/functions/v1${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...headers,
        ...(options?.headers || {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload?.message || payload?.error || "Request failed");
    }
    return payload;
  };

  const loadWeeklyTests = async () => {
    const data = await adminApi("/admin/panel/weekly-tests");
    setWeeklyTests(Array.isArray(data?.tests) ? data.tests : []);
  };

  const createWeeklyTest = async () => {
    setWeeklyBusy(true);
    try {
      await adminApi("/admin/panel/weekly-tests", {
        method: "POST",
        body: JSON.stringify({
          title: newTest.title,
          description: newTest.description,
          weekLabel: newTest.weekLabel,
          durationMinutes: Number(newTest.durationMinutes || 60),
          isPublished: false,
        }),
      });
      setNewTest({ title: "", description: "", weekLabel: "", durationMinutes: "60" });
      await loadWeeklyTests();
      await loadData();
      toast({ title: "Weekly test created" });
    } catch (error: any) {
      toast({ title: "Create failed", description: error?.message || "Could not create test", variant: "destructive" });
    } finally {
      setWeeklyBusy(false);
    }
  };

  const addWeeklyQuestion = async () => {
    setWeeklyBusy(true);
    try {
      await adminApi("/admin/panel/weekly-tests/question", {
        method: "POST",
        body: JSON.stringify(newQ),
      });
      setNewQ((prev) => ({
        ...prev,
        questionText: "",
        optionA: "",
        optionB: "",
        optionC: "",
        optionD: "",
        correctAnswer: "A",
        explanation: "",
      }));
      await loadWeeklyTests();
      await loadData();
      toast({ title: "Question added" });
    } catch (error: any) {
      toast({ title: "Add question failed", description: error?.message || "Could not add question", variant: "destructive" });
    } finally {
      setWeeklyBusy(false);
    }
  };

  const toggleWeeklyPublish = async (testId: string, isPublished: boolean) => {
    setWeeklyBusy(true);
    try {
      await adminApi("/admin/panel/weekly-tests/publish", {
        method: "POST",
        body: JSON.stringify({ testId, isPublished }),
      });
      await loadWeeklyTests();
      await loadData();
      toast({ title: isPublished ? "Test published" : "Test unpublished" });
    } catch (error: any) {
      toast({ title: "Publish update failed", description: error?.message || "Could not update publish status", variant: "destructive" });
    } finally {
      setWeeklyBusy(false);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      const headers = await authHeaders();

      const accessRes = await fetch(`${backendBase()}/functions/v1/admin/panel/access`, { headers });
      const accessPayload = await accessRes.json().catch(() => ({}));
      const allowed = Boolean(accessRes.ok && accessPayload?.isAdmin);
      setIsAdmin(allowed);
      setAccessChecked(true);
      if (!allowed) return;

      const [overviewRes, activityRes, usersRes, fullRes] = await Promise.all([
        fetch(`${backendBase()}/functions/v1/admin/panel/overview`, { headers }),
        fetch(`${backendBase()}/functions/v1/admin/panel/activity?limit=80`, { headers }),
        fetch(
          `${backendBase()}/functions/v1/admin/panel/users?limit=80&page=1&sort=${encodeURIComponent(sort)}${
            search.trim() ? `&search=${encodeURIComponent(search.trim())}` : ""
          }`,
          { headers },
        ),
        fetch(`${backendBase()}/functions/v1/admin/panel/full-report`, { headers }),
      ]);

      const overviewPayload = await overviewRes.json().catch(() => ({}));
      const activityPayload = await activityRes.json().catch(() => ({}));
      const usersPayload = await usersRes.json().catch(() => ({}));
      const fullPayload = await fullRes.json().catch(() => ({}));

      setOverview(overviewPayload || {});
      setActivities(Array.isArray(activityPayload?.items) ? activityPayload.items : []);
      setUsers(Array.isArray(usersPayload?.users) ? usersPayload.users : []);
      setFullReport(fullPayload || {});
      try {
        const weeklyPayload = await adminApi("/admin/panel/weekly-tests");
        setWeeklyTests(Array.isArray(weeklyPayload?.tests) ? weeklyPayload.tests : []);
      } catch {
        setWeeklyTests([]);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sort]);

  const filteredActivities = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return activities;
    return activities.filter(
      (a) =>
        String(a.summary || "").toLowerCase().includes(q) ||
        String(a.email || "").toLowerCase().includes(q) ||
        String(a.name || "").toLowerCase().includes(q),
    );
  }, [activities, search]);

  return (
    <DashboardLayout>
      <div className="w-full max-w-7xl mx-auto p-3 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Admin Panel</h1>
            <p className="text-sm text-muted-foreground">Central backend activity and user data monitoring.</p>
          </div>
          <div className="flex items-center gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search users/activity"
              className="w-[220px]"
            />
            <Select value={sort} onValueChange={(v) => setSort(v as "newest" | "oldest" | "xp_desc")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="newest">Newest</SelectItem>
                <SelectItem value="oldest">Oldest</SelectItem>
                <SelectItem value="xp_desc">XP High-Low</SelectItem>
              </SelectContent>
            </Select>
            <Button onClick={() => void loadData()} disabled={loading}>{loading ? "Refreshing..." : "Refresh"}</Button>
          </div>
        </div>

        {accessChecked && !isAdmin && (
          <Card className="p-4 text-sm text-destructive">Unauthorized admin access. This panel is restricted.</Card>
        )}

        {isAdmin && (
          <>
            <Card className="p-4">
              <h2 className="font-semibold mb-2">Complete Website Snapshot</h2>
              <p className="text-xs text-muted-foreground">
                Generated at: {formatTs(fullReport.generatedAt)} | Tables: {Number(fullReport.database?.totalTables || 0)}
              </p>
            </Card>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
              {Object.entries(overview.counts || {}).map(([key, val]) => (
                <Card key={key} className="p-3">
                  <p className="text-xs text-muted-foreground">{key}</p>
                  <p className="text-xl font-bold">{Number(val || 0)}</p>
                </Card>
              ))}
            </div>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              <Card className="p-3"><p className="text-xs text-muted-foreground">Users Total</p><p className="text-xl font-bold">{Number(fullReport.metrics?.usersTotal || 0)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Active Sessions</p><p className="text-xl font-bold">{Number(fullReport.metrics?.activeSessions || 0)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Doubt Posts</p><p className="text-xl font-bold">{Number(fullReport.metrics?.doubt?.posts || 0)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Notes Posts</p><p className="text-xl font-bold">{Number(fullReport.metrics?.notes?.posts || 0)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">Weekly Attempts</p><p className="text-xl font-bold">{Number(fullReport.metrics?.tests?.weeklyAttempts || 0)}</p></Card>
              <Card className="p-3"><p className="text-xs text-muted-foreground">AI Logs</p><p className="text-xl font-bold">{Number(fullReport.metrics?.ai?.logs || 0)}</p></Card>
            </div>

            <Card className="p-4">
              <h2 className="font-semibold mb-2">Latest Timestamps</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                {Object.entries(fullReport.latest || overview.latest || {}).map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <span className="text-muted-foreground">{k}</span>
                    <span>{formatTs(v)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 overflow-auto">
              <h2 className="font-semibold mb-3">Database Tables</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 text-sm">
                {(fullReport.database?.tables || []).map((t) => (
                  <div key={t.name} className="flex items-center justify-between border rounded-md px-3 py-2">
                    <span className="text-muted-foreground">{t.name}</span>
                    <span className="font-semibold">{Number(t.rows || 0)}</span>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 overflow-auto">
              <h2 className="font-semibold mb-3">Top Users by XP</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">XP</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">Streak</th>
                    <th className="py-2 pr-3">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {(fullReport.topUsers || []).map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 pr-3">{u.name}</td>
                      <td className="py-2 pr-3">{u.email}</td>
                      <td className="py-2 pr-3">{Number(u.total_xp || 0)}</td>
                      <td className="py-2 pr-3">{Number(u.level || 1)}</td>
                      <td className="py-2 pr-3">{Number(u.current_streak || 0)}</td>
                      <td className="py-2 pr-3">{formatTs(u.last_login_date)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="p-4 overflow-auto">
              <h2 className="font-semibold mb-3">Users</h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-3">Email</th>
                    <th className="py-2 pr-3">Name</th>
                    <th className="py-2 pr-3">Level</th>
                    <th className="py-2 pr-3">XP</th>
                    <th className="py-2 pr-3">Streak</th>
                    <th className="py-2 pr-3">Last Login</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => (
                    <tr key={u.id} className="border-b">
                      <td className="py-2 pr-3">{u.email}</td>
                      <td className="py-2 pr-3">{u.profileName}</td>
                      <td className="py-2 pr-3">{u.level}</td>
                      <td className="py-2 pr-3">{u.totalXp}</td>
                      <td className="py-2 pr-3">{u.currentStreak}</td>
                      <td className="py-2 pr-3">{formatTs(u.lastLoginDate)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>

            <Card className="p-4 overflow-auto">
              <h2 className="font-semibold mb-3">Recent Activity</h2>
              <div className="space-y-2">
                {filteredActivities.map((a) => (
                  <div key={`${a.type}-${a.id}`} className="border rounded-md p-3 flex flex-col md:flex-row md:items-center md:justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary">{a.type}</Badge>
                        <span className="font-medium">{a.name}</span>
                        <span className="text-muted-foreground">{a.email || "-"}</span>
                      </div>
                      <p className="text-sm">{a.summary}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatTs(a.createdAt)}</p>
                  </div>
                ))}
              </div>
            </Card>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4 overflow-auto">
                <h2 className="font-semibold mb-3">Recent Doubts</h2>
                <div className="space-y-2">
                  {(fullReport.recent?.doubts || []).map((d) => (
                    <div key={d.id} className="border rounded-md px-3 py-2 text-sm">
                      <p className="font-medium">{d.title}</p>
                      <p className="text-muted-foreground">{d.author} • {d.category} • {d.status} • {formatTs(d.created_at)}</p>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 overflow-auto">
                <h2 className="font-semibold mb-3">Recent Notes</h2>
                <div className="space-y-2">
                  {(fullReport.recent?.notes || []).map((n) => (
                    <div key={n.id} className="border rounded-md px-3 py-2 text-sm">
                      <p className="font-medium">{n.title}</p>
                      <p className="text-muted-foreground">{n.author} • {n.category} • {formatTs(n.created_at)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <Card className="p-4 overflow-auto lg:col-span-2">
                <h2 className="font-semibold mb-3">Weekly Test Series Management</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
                  <Input
                    placeholder="Test title"
                    value={newTest.title}
                    onChange={(e) => setNewTest((p) => ({ ...p, title: e.target.value }))}
                  />
                  <Input
                    placeholder="Week label"
                    value={newTest.weekLabel}
                    onChange={(e) => setNewTest((p) => ({ ...p, weekLabel: e.target.value }))}
                  />
                  <Input
                    placeholder="Duration minutes"
                    value={newTest.durationMinutes}
                    onChange={(e) => setNewTest((p) => ({ ...p, durationMinutes: e.target.value }))}
                  />
                  <Button onClick={() => void createWeeklyTest()} disabled={weeklyBusy}>
                    {weeklyBusy ? "Saving..." : "Create Test"}
                  </Button>
                </div>
                <div className="mt-3">
                  <Input
                    placeholder="Description"
                    value={newTest.description}
                    onChange={(e) => setNewTest((p) => ({ ...p, description: e.target.value }))}
                  />
                </div>

                <div className="mt-4 grid grid-cols-1 gap-2 md:grid-cols-2">
                  {weeklyTests.map((t) => (
                    <div key={t.id} className="rounded border p-2 text-sm flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-muted-foreground">{t.week_label || "-"} • {t.questions_count}Q</p>
                      </div>
                      <Button size="sm" variant="outline" onClick={() => void toggleWeeklyPublish(t.id, !t.is_published)} disabled={weeklyBusy}>
                        {t.is_published ? "Unpublish" : "Publish"}
                      </Button>
                    </div>
                  ))}
                </div>

                <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-3">
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={newQ.testId}
                    onChange={(e) => setNewQ((p) => ({ ...p, testId: e.target.value }))}
                  >
                    <option value="">Select Test</option>
                    {weeklyTests.map((t) => (
                      <option key={t.id} value={t.id}>{t.title}</option>
                    ))}
                  </select>
                  <Input
                    placeholder="Correct (A/B/C/D)"
                    value={newQ.correctAnswer}
                    onChange={(e) => setNewQ((p) => ({ ...p, correctAnswer: e.target.value.toUpperCase() }))}
                  />
                  <Button onClick={() => void addWeeklyQuestion()} disabled={weeklyBusy}>
                    {weeklyBusy ? "Saving..." : "Add Question"}
                  </Button>
                </div>
                <div className="mt-3">
                  <Input
                    placeholder="Question text"
                    value={newQ.questionText}
                    onChange={(e) => setNewQ((p) => ({ ...p, questionText: e.target.value }))}
                  />
                </div>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <Input placeholder="Option A" value={newQ.optionA} onChange={(e) => setNewQ((p) => ({ ...p, optionA: e.target.value }))} />
                  <Input placeholder="Option B" value={newQ.optionB} onChange={(e) => setNewQ((p) => ({ ...p, optionB: e.target.value }))} />
                  <Input placeholder="Option C" value={newQ.optionC} onChange={(e) => setNewQ((p) => ({ ...p, optionC: e.target.value }))} />
                  <Input placeholder="Option D" value={newQ.optionD} onChange={(e) => setNewQ((p) => ({ ...p, optionD: e.target.value }))} />
                </div>
                <div className="mt-3">
                  <Input
                    placeholder="Explanation (optional)"
                    value={newQ.explanation}
                    onChange={(e) => setNewQ((p) => ({ ...p, explanation: e.target.value }))}
                  />
                </div>
              </Card>

              <Card className="p-4 overflow-auto">
                <h2 className="font-semibold mb-3">Recent Weekly Tests</h2>
                <div className="space-y-2">
                  {(fullReport.recent?.tests || []).map((t) => (
                    <div key={t.id} className="border rounded-md px-3 py-2 text-sm flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium">{t.title}</p>
                        <p className="text-muted-foreground">{t.week_label || "-"} • {formatTs(t.created_at)}</p>
                      </div>
                      <Badge variant={t.is_published ? "default" : "secondary"}>{t.is_published ? "Published" : "Draft"}</Badge>
                    </div>
                  ))}
                </div>
              </Card>

              <Card className="p-4 overflow-auto">
                <h2 className="font-semibold mb-3">Recent AI Logs</h2>
                <div className="space-y-2">
                  {(fullReport.recent?.aiLogs || []).map((l) => (
                    <div key={String(l.id)} className="border rounded-md px-3 py-2 text-sm">
                      <p className="font-medium">{l.function_name}</p>
                      <p className="text-muted-foreground">cache: {l.cache_key || "-"} • {formatTs(l.created_at)}</p>
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </>
        )}
      </div>
    </DashboardLayout>
  );
};

export default AdminPanel;
