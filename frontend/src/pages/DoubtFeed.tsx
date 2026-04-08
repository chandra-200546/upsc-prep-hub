import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/dashboard/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Label } from "@/components/ui/label";
import { toast } from "@/components/ui/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { SocialShareSheet, type SharePlatform } from "@/components/feed/SocialShareSheet";
import {
  Bookmark,
  BookmarkCheck,
  Eye,
  Heart,
  ImagePlus,
  MessageCircle,
  Plus,
  Search,
  Send,
  Share2,
  ShieldAlert,
} from "lucide-react";

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
] as const;

type SortKey = "latest" | "most_answered" | "unanswered";
type StatusFilter = "all" | "unanswered" | "answered" | "solved";

type FeedPost = {
  id: string;
  userId: string;
  title: string;
  description: string;
  preview: string;
  category: string;
  tags: string[];
  imageUrl: string | null;
  answerCount: number;
  likesCount: number;
  savesCount: number;
  viewsCount: number;
  sharesCount: number;
  likedByViewer: boolean;
  savedByViewer: boolean;
  status: string;
  createdAt: string;
  updatedAt: string;
  author: { id: string; name: string };
};

type FeedAnswer = {
  id: string;
  postId: string;
  userId: string;
  content: string;
  helpfulCount: number;
  isAiGenerated: boolean;
  isBestAnswer: boolean;
  hasVoted: boolean;
  createdAt: string;
  author: { id: string; name: string };
};

type PostDetail = {
  post: FeedPost;
  answers: FeedAnswer[];
};

const backendBase = () => String(import.meta.env.VITE_BACKEND_URL || "http://localhost:8787").replace(/\/$/, "");

const initials = (name: string) =>
  String(name || "A")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() || "")
    .join("") || "A";

const when = (iso: string) => {
  const d = new Date(iso);
  const ms = Date.now() - d.getTime();
  const mins = Math.floor(ms / 60000);
  if (mins < 1) return "now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
};

const toTags = (text: string) =>
  text
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 8);

const DoubtFeed = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState("");
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [sort, setSort] = useState<SortKey>("latest");

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [details, setDetails] = useState<Record<string, PostDetail>>({});
  const [loadingDetail, setLoadingDetail] = useState<Record<string, boolean>>({});
  const [commentDraft, setCommentDraft] = useState<Record<string, string>>({});
  const [postingComment, setPostingComment] = useState<Record<string, boolean>>({});

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<FeedPost | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editPostId, setEditPostId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string>(CATEGORIES[0]);
  const [editTagsInput, setEditTagsInput] = useState("");

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadPosts = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        page: "1",
        limit: "30",
        sort,
      });
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);
      if (status !== "all") params.set("status", status);

      const headers = await authHeaders();
      const res = await fetch(`${backendBase()}/functions/v1/doubts?${params.toString()}`, { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to load doubts");

      const list = Array.isArray(payload?.posts) ? payload.posts : [];
      setPosts(list);
    } catch (error: any) {
      toast({
        title: "Failed to load doubts",
        description: error?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(() => {
      loadPosts();
    }, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, status, sort]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(String(data?.user?.id || ""));
    });
  }, []);

  const createPost = async () => {
    if (title.trim().length < 10) {
      toast({ title: "Title too short", description: "Use at least 10 characters.", variant: "destructive" });
      return;
    }
    if (description.trim().length < 20) {
      toast({ title: "Description too short", description: "Use at least 20 characters.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      let imageUrl: string | null = null;
      if (imageFile) {
        const ext = imageFile.name.split(".").pop() || "jpg";
        const path = `doubt-feed/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const upload = await supabase.storage.from("uploads").upload(path, imageFile, { upsert: false });
        if (upload.error) throw new Error(upload.error.message || "Image upload failed");
        imageUrl = upload.data?.publicUrl || null;
      }

      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim(),
          category: newCategory,
          tags: toTags(tagsInput),
          imageUrl,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Post failed");

      setDialogOpen(false);
      setTitle("");
      setDescription("");
      setTagsInput("");
      setImageFile(null);
      toast({ title: "Posted", description: "Your UPSC doubt is now live." });
      await loadPosts();
    } catch (error: any) {
      toast({ title: "Post failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const ensurePostDetail = async (postId: string, withView = false) => {
    setLoadingDetail((prev) => ({ ...prev, [postId]: true }));
    try {
      const headers = await authHeaders();
      if (withView) {
        await fetch(`${backendBase()}/functions/v1/doubts/${postId}/view`, {
          method: "POST",
          headers: { "Content-Type": "application/json", ...headers },
        });
      }
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${postId}`, { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to load post detail");
      const detail: PostDetail = { post: payload.post, answers: payload.answers || [] };
      setDetails((prev) => ({ ...prev, [postId]: detail }));

      setPosts((prev) =>
        prev.map((p) =>
          p.id === postId
            ? {
                ...p,
                viewsCount: detail.post.viewsCount,
                answerCount: detail.post.answerCount,
                likesCount: detail.post.likesCount,
                savesCount: detail.post.savesCount,
                sharesCount: detail.post.sharesCount,
                likedByViewer: detail.post.likedByViewer,
                savedByViewer: detail.post.savedByViewer,
              }
            : p,
        ),
      );
    } catch (error: any) {
      toast({ title: "Failed to open post", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setLoadingDetail((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const toggleComments = async (postId: string) => {
    const next = !expanded[postId];
    setExpanded((prev) => ({ ...prev, [postId]: next }));
    if (next) {
      await ensurePostDetail(postId, !details[postId]);
    }
  };

  const reactPost = async (postId: string, action: "like" | "save") => {
    const target = posts.find((p) => p.id === postId);
    if (!target) return;

    const optimistic =
      action === "like"
        ? {
            likedByViewer: !target.likedByViewer,
            likesCount: target.likesCount + (target.likedByViewer ? -1 : 1),
          }
        : {
            savedByViewer: !target.savedByViewer,
            savesCount: target.savesCount + (target.savedByViewer ? -1 : 1),
          };

    setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...optimistic } : p)));

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${postId}/${action}`, { method: "POST", headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Update failed");

      setPosts((prev) =>
        prev.map((p) => {
          if (p.id !== postId) return p;
          if (action === "like") {
            return {
              ...p,
              likedByViewer: Boolean(payload.liked),
              likesCount: Number(payload.likesCount ?? p.likesCount),
            };
          }
          return {
            ...p,
            savedByViewer: Boolean(payload.saved),
            savesCount: Number(payload.savesCount ?? p.savesCount),
          };
        }),
      );
    } catch (error: any) {
      setPosts((prev) => prev.map((p) => (p.id === postId ? { ...p, ...target } : p)));
      toast({ title: "Action failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const postComment = async (postId: string) => {
    const content = String(commentDraft[postId] || "").trim();
    if (content.length < 10) {
      toast({ title: "Comment too short", description: "Use at least 10 characters.", variant: "destructive" });
      return;
    }

    setPostingComment((prev) => ({ ...prev, [postId]: true }));
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${postId}/answers/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({ content }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Comment failed");

      setCommentDraft((prev) => ({ ...prev, [postId]: "" }));
      await ensurePostDetail(postId, false);
      toast({ title: "Comment posted" });
    } catch (error: any) {
      toast({ title: "Comment failed", description: error?.message || "Please retry.", variant: "destructive" });
    } finally {
      setPostingComment((prev) => ({ ...prev, [postId]: false }));
    }
  };

  const voteAnswer = async (postId: string, answerId: string) => {
    const detail = details[postId];
    if (!detail) return;
    const target = detail.answers.find((a) => a.id === answerId);
    if (!target) return;

    const optimisticAnswers = detail.answers.map((a) =>
      a.id === answerId
        ? {
            ...a,
            hasVoted: !a.hasVoted,
            helpfulCount: a.helpfulCount + (a.hasVoted ? -1 : 1),
          }
        : a,
    );
    setDetails((prev) => ({ ...prev, [postId]: { ...detail, answers: optimisticAnswers } }));

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/answers/${answerId}/vote`, { method: "POST", headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Vote failed");

      setDetails((prev) => {
        const curr = prev[postId];
        if (!curr) return prev;
        return {
          ...prev,
          [postId]: {
            ...curr,
            answers: curr.answers.map((a) =>
              a.id === answerId
                ? {
                    ...a,
                    hasVoted: Boolean(payload.voted),
                    helpfulCount: Number(payload.helpfulCount ?? a.helpfulCount),
                  }
                : a,
            ),
          },
        };
      });
    } catch (error: any) {
      setDetails((prev) => ({ ...prev, [postId]: detail }));
      toast({ title: "Vote failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const reportPost = async (postId: string) => {
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${postId}/report`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "irrelevant" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Report failed");
      toast({ title: "Reported", description: "Thanks. The post has been flagged for review." });
    } catch (error: any) {
      toast({ title: "Report failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const startEditPost = (post: FeedPost) => {
    setEditPostId(post.id);
    setEditTitle(post.title);
    setEditDescription(post.description);
    setEditCategory(post.category && CATEGORIES.includes(post.category as (typeof CATEGORIES)[number]) ? post.category : CATEGORIES[0]);
    setEditTagsInput((post.tags || []).join(", "));
    setEditOpen(true);
  };

  const submitEditPost = async () => {
    if (!editPostId) return;
    if (editTitle.trim().length < 10) {
      toast({ title: "Title too short", description: "Use at least 10 characters.", variant: "destructive" });
      return;
    }
    if (editDescription.trim().length < 20) {
      toast({ title: "Description too short", description: "Use at least 20 characters.", variant: "destructive" });
      return;
    }

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${editPostId}/update`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: editTitle.trim(),
          description: editDescription.trim(),
          category: editCategory,
          tags: toTags(editTagsInput),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Update failed");

      setEditOpen(false);
      toast({ title: "Updated", description: "Post updated successfully." });
      await loadPosts();
      if (expanded[editPostId]) await ensurePostDetail(editPostId, false);
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const deletePost = async (postId: string) => {
    const ok = window.confirm("Delete this post?");
    if (!ok) return;
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${postId}/delete`, { method: "POST", headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Delete failed");
      toast({ title: "Deleted", description: "Post removed." });
      setExpanded((prev) => ({ ...prev, [postId]: false }));
      await loadPosts();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const postShareUrl = (postId: string) => `${window.location.origin}/doubt-feed?postId=${encodeURIComponent(postId)}`;

  const openShareDialog = (post: FeedPost) => {
    setShareTarget(post);
    setShareOpen(true);
  };

  const sharePost = (post: FeedPost) => {
    openShareDialog(post);
  };

  const trackShare = async (platform: SharePlatform) => {
    if (!shareTarget) return;
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/doubts/${shareTarget.id}/share`, {
        method: "POST",
        headers,
        body: JSON.stringify({ platform }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Share analytics failed");
      const sharesCount = Number(payload?.sharesCount ?? 0);
      setPosts((prev) => prev.map((p) => (p.id === shareTarget.id ? { ...p, sharesCount } : p)));
      setDetails((prev) => {
        const detail = prev[shareTarget.id];
        if (!detail) return prev;
        return {
          ...prev,
          [shareTarget.id]: {
            ...detail,
            post: { ...detail.post, sharesCount },
          },
        };
      });
      setShareTarget((prev) => (prev ? { ...prev, sharesCount } : prev));
    } catch {
      // sharing can continue even if analytics tracking fails
    }
  };

  useEffect(() => {
    const deepPostId = String(searchParams.get("postId") || "").trim();
    if (!deepPostId) return;
    const openDeepLinkedPost = async () => {
      let post = posts.find((p) => p.id === deepPostId);
      if (!post) {
        try {
          const headers = await authHeaders();
          const res = await fetch(`${backendBase()}/functions/v1/doubts/${deepPostId}`, { headers });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload?.post) {
            post = payload.post as FeedPost;
            setPosts((prev) => [post as FeedPost, ...prev.filter((p) => p.id !== deepPostId)]);
            setDetails((prev) => ({ ...prev, [deepPostId]: { post: payload.post, answers: payload.answers || [] } }));
          }
        } catch {
          // ignore deep-link fetch failures
        }
      }
      if (!post) return;
      if (!expanded[deepPostId]) await toggleComments(deepPostId);
      setTimeout(() => {
        const el = document.getElementById(`doubt-post-${deepPostId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      const next = new URLSearchParams(searchParams);
      next.delete("postId");
      setSearchParams(next, { replace: true });
    };
    void openDeepLinkedPost();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posts]);

  const filteredPosts = useMemo(() => posts, [posts]);

  return (
    <DashboardLayout>
      <div className="w-full max-w-6xl mx-auto p-3 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">UPSC Doubt Feed</h1>
            <p className="text-sm text-muted-foreground">Ask and solve UPSC doubts with the community.</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Ask Doubt</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Post a UPSC Doubt</DialogTitle>
                <DialogDescription>
                  This feed is only for UPSC-related doubts to maintain learning quality.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="doubt-title">Title</Label>
                  <Input id="doubt-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: How to remember differences between FRs and DPSPs?" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doubt-description">Description</Label>
                  <Textarea
                    id="doubt-description"
                    rows={6}
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Write your doubt in detail so others can help better."
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose category" />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="doubt-tags">Tags (comma separated)</Label>
                    <Input id="doubt-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="prelims, polity, constitution" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="doubt-image">Add file</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="doubt-image"
                      type="file"
                      accept="image/*"
                      onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                    />
                    <Button type="button" variant="outline" className="gap-2" onClick={() => document.getElementById("doubt-image")?.click()}>
                      <ImagePlus className="h-4 w-4" />
                      Attach
                    </Button>
                  </div>
                  {imageFile && <p className="text-xs text-muted-foreground">Selected: {imageFile.name}</p>}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createPost} disabled={creating}>{creating ? "Posting..." : "Post Doubt"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-6 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search doubts by title or description" />
            </div>
            <div className="lg:col-span-3">
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger><SelectValue placeholder="Category" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All categories</SelectItem>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="lg:col-span-3">
              <Select value={status} onValueChange={(v) => setStatus(v as StatusFilter)}>
                <SelectTrigger><SelectValue placeholder="Status" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All status</SelectItem>
                  <SelectItem value="unanswered">Unanswered</SelectItem>
                  <SelectItem value="answered">Answered</SelectItem>
                  <SelectItem value="solved">Solved</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Tabs value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <TabsList>
              <TabsTrigger value="latest">Latest</TabsTrigger>
              <TabsTrigger value="most_answered">Most Answered</TabsTrigger>
              <TabsTrigger value="unanswered">Unanswered</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        <div className="space-y-3">
          {loading && <Card className="p-5 text-sm text-muted-foreground">Loading doubts...</Card>}
          {!loading && filteredPosts.length === 0 && (
            <Card className="p-6 text-sm text-muted-foreground">No doubts found for current filters.</Card>
          )}

          {!loading && filteredPosts.map((post) => {
            const isOpen = Boolean(expanded[post.id]);
            const detail = details[post.id];
            const answers = detail?.answers || [];
            const loadingThis = Boolean(loadingDetail[post.id]);

            return (
              <Card id={`doubt-post-${post.id}`} key={post.id} className="p-3 md:p-4 rounded-2xl border-orange-200/70 dark:border-orange-900/40">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>{initials(post.author.name)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{post.author.name}</span>
                      <span className="text-muted-foreground">{when(post.createdAt)}</span>
                      <Badge variant="secondary">{post.category}</Badge>
                      <Badge variant="outline" className="capitalize">{post.status}</Badge>
                    </div>

                    <h3 className="font-semibold text-base md:text-lg leading-tight">{post.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{post.description}</p>

                    {post.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {post.tags.map((tag) => (
                          <Badge key={tag} variant="outline">#{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {post.imageUrl && (
                      <div className="rounded-xl overflow-hidden border bg-muted/20">
                        <img src={post.imageUrl} alt="doubt attachment" className="w-full max-h-[560px] object-contain bg-black/5" />
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => toggleComments(post.id)}>
                        <MessageCircle className="h-4 w-4" />
                        {post.answerCount}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 ${post.likedByViewer ? "text-red-500" : ""}`}
                        onClick={() => reactPost(post.id, "like")}
                      >
                        <Heart className={`h-4 w-4 ${post.likedByViewer ? "fill-current" : ""}`} />
                        {post.likesCount}
                      </Button>

                      <Button variant="ghost" size="sm" className="gap-1.5 cursor-default">
                        <Eye className="h-4 w-4" />
                        {post.viewsCount}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => reactPost(post.id, "save")}
                      >
                        {post.savedByViewer ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                        {post.savesCount}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => sharePost(post)}
                      >
                        <Share2 className="h-4 w-4" />
                        {post.sharesCount}
                      </Button>

                      <Button variant="ghost" size="sm" className="gap-1.5 ml-auto" onClick={() => reportPost(post.id)}>
                        <ShieldAlert className="h-4 w-4" />
                        Report
                      </Button>
                      {post.userId === currentUserId && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => startEditPost(post)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deletePost(post.id)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>

                    {isOpen && (
                      <div className="mt-2 rounded-xl border bg-muted/20 p-3 space-y-3">
                        <div className="text-sm font-medium">Comments</div>

                        {loadingThis && <p className="text-sm text-muted-foreground">Loading comments...</p>}

                        {!loadingThis && answers.length === 0 && (
                          <p className="text-sm text-muted-foreground">No comments yet. Be the first to answer.</p>
                        )}

                        {!loadingThis && answers.map((ans) => (
                          <div key={ans.id} className={`rounded-lg border p-3 ${ans.isBestAnswer ? "border-green-500/40 bg-green-500/5" : ""}`}>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1.5">
                              <span className="font-semibold text-foreground">{ans.author.name}</span>
                              {ans.isAiGenerated && <Badge variant="secondary">AI Answer</Badge>}
                              {ans.isBestAnswer && <Badge className="bg-green-600">Best Answer</Badge>}
                              <span>{when(ans.createdAt)}</span>
                            </div>
                            <p className="text-sm whitespace-pre-wrap">{ans.content}</p>
                            <div className="pt-2">
                              <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => voteAnswer(post.id, ans.id)}>
                                <Heart className={`h-4 w-4 ${ans.hasVoted ? "fill-current text-red-500" : ""}`} />
                                Helpful {ans.helpfulCount}
                              </Button>
                            </div>
                          </div>
                        ))}

                        <div className="pt-1 flex items-start gap-2">
                          <Textarea
                            value={commentDraft[post.id] || ""}
                            onChange={(e) => setCommentDraft((prev) => ({ ...prev, [post.id]: e.target.value }))}
                            placeholder="Add your answer/comment for this UPSC doubt..."
                            rows={3}
                          />
                          <Button
                            size="icon"
                            className="shrink-0"
                            onClick={() => postComment(post.id)}
                            disabled={Boolean(postingComment[post.id])}
                          >
                            <Send className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </Card>
            );
          })}
        </div>
      </div>

      <SocialShareSheet
        open={shareOpen}
        onOpenChange={setShareOpen}
        title={shareTarget?.title || "UPSC Doubt"}
        url={shareTarget ? postShareUrl(shareTarget.id) : window.location.href}
        shareCount={shareTarget?.sharesCount || 0}
        onTrackShare={trackShare}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Doubt</DialogTitle>
            <DialogDescription>Update your post content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-doubt-title">Title</Label>
              <Input id="edit-doubt-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-doubt-description">Description</Label>
              <Textarea id="edit-doubt-description" rows={6} value={editDescription} onChange={(e) => setEditDescription(e.target.value)} />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Category</Label>
                <Select value={editCategory} onValueChange={setEditCategory}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map((c) => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="edit-doubt-tags">Tags</Label>
                <Input id="edit-doubt-tags" value={editTagsInput} onChange={(e) => setEditTagsInput(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitEditPost}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default DoubtFeed;
