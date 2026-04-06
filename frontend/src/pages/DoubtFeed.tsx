import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { useAuth } from "@/hooks/use-local-auth";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { MessageSquare, Search, ThumbsUp, CheckCircle2, Flag, Paperclip } from "lucide-react";

type FeedPost = {
  id: string;
  userId: string;
  title: string;
  description: string;
  preview: string;
  category: string;
  tags: string[];
  imageUrl?: string | null;
  answerCount: number;
  status: "unanswered" | "answered" | "solved";
  createdAt: string;
  author: { id: string; name: string };
};

type FeedAnswer = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  helpfulCount: number;
  isBestAnswer: boolean;
  hasVoted: boolean;
  createdAt: string;
  author: { id: string; name: string };
};

type FeedDetail = {
  post: FeedPost & {
    bestAnswerId?: string | null;
  };
  answers: FeedAnswer[];
};

const CATEGORIES = [
  "Polity",
  "History",
  "Geography",
  "Economy",
  "Environment",
  "Science & Tech",
  "Ethics",
  "Essay",
  "Current Affairs",
  "CSAT",
  "Optional",
  "Prelims",
  "Mains",
  "Interview",
];

const SORT_OPTIONS = [
  { value: "latest", label: "Latest" },
  { value: "most_answered", label: "Most Answered" },
  { value: "unanswered", label: "Unanswered First" },
] as const;

const STATUS_OPTIONS = [
  { value: "all", label: "All" },
  { value: "unanswered", label: "Unanswered" },
  { value: "answered", label: "Answered" },
  { value: "solved", label: "Solved" },
] as const;

const OFFTOPIC_HINTS = ["coding", "movie", "sports", "meme", "song", "relationship", "promotion"];

const backendBase = () => String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

const DoubtFeed = () => {
  const navigate = useNavigate();
  const { user, isLocalMode } = useAuth();
  const { toast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [selectedPostId, setSelectedPostId] = useState("");
  const [detail, setDetail] = useState<FeedDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("latest");

  const [askOpen, setAskOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Polity",
    tags: "",
    upscOnlyConfirmed: false,
    imageFile: null as File | null,
  });
  const [answerText, setAnswerText] = useState("");
  const [editingPost, setEditingPost] = useState(false);
  const [editPostForm, setEditPostForm] = useState({ title: "", description: "", category: "Polity", tags: "" });
  const [editingAnswerId, setEditingAnswerId] = useState("");
  const [editingAnswerText, setEditingAnswerText] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const api = async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${backendBase()}/functions/v1${path}`, {
      ...init,
      headers,
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.error || "Request failed");
    return payload;
  };

  const loadFeed = async () => {
    const query = new URLSearchParams({
      search,
      category: categoryFilter,
      status: statusFilter,
      sort,
      page: "1",
      limit: "30",
    });
    const payload = await api(`/doubts?${query.toString()}`);
    setPosts(payload.posts || []);
    if (!selectedPostId && payload.posts?.[0]?.id) setSelectedPostId(payload.posts[0].id);
  };

  const loadDetail = async (postId: string) => {
    if (!postId) {
      setDetail(null);
      return;
    }
    setDetailLoading(true);
    try {
      const payload = await api(`/doubts/${postId}`);
      setDetail(payload);
      setEditPostForm({
        title: payload?.post?.title || "",
        description: payload?.post?.description || "",
        category: payload?.post?.category || "Polity",
        tags: Array.isArray(payload?.post?.tags) ? payload.post.tags.join(", ") : "",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const preSubmitWarning = useMemo(() => {
    const text = `${form.title} ${form.description}`.toLowerCase();
    const hasOfftopic = OFFTOPIC_HINTS.some((k) => text.includes(k));
    if (hasOfftopic) return "This content may be reviewed by moderation.";
    return "";
  }, [form.description, form.title]);

  const uploadImageIfAny = async () => {
    if (!form.imageFile) return "";
    const ext = form.imageFile.name.split(".").pop() || "png";
    const path = `doubt-feed/${user?.id || "anon"}/${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("media").upload(path, form.imageFile);
    if (upload.error) throw new Error(upload.error.message || "Image upload failed");
    const publicUrl = supabase.storage.from("media").getPublicUrl(path).data.publicUrl;
    return publicUrl || "";
  };

  const submitDoubt = async () => {
    if (!form.upscOnlyConfirmed) {
      toast({ title: "Please confirm", description: "Accept UPSC-only community rule before posting.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const imageUrl = await uploadImageIfAny();
      const payload = await api("/doubts/create", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          category: form.category,
          tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
          imageUrl: imageUrl || undefined,
        }),
      });
      setAskOpen(false);
      setForm({ title: "", description: "", category: "Polity", tags: "", upscOnlyConfirmed: false, imageFile: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      try {
        await loadFeed();
        if (payload?.id) {
          setSelectedPostId(payload.id);
          await loadDetail(payload.id);
        }
      } catch {
        // Keep post success even if immediate refresh fails on slow/backoff backends.
      }
      toast({ title: "Doubt posted", description: "Your UPSC doubt is now live in the feed." });
    } catch (error: any) {
      toast({ title: "Post failed", description: error?.message || "Unable to create doubt", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const submitAnswer = async () => {
    if (!detail?.post?.id || !answerText.trim()) return;
    try {
      await api(`/doubts/${detail.post.id}/answers/create`, {
        method: "POST",
        body: JSON.stringify({ content: answerText }),
      });
      setAnswerText("");
      await Promise.all([loadFeed(), loadDetail(detail.post.id)]);
      toast({ title: "Answer posted" });
    } catch (error: any) {
      toast({ title: "Answer failed", description: error?.message || "Unable to post answer", variant: "destructive" });
    }
  };

  const updatePost = async () => {
    if (!detail?.post?.id) return;
    try {
      await api(`/doubts/${detail.post.id}/update`, {
        method: "POST",
        body: JSON.stringify({
          title: editPostForm.title,
          description: editPostForm.description,
          category: editPostForm.category,
          tags: editPostForm.tags.split(",").map((t) => t.trim()).filter(Boolean),
        }),
      });
      setEditingPost(false);
      await Promise.all([loadFeed(), loadDetail(detail.post.id)]);
      toast({ title: "Doubt updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Unable to update doubt", variant: "destructive" });
    }
  };

  const deletePost = async () => {
    if (!detail?.post?.id) return;
    const ok = window.confirm("Delete this doubt permanently?");
    if (!ok) return;
    try {
      await api(`/doubts/${detail.post.id}/delete`, { method: "POST" });
      setDetail(null);
      setSelectedPostId("");
      await loadFeed();
      toast({ title: "Doubt deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Unable to delete doubt", variant: "destructive" });
    }
  };

  const voteAnswer = async (answerId: string) => {
    try {
      await api(`/answers/${answerId}/vote`, { method: "POST" });
      if (detail?.post.id) await loadDetail(detail.post.id);
    } catch (error: any) {
      toast({ title: "Vote failed", description: error?.message || "Unable to vote", variant: "destructive" });
    }
  };

  const markBest = async (answerId: string) => {
    if (!detail?.post.id) return;
    try {
      await api(`/doubts/${detail.post.id}/best-answer`, {
        method: "POST",
        body: JSON.stringify({ answerId }),
      });
      await Promise.all([loadFeed(), loadDetail(detail.post.id)]);
      toast({ title: "Best answer selected" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Unable to mark best answer", variant: "destructive" });
    }
  };

  const startEditAnswer = (answer: FeedAnswer) => {
    setEditingAnswerId(answer.id);
    setEditingAnswerText(answer.content);
  };

  const saveAnswerEdit = async (answerId: string) => {
    if (!detail?.post.id) return;
    try {
      await api(`/answers/${answerId}/update`, {
        method: "POST",
        body: JSON.stringify({ content: editingAnswerText }),
      });
      setEditingAnswerId("");
      setEditingAnswerText("");
      await loadDetail(detail.post.id);
      toast({ title: "Answer updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Unable to update answer", variant: "destructive" });
    }
  };

  const deleteAnswer = async (answerId: string) => {
    if (!detail?.post.id) return;
    const ok = window.confirm("Delete this answer permanently?");
    if (!ok) return;
    try {
      await api(`/answers/${answerId}/delete`, { method: "POST" });
      await Promise.all([loadFeed(), loadDetail(detail.post.id)]);
      toast({ title: "Answer deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Unable to delete answer", variant: "destructive" });
    }
  };

  const reportTarget = async (targetType: "post" | "answer", targetId: string) => {
    const reason = window.prompt("Reason (off-topic / spam / abusive / irrelevant / duplicate)", "off-topic");
    if (!reason) return;
    try {
      const route = targetType === "post" ? `/doubts/${targetId}/report` : `/answers/${targetId}/report`;
      await api(route, { method: "POST", body: JSON.stringify({ reason }) });
      toast({ title: "Reported", description: "Thanks. This report has been recorded for moderation." });
      if (detail?.post.id) await loadDetail(detail.post.id);
      await loadFeed();
    } catch (error: any) {
      toast({ title: "Report failed", description: error?.message || "Unable to report", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isLocalMode) {
      toast({ title: "Backend required", description: "UPSC Doubt Feed needs backend-connected account.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    setLoading(true);
    loadFeed().finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLocalMode, navigate, search, categoryFilter, statusFilter, sort]);

  useEffect(() => {
    const fromQuery = searchParams.get("postId");
    if (fromQuery) setSelectedPostId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedPostId) return;
    setSearchParams((prev) => {
      prev.set("postId", selectedPostId);
      return prev;
    });
    loadDetail(selectedPostId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPostId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading UPSC doubt feed...</div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">UPSC Doubt Feed</h1>
            <p className="text-sm text-muted-foreground">Ask and solve UPSC doubts in a focused academic community.</p>
          </div>
          <Dialog open={askOpen} onOpenChange={setAskOpen}>
            <DialogTrigger asChild>
              <Button><MessageSquare className="mr-2 h-4 w-4" />Ask Doubt</Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Ask a UPSC Doubt</DialogTitle>
                <DialogDescription>Only UPSC-related doubts are allowed in this feed.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title (10-180 chars)" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                <Textarea placeholder="Detailed doubt (20-5000 chars)" value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select
                    className="rounded-md border bg-background px-3 py-2 text-sm"
                    value={form.category}
                    onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}
                  >
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                  <Input placeholder="Tags (comma separated)" value={form.tags} onChange={(e) => setForm((p) => ({ ...p, tags: e.target.value }))} />
                </div>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*,.pdf,.doc,.docx"
                    className="hidden"
                    onChange={(e) => setForm((p) => ({ ...p, imageFile: e.target.files?.[0] || null }))}
                  />
                  <div className="flex items-center gap-2">
                    <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                      <Paperclip className="mr-2 h-4 w-4" />
                      Add File
                    </Button>
                    {form.imageFile && <span className="text-xs text-muted-foreground truncate">{form.imageFile.name}</span>}
                  </div>
                <div className="flex items-center gap-2 rounded border p-3 text-sm">
                  <Checkbox
                    checked={form.upscOnlyConfirmed}
                    onCheckedChange={(checked) => setForm((p) => ({ ...p, upscOnlyConfirmed: Boolean(checked) }))}
                  />
                  <span>Only UPSC-related doubts are allowed.</span>
                </div>
                {preSubmitWarning && (
                  <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                    This feed is only for UPSC-related doubts to maintain learning quality.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAskOpen(false)}>Cancel</Button>
                <Button onClick={submitDoubt} disabled={submitting}>{submitting ? "Posting..." : "Post Doubt"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search doubts..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
                  {STATUS_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"])}>
                  {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            {posts.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  No doubts found. Be the first to ask a UPSC doubt.
                </CardContent>
              </Card>
            )}
            {posts.map((post) => (
              <Card key={post.id} className={`cursor-pointer transition ${selectedPostId === post.id ? "border-primary shadow-sm" : ""}`} onClick={() => setSelectedPostId(post.id)}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{post.title}</CardTitle>
                    <Badge variant={post.status === "solved" ? "default" : post.status === "answered" ? "secondary" : "outline"}>
                      {post.status}
                    </Badge>
                  </div>
                  <CardDescription>{post.author.name} • {new Date(post.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{post.preview}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{post.category}</Badge>
                    <Badge variant="secondary">{post.answerCount} answers</Badge>
                    {post.tags.slice(0, 3).map((tag) => <Badge key={tag} variant="outline">#{tag}</Badge>)}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selectedPostId && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Select a doubt to view details.</CardContent>
              </Card>
            )}

            {selectedPostId && detailLoading && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading doubt details...</CardContent>
              </Card>
            )}

            {selectedPostId && detail && !detailLoading && (
              <div className="space-y-4">
                <Card>
                  <CardHeader>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <CardTitle className="text-xl">{detail.post.title}</CardTitle>
                        <CardDescription>{detail.post.author.name} • {new Date(detail.post.createdAt).toLocaleString()}</CardDescription>
                      </div>
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{detail.post.category}</Badge>
                        <Button size="sm" variant="outline" onClick={() => reportTarget("post", detail.post.id)}>
                          <Flag className="mr-1 h-4 w-4" />Report
                        </Button>
                        {user?.id === detail.post.userId && (
                          <>
                            <Button size="sm" variant="outline" onClick={() => setEditingPost((v) => !v)}>
                              {editingPost ? "Cancel Edit" : "Edit"}
                            </Button>
                            <Button size="sm" variant="destructive" onClick={deletePost}>Delete</Button>
                          </>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {editingPost ? (
                      <div className="space-y-3 rounded-md border p-3">
                        <Input value={editPostForm.title} onChange={(e) => setEditPostForm((p) => ({ ...p, title: e.target.value }))} />
                        <Textarea value={editPostForm.description} onChange={(e) => setEditPostForm((p) => ({ ...p, description: e.target.value }))} />
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                          <select
                            className="rounded-md border bg-background px-3 py-2 text-sm"
                            value={editPostForm.category}
                            onChange={(e) => setEditPostForm((p) => ({ ...p, category: e.target.value }))}
                          >
                            {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                          </select>
                          <Input value={editPostForm.tags} onChange={(e) => setEditPostForm((p) => ({ ...p, tags: e.target.value }))} />
                        </div>
                        <div className="flex justify-end">
                          <Button size="sm" onClick={updatePost}>Save Changes</Button>
                        </div>
                      </div>
                    ) : (
                      <p className="whitespace-pre-wrap text-sm leading-6">{detail.post.description}</p>
                    )}
                    {detail.post.imageUrl && (
                      <img src={detail.post.imageUrl} alt="Doubt attachment" className="max-h-72 rounded-md border object-contain" />
                    )}
                    <div className="flex flex-wrap gap-2">{detail.post.tags.map((tag) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}</div>
                    <div className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      AI Suggested Answer placeholder is ready for future integration.
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Answers</CardTitle>
                    <CardDescription>{detail.answers.length ? `${detail.answers.length} answers` : "No answers yet."}</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {detail.answers.length === 0 && (
                      <div className="rounded-md border border-dashed p-5 text-center text-sm text-muted-foreground">
                        No answers yet. Be the first to help this aspirant.
                      </div>
                    )}

                    {detail.answers.map((answer) => (
                      <div key={answer.id} className={`rounded-md border p-3 ${answer.isBestAnswer ? "border-emerald-500 bg-emerald-50/60" : ""}`}>
                        <div className="mb-2 flex items-center justify-between gap-2">
                          <div className="text-xs text-muted-foreground">{answer.author.name} • {new Date(answer.createdAt).toLocaleString()}</div>
                          <div className="flex items-center gap-2">
                            {answer.isBestAnswer && <Badge className="bg-emerald-600"><CheckCircle2 className="mr-1 h-3 w-3" />Best Answer</Badge>}
                            <Button size="sm" variant="outline" onClick={() => reportTarget("answer", answer.id)}>
                              <Flag className="mr-1 h-3.5 w-3.5" />Report
                            </Button>
                          </div>
                        </div>
                        <p className="whitespace-pre-wrap text-sm">{answer.content}</p>
                        {editingAnswerId === answer.id && (
                          <div className="mt-2 space-y-2">
                            <Textarea value={editingAnswerText} onChange={(e) => setEditingAnswerText(e.target.value)} />
                            <div className="flex gap-2">
                              <Button size="sm" onClick={() => saveAnswerEdit(answer.id)}>Save</Button>
                              <Button size="sm" variant="outline" onClick={() => { setEditingAnswerId(""); setEditingAnswerText(""); }}>Cancel</Button>
                            </div>
                          </div>
                        )}
                        <div className="mt-3 flex flex-wrap items-center gap-2">
                          <Button size="sm" variant={answer.hasVoted ? "default" : "outline"} onClick={() => voteAnswer(answer.id)}>
                            <ThumbsUp className="mr-1 h-4 w-4" />Helpful ({answer.helpfulCount})
                          </Button>
                          {user?.id === answer.userId && (
                            <>
                              <Button size="sm" variant="outline" onClick={() => startEditAnswer(answer)}>Edit</Button>
                              <Button size="sm" variant="destructive" onClick={() => deleteAnswer(answer.id)}>Delete</Button>
                            </>
                          )}
                          {user?.id === detail.post.userId && !answer.isBestAnswer && (
                            <Button size="sm" variant="secondary" onClick={() => markBest(answer.id)}>
                              Mark Best
                            </Button>
                          )}
                        </div>
                      </div>
                    ))}

                    <div className="space-y-2 rounded-md border p-3">
                      <Textarea
                        placeholder="Write your UPSC-focused answer..."
                        value={answerText}
                        onChange={(e) => setAnswerText(e.target.value)}
                      />
                      <div className="flex justify-end">
                        <Button onClick={submitAnswer}>Submit Answer</Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default DoubtFeed;
