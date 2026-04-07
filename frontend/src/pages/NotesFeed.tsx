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
import { BookOpen, Bookmark, Flag, Heart, Search, TrendingUp, Paperclip, MessageSquare, Eye, Share2, Repeat2, ThumbsUp } from "lucide-react";

type NoteItem = {
  id: string;
  userId: string;
  title: string;
  content: string;
  preview: string;
  category: string;
  tags: string[];
  imageUrls: string[];
  likesCount: number;
  savesCount: number;
  commentCount?: number;
  viewsCount?: number;
  repostCount?: number;
  shareCount?: number;
  reportCount?: number;
  createdAt: string;
  author: { id: string; name: string };
  trendingScore?: number;
  likedByViewer?: boolean;
  savedByViewer?: boolean;
};

type NoteComment = {
  id: string;
  noteId: string;
  userId: string;
  parentCommentId?: string | null;
  content: string;
  likesCount: number;
  likedByViewer?: boolean;
  createdAt: string;
  author: { id: string; name: string };
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
  { value: "trending", label: "Trending" },
  { value: "most_saved", label: "Most Saved" },
] as const;

const OFFTOPIC_HINTS = ["coding", "movie", "sports", "meme", "promotion", "relationship"];

const backendBase = () => String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

const NotesFeed = () => {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { user, isLocalMode } = useAuth();
  const { toast } = useToast();

  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [tab, setTab] = useState<"feed" | "saved">("feed");
  const [items, setItems] = useState<NoteItem[]>([]);
  const [savedItems, setSavedItems] = useState<NoteItem[]>([]);
  const [selectedNoteId, setSelectedNoteId] = useState("");
  const [selectedItem, setSelectedItem] = useState<NoteItem | null>(null);
  const [comments, setComments] = useState<NoteComment[]>([]);
  const [commentText, setCommentText] = useState("");
  const [replyToCommentId, setReplyToCommentId] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [sort, setSort] = useState<(typeof SORT_OPTIONS)[number]["value"]>("latest");

  const [askOpen, setAskOpen] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    category: "Polity",
    tags: "",
    upscOnlyConfirmed: false,
    imageFile: null as File | null,
  });
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ title: "", content: "", category: "Polity", tags: "" });
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const api = async (path: string, init?: RequestInit) => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string> | undefined),
    };
    if (token) headers.Authorization = `Bearer ${token}`;
    const response = await fetch(`${backendBase()}/functions/v1${path}`, { ...init, headers });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.message || payload?.error || "Request failed");
    return payload;
  };

  const resolveMediaUrl = (url?: string | null) => {
    const raw = String(url || "").trim();
    if (!raw) return "";
    if (raw.startsWith("/storage/")) return `${backendBase()}${raw}`;
    try {
      const parsed = new URL(raw);
      if (parsed.pathname.startsWith("/storage/")) return `${backendBase()}${parsed.pathname}`;
      return raw;
    } catch {
      return raw;
    }
  };

  const loadFeed = async () => {
    const q = new URLSearchParams({
      search,
      category: categoryFilter,
      sort,
      page: "1",
      limit: "30",
    });
    const payload = await api(`/notes-feed?${q.toString()}`);
    const nextItems = payload.items || [];
    setItems(nextItems);
    if (!selectedNoteId && nextItems[0]?.id) setSelectedNoteId(nextItems[0].id);
  };

  const loadSaved = async () => {
    const q = new URLSearchParams({
      search,
      category: categoryFilter,
    });
    const payload = await api(`/notes-feed/saved/list?${q.toString()}`);
    setSavedItems(payload.items || []);
  };

  const loadDetail = async (noteId: string) => {
    if (!noteId) {
      setSelectedItem(null);
      return;
    }
    setDetailLoading(true);
    try {
      const payload = await api(`/notes-feed/${noteId}`);
      const item = payload.item as NoteItem;
      setSelectedItem(item);
      setComments(Array.isArray(payload?.comments) ? payload.comments : []);
      setEditForm({
        title: item?.title || "",
        content: item?.content || "",
        category: item?.category || "Polity",
        tags: Array.isArray(item?.tags) ? item.tags.join(", ") : "",
      });
    } finally {
      setDetailLoading(false);
    }
  };

  const contentWarning = useMemo(() => {
    const text = `${form.title} ${form.content}`.toLowerCase();
    const hasOfftopic = OFFTOPIC_HINTS.some((k) => text.includes(k));
    if (hasOfftopic) return "This content may be reviewed by moderation.";
    return "";
  }, [form.content, form.title]);

  const uploadImageIfAny = async () => {
    if (!form.imageFile) return "";
    const ext = form.imageFile.name.split(".").pop() || "png";
    const path = `notes-feed/${user?.id || "anon"}/${Date.now()}.${ext}`;
    const upload = await supabase.storage.from("media").upload(path, form.imageFile);
    if (upload.error) throw new Error(upload.error.message || "Image upload failed");
    return supabase.storage.from("media").getPublicUrl(path).data.publicUrl || "";
  };

  const submitNote = async () => {
    if (!form.upscOnlyConfirmed) {
      toast({ title: "Please confirm", description: "Accept UPSC-only rule before posting.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const imageUrl = await uploadImageIfAny();
      const payload = await api("/notes-feed/create", {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          content: form.content,
          category: form.category,
          tags: form.tags.split(",").map((x) => x.trim()).filter(Boolean),
          imageUrls: imageUrl ? [imageUrl] : [],
        }),
      });
      setAskOpen(false);
      setForm({ title: "", content: "", category: "Polity", tags: "", upscOnlyConfirmed: false, imageFile: null });
      if (fileInputRef.current) fileInputRef.current.value = "";
      await loadFeed();
      if (payload?.id) {
        setSelectedNoteId(payload.id);
        await loadDetail(payload.id);
      }
      toast({ title: "Note published", description: "Your UPSC study note is now visible in the feed." });
    } catch (error: any) {
      toast({ title: "Publish failed", description: error?.message || "Unable to publish note", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  const updateNote = async () => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/update`, {
        method: "POST",
        body: JSON.stringify({
          title: editForm.title,
          content: editForm.content,
          category: editForm.category,
          tags: editForm.tags.split(",").map((x) => x.trim()).filter(Boolean),
        }),
      });
      setEditing(false);
      await Promise.all([loadFeed(), loadSaved(), loadDetail(selectedItem.id)]);
      toast({ title: "Note updated" });
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Unable to update note", variant: "destructive" });
    }
  };

  const deleteNote = async () => {
    if (!selectedItem?.id) return;
    if (!window.confirm("Delete this note permanently?")) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/delete`, { method: "POST" });
      setSelectedItem(null);
      setSelectedNoteId("");
      await Promise.all([loadFeed(), loadSaved()]);
      toast({ title: "Note deleted" });
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Unable to delete note", variant: "destructive" });
    }
  };

  const toggleLike = async () => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/like`, { method: "POST" });
      await Promise.all([loadFeed(), loadSaved(), loadDetail(selectedItem.id)]);
    } catch (error: any) {
      toast({ title: "Like failed", description: error?.message || "Unable to like note", variant: "destructive" });
    }
  };

  const toggleSave = async () => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/save`, { method: "POST" });
      await Promise.all([loadFeed(), loadSaved(), loadDetail(selectedItem.id)]);
    } catch (error: any) {
      toast({ title: "Save failed", description: error?.message || "Unable to save note", variant: "destructive" });
    }
  };

  const trackView = async (noteId: string) => {
    try {
      await api(`/notes-feed/${noteId}/view`, { method: "POST" });
    } catch {
      // non-blocking
    }
  };

  const shareNote = async () => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/share`, { method: "POST" });
      await Promise.all([loadFeed(), loadSaved(), loadDetail(selectedItem.id)]);
    } catch {
      // non-blocking
    }
    const url = `${window.location.origin}/notes-feed?noteId=${selectedItem.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied", description: "Note link copied to clipboard." });
    } catch {
      toast({ title: "Share link", description: url });
    }
  };

  const repostNote = async () => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/repost`, { method: "POST", body: JSON.stringify({ caption: "" }) });
      await Promise.all([loadFeed(), loadSaved(), loadDetail(selectedItem.id)]);
    } catch (error: any) {
      toast({ title: "Repost failed", description: error?.message || "Unable to repost note", variant: "destructive" });
    }
  };

  const submitComment = async () => {
    if (!selectedItem?.id || !commentText.trim()) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/comments/create`, {
        method: "POST",
        body: JSON.stringify({ content: commentText, parentCommentId: replyToCommentId || undefined }),
      });
      setCommentText("");
      setReplyToCommentId(null);
      await loadDetail(selectedItem.id);
    } catch (error: any) {
      toast({ title: "Comment failed", description: error?.message || "Unable to comment", variant: "destructive" });
    }
  };

  const toggleCommentLike = async (commentId: string) => {
    if (!selectedItem?.id) return;
    try {
      await api(`/notes-feed/comments/${commentId}/like`, { method: "POST" });
      await loadDetail(selectedItem.id);
    } catch (error: any) {
      toast({ title: "Like failed", description: error?.message || "Unable to like comment", variant: "destructive" });
    }
  };

  const reportNote = async () => {
    if (!selectedItem?.id) return;
    const reason = window.prompt("Reason (off-topic / spam / abusive / irrelevant / duplicate)", "off-topic");
    if (!reason) return;
    try {
      await api(`/notes-feed/${selectedItem.id}/report`, {
        method: "POST",
        body: JSON.stringify({ reason }),
      });
      await Promise.all([loadFeed(), loadDetail(selectedItem.id)]);
      toast({ title: "Reported", description: "Thanks. Report submitted for moderation." });
    } catch (error: any) {
      toast({ title: "Report failed", description: error?.message || "Unable to report note", variant: "destructive" });
    }
  };

  useEffect(() => {
    if (!user) {
      navigate("/auth");
      return;
    }
    if (isLocalMode) {
      toast({ title: "Backend required", description: "UPSC Notes Feed needs backend-connected account.", variant: "destructive" });
      navigate("/auth");
      return;
    }
    setLoading(true);
    Promise.all([loadFeed(), loadSaved()]).finally(() => setLoading(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, isLocalMode, navigate, search, categoryFilter, sort, tab]);

  useEffect(() => {
    const fromQuery = searchParams.get("noteId");
    if (fromQuery) setSelectedNoteId(fromQuery);
  }, [searchParams]);

  useEffect(() => {
    if (!selectedNoteId) return;
    setSearchParams((prev) => {
      prev.set("noteId", selectedNoteId);
      return prev;
    });
    loadDetail(selectedNoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  useEffect(() => {
    if (!selectedNoteId) return;
    trackView(selectedNoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedNoteId]);

  if (loading) {
    return (
      <DashboardLayout>
        <div className="p-6">Loading UPSC notes feed...</div>
      </DashboardLayout>
    );
  }

  const list = tab === "feed" ? items : savedItems;

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-7xl p-6 space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-2xl font-bold">UPSC Notes Feed</h1>
            <p className="text-sm text-muted-foreground">Human-created UPSC notes for structured revision and reference.</p>
          </div>
          <Dialog open={askOpen} onOpenChange={setAskOpen}>
            <DialogTrigger asChild>
              <Button><BookOpen className="mr-2 h-4 w-4" />Create Note</Button>
            </DialogTrigger>
            <DialogContent className="max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create UPSC Study Note</DialogTitle>
                <DialogDescription>This section is only for UPSC study notes.</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Title (10-180 chars)" value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
                <Textarea
                  placeholder="Write complete study notes (minimum 80 chars)"
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                  className="min-h-[220px]"
                />
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <select className="rounded-md border bg-background px-3 py-2 text-sm" value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                    {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
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
                  <span>This section is only for UPSC study notes.</span>
                </div>
                {contentWarning && (
                  <p className="rounded border border-amber-300 bg-amber-50 p-2 text-xs text-amber-800">
                    This section is only for UPSC study notes.
                  </p>
                )}
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setAskOpen(false)}>Cancel</Button>
                <Button onClick={submitNote} disabled={submitting}>{submitting ? "Publishing..." : "Publish Note"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card>
          <CardContent className="pt-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <Button size="sm" variant={tab === "feed" ? "default" : "outline"} onClick={() => setTab("feed")}>Public Feed</Button>
              <Button size="sm" variant={tab === "saved" ? "default" : "outline"} onClick={() => setTab("saved")}>Saved Notes</Button>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div className="relative md:col-span-2">
                <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input className="pl-9" placeholder="Search notes..." value={search} onChange={(e) => setSearch(e.target.value)} />
              </div>
              <select className="rounded-md border bg-background px-3 py-2 text-sm" value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
                <option value="all">All Categories</option>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
              {tab === "feed" ? (
                <select className="rounded-md border bg-background px-3 py-2 text-sm" value={sort} onChange={(e) => setSort(e.target.value as (typeof SORT_OPTIONS)[number]["value"])}>
                  {SORT_OPTIONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              ) : (
                <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm text-muted-foreground">Sorted by recently saved</div>
              )}
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-5">
          <div className="space-y-3 lg:col-span-2">
            {list.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center text-sm text-muted-foreground">
                  {tab === "feed" ? "No notes found. Publish your first UPSC note." : "No saved notes yet."}
                </CardContent>
              </Card>
            )}
            {list.map((note) => (
              <Card key={note.id} className={`cursor-pointer transition ${selectedNoteId === note.id ? "border-primary shadow-sm" : ""}`} onClick={() => setSelectedNoteId(note.id)}>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">{note.title}</CardTitle>
                  <CardDescription>{note.author.name} • {new Date(note.createdAt).toLocaleString()}</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-muted-foreground">{note.preview}</p>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <Badge variant="outline">{note.category}</Badge>
                    <Badge variant="secondary"><Heart className="mr-1 h-3 w-3" />{note.likesCount}</Badge>
                    <Badge variant="secondary"><Bookmark className="mr-1 h-3 w-3" />{note.savesCount}</Badge>
                    <Badge variant="secondary"><MessageSquare className="mr-1 h-3 w-3" />{note.commentCount || 0}</Badge>
                    <Badge variant="secondary"><Eye className="mr-1 h-3 w-3" />{note.viewsCount || 0}</Badge>
                    {tab === "feed" && sort === "trending" && <Badge variant="outline"><TrendingUp className="mr-1 h-3 w-3" />{note.trendingScore || 0}</Badge>}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="lg:col-span-3">
            {!selectedNoteId && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Select a note to view details.</CardContent>
              </Card>
            )}
            {selectedNoteId && detailLoading && (
              <Card>
                <CardContent className="py-10 text-center text-sm text-muted-foreground">Loading note...</CardContent>
              </Card>
            )}
            {selectedNoteId && selectedItem && !detailLoading && (
              <Card>
                <CardHeader>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-xl">{selectedItem.title}</CardTitle>
                      <CardDescription>{selectedItem.author.name} • {new Date(selectedItem.createdAt).toLocaleString()}</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">{selectedItem.category}</Badge>
                      <Button size="sm" variant="outline" onClick={reportNote}>
                        <Flag className="mr-1 h-4 w-4" />Report
                      </Button>
                      {user?.id === selectedItem.userId && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => setEditing((v) => !v)}>{editing ? "Cancel Edit" : "Edit"}</Button>
                          <Button size="sm" variant="destructive" onClick={deleteNote}>Delete</Button>
                        </>
                      )}
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  {editing ? (
                    <div className="space-y-3 rounded-md border p-3">
                      <Input value={editForm.title} onChange={(e) => setEditForm((p) => ({ ...p, title: e.target.value }))} />
                      <Textarea className="min-h-[220px]" value={editForm.content} onChange={(e) => setEditForm((p) => ({ ...p, content: e.target.value }))} />
                      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                        <select className="rounded-md border bg-background px-3 py-2 text-sm" value={editForm.category} onChange={(e) => setEditForm((p) => ({ ...p, category: e.target.value }))}>
                          {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
                        </select>
                        <Input value={editForm.tags} onChange={(e) => setEditForm((p) => ({ ...p, tags: e.target.value }))} />
                      </div>
                      <div className="flex justify-end">
                        <Button size="sm" onClick={updateNote}>Save Changes</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="whitespace-pre-wrap text-sm leading-6">{selectedItem.content}</p>
                  )}

                  {selectedItem.imageUrls?.length > 0 && (
                    <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                      {selectedItem.imageUrls.map((url, idx) => (
                        <img key={`${url}-${idx}`} src={resolveMediaUrl(url)} alt={`Note visual ${idx + 1}`} className="max-h-72 rounded-md border object-contain" />
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-2">
                    {selectedItem.tags.map((tag) => <Badge key={tag} variant="secondary">#{tag}</Badge>)}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 border-t pt-3">
                    <Button size="sm" variant={selectedItem.likedByViewer ? "default" : "outline"} onClick={toggleLike}>
                      <Heart className="mr-1 h-4 w-4" />Like ({selectedItem.likesCount})
                    </Button>
                    <Button size="sm" variant={selectedItem.savedByViewer ? "default" : "outline"} onClick={toggleSave}>
                      <Bookmark className="mr-1 h-4 w-4" />Save ({selectedItem.savesCount})
                    </Button>
                    <Button size="sm" variant="outline" onClick={repostNote}>
                      <Repeat2 className="mr-1 h-4 w-4" />Repost ({selectedItem.repostCount || 0})
                    </Button>
                    <Button size="sm" variant="outline" onClick={shareNote}>
                      <Share2 className="mr-1 h-4 w-4" />Share ({selectedItem.shareCount || 0})
                    </Button>
                    <Badge variant="outline"><Eye className="mr-1 h-3 w-3" />Views: {selectedItem.viewsCount || 0}</Badge>
                  </div>

                  <div className="space-y-3 border-t pt-3">
                    <h3 className="text-sm font-semibold">Comments</h3>
                    {comments.length === 0 && (
                      <div className="rounded border border-dashed p-3 text-sm text-muted-foreground">No comments yet.</div>
                    )}
                    {comments.map((comment) => (
                      <div key={comment.id} className={`rounded border p-2 ${comment.parentCommentId ? "ml-5" : ""}`}>
                        <div className="mb-1 text-xs text-muted-foreground">{comment.author.name} - {new Date(comment.createdAt).toLocaleString()}</div>
                        <p className="whitespace-pre-wrap text-sm">{comment.content}</p>
                        <div className="mt-2 flex items-center gap-2">
                          <Button size="sm" variant={comment.likedByViewer ? "default" : "outline"} onClick={() => toggleCommentLike(comment.id)}>
                            <ThumbsUp className="mr-1 h-3.5 w-3.5" />{comment.likesCount}
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => setReplyToCommentId(comment.id)}>Reply</Button>
                        </div>
                      </div>
                    ))}
                    {replyToCommentId && (
                      <div className="rounded border bg-muted/40 px-2 py-1 text-xs">
                        Replying to a comment.
                        <button className="ml-2 underline" onClick={() => setReplyToCommentId(null)}>Cancel</button>
                      </div>
                    )}
                    <div className="flex gap-2">
                      <Textarea
                        placeholder="Write a comment..."
                        value={commentText}
                        onChange={(e) => setCommentText(e.target.value)}
                      />
                      <Button onClick={submitComment}>Comment</Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default NotesFeed;
