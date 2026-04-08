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
  Plus,
  Search,
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

type SortKey = "latest" | "trending" | "most_saved";

type NotesPost = {
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
  sharesCount: number;
  reportCount?: number;
  isFlagged?: boolean;
  moderationStatus?: string;
  createdAt: string;
  updatedAt: string;
  trendingScore?: number;
  author: { id: string; name: string };
  likedByViewer?: boolean;
  savedByViewer?: boolean;
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

const NotesFeed = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentUserId, setCurrentUserId] = useState("");
  const [items, setItems] = useState<NotesPost[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const [search, setSearch] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("latest");

  const [openCard, setOpenCard] = useState<Record<string, boolean>>({});
  const [detailCache, setDetailCache] = useState<Record<string, NotesPost>>({});

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [newCategory, setNewCategory] = useState<string>(CATEGORIES[0]);
  const [tagsInput, setTagsInput] = useState("");
  const [imageFiles, setImageFiles] = useState<File[]>([]);

  const [shareOpen, setShareOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<NotesPost | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editNoteId, setEditNoteId] = useState("");
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editCategory, setEditCategory] = useState<string>(CATEGORIES[0]);
  const [editTagsInput, setEditTagsInput] = useState("");

  const authHeaders = async () => {
    const { data } = await supabase.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const loadItems = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: "1", limit: "30", sort });
      if (search.trim()) params.set("search", search.trim());
      if (category !== "all") params.set("category", category);

      const headers = await authHeaders();
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed?${params.toString()}`, { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to load notes feed");

      setItems(Array.isArray(payload?.items) ? payload.items : []);
    } catch (error: any) {
      toast({ title: "Failed to load notes", description: error?.message || "Please try again.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const t = setTimeout(loadItems, 180);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, category, sort]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => {
      setCurrentUserId(String(data?.user?.id || ""));
    });
  }, []);

  const createNote = async () => {
    if (title.trim().length < 10) {
      toast({ title: "Title too short", description: "Use at least 10 characters.", variant: "destructive" });
      return;
    }
    if (content.trim().length < 80) {
      toast({ title: "Content too short", description: "Use at least 80 characters.", variant: "destructive" });
      return;
    }

    setCreating(true);
    try {
      const imageUrls: string[] = [];
      for (const file of imageFiles.slice(0, 5)) {
        const ext = file.name.split(".").pop() || "jpg";
        const path = `notes-feed/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const upload = await supabase.storage.from("uploads").upload(path, file, { upsert: false });
        if (upload.error) throw new Error(upload.error.message || "Image upload failed");
        if (upload.data?.publicUrl) imageUrls.push(upload.data.publicUrl);
      }

      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/create`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: title.trim(),
          content: content.trim(),
          category: newCategory,
          tags: toTags(tagsInput),
          imageUrls,
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Note post failed");

      setDialogOpen(false);
      setTitle("");
      setContent("");
      setTagsInput("");
      setImageFiles([]);
      toast({ title: "Posted", description: "Your UPSC notes are now visible in feed." });
      await loadItems();
    } catch (error: any) {
      toast({ title: "Post failed", description: error?.message || "Try again.", variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const loadNoteDetail = async (noteId: string) => {
    try {
      const headers = await authHeaders();
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${noteId}`, { headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Failed to open note");
      const item = payload?.item as NotesPost;
      if (!item) return;

      setDetailCache((prev) => ({ ...prev, [noteId]: item }));
      setItems((prev) =>
        prev.map((p) =>
          p.id === noteId
            ? {
                ...p,
                likesCount: item.likesCount,
                savesCount: item.savesCount,
                sharesCount: item.sharesCount,
                likedByViewer: item.likedByViewer,
                savedByViewer: item.savedByViewer,
              }
            : p,
        ),
      );
    } catch {
      // ignore silent for open/close interaction
    }
  };

  const toggleOpenCard = async (noteId: string) => {
    const next = !openCard[noteId];
    setOpenCard((prev) => ({ ...prev, [noteId]: next }));
    if (next) await loadNoteDetail(noteId);
  };

  const reactNote = async (noteId: string, action: "like" | "save") => {
    const target = items.find((i) => i.id === noteId);
    if (!target) return;

    const optimistic =
      action === "like"
        ? { likedByViewer: !target.likedByViewer, likesCount: target.likesCount + (target.likedByViewer ? -1 : 1) }
        : { savedByViewer: !target.savedByViewer, savesCount: target.savesCount + (target.savedByViewer ? -1 : 1) };

    setItems((prev) => prev.map((i) => (i.id === noteId ? { ...i, ...optimistic } : i)));

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${noteId}/${action}`, { method: "POST", headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Action failed");

      setItems((prev) =>
        prev.map((i) => {
          if (i.id !== noteId) return i;
          if (action === "like") return { ...i, likedByViewer: Boolean(payload.liked), likesCount: Number(payload.likesCount ?? i.likesCount) };
          return { ...i, savedByViewer: Boolean(payload.saved), savesCount: Number(payload.savesCount ?? i.savesCount) };
        }),
      );
    } catch (error: any) {
      setItems((prev) => prev.map((i) => (i.id === noteId ? { ...i, ...target } : i)));
      toast({ title: "Action failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const reportNote = async (noteId: string) => {
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${noteId}/report`, {
        method: "POST",
        headers,
        body: JSON.stringify({ reason: "irrelevant" }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Report failed");
      toast({ title: "Reported", description: "Thanks. The note has been flagged for review." });
    } catch (error: any) {
      toast({ title: "Report failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const startEditNote = (item: NotesPost) => {
    setEditNoteId(item.id);
    setEditTitle(item.title);
    setEditContent(item.content);
    setEditCategory(item.category && CATEGORIES.includes(item.category as (typeof CATEGORIES)[number]) ? item.category : CATEGORIES[0]);
    setEditTagsInput((item.tags || []).join(", "));
    setEditOpen(true);
  };

  const submitEditNote = async () => {
    if (!editNoteId) return;
    if (editTitle.trim().length < 10) {
      toast({ title: "Title too short", description: "Use at least 10 characters.", variant: "destructive" });
      return;
    }
    if (editContent.trim().length < 80) {
      toast({ title: "Content too short", description: "Use at least 80 characters.", variant: "destructive" });
      return;
    }

    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${editNoteId}/update`, {
        method: "POST",
        headers,
        body: JSON.stringify({
          title: editTitle.trim(),
          content: editContent.trim(),
          category: editCategory,
          tags: toTags(editTagsInput),
        }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Update failed");
      setEditOpen(false);
      toast({ title: "Updated", description: "Note updated successfully." });
      await loadItems();
      await loadNoteDetail(editNoteId);
    } catch (error: any) {
      toast({ title: "Update failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const deleteNote = async (noteId: string) => {
    const ok = window.confirm("Delete this note?");
    if (!ok) return;
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${noteId}/delete`, { method: "POST", headers });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Delete failed");
      toast({ title: "Deleted", description: "Note removed." });
      setOpenCard((prev) => ({ ...prev, [noteId]: false }));
      await loadItems();
    } catch (error: any) {
      toast({ title: "Delete failed", description: error?.message || "Please retry.", variant: "destructive" });
    }
  };

  const noteShareUrl = (noteId: string) => `${window.location.origin}/notes-feed?noteId=${encodeURIComponent(noteId)}`;

  const openShareDialog = (item: NotesPost) => {
    setShareTarget(item);
    setShareOpen(true);
  };

  const shareNote = (item: NotesPost) => {
    openShareDialog(item);
  };

  const trackShare = async (platform: SharePlatform) => {
    if (!shareTarget) return;
    try {
      const headers = { "Content-Type": "application/json", ...(await authHeaders()) };
      const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${shareTarget.id}/share`, {
        method: "POST",
        headers,
        body: JSON.stringify({ platform }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(payload?.message || "Share analytics failed");
      const sharesCount = Number(payload?.sharesCount ?? 0);
      setItems((prev) => prev.map((item) => (item.id === shareTarget.id ? { ...item, sharesCount } : item)));
      setDetailCache((prev) => {
        const detail = prev[shareTarget.id];
        if (!detail) return prev;
        return {
          ...prev,
          [shareTarget.id]: { ...detail, sharesCount },
        };
      });
      setShareTarget((prev) => (prev ? { ...prev, sharesCount } : prev));
    } catch {
      // do not block sharing if analytics tracking fails
    }
  };

  useEffect(() => {
    const deepNoteId = String(searchParams.get("noteId") || "").trim();
    if (!deepNoteId) return;
    const openDeepLinkedNote = async () => {
      let note = items.find((i) => i.id === deepNoteId);
      if (!note) {
        try {
          const headers = await authHeaders();
          const res = await fetch(`${backendBase()}/functions/v1/notes-feed/${deepNoteId}`, { headers });
          const payload = await res.json().catch(() => ({}));
          if (res.ok && payload?.item) {
            note = payload.item as NotesPost;
            setItems((prev) => [note as NotesPost, ...prev.filter((i) => i.id !== deepNoteId)]);
            setDetailCache((prev) => ({ ...prev, [deepNoteId]: payload.item as NotesPost }));
          }
        } catch {
          // ignore deep-link fetch failures
        }
      }
      if (!note) return;
      if (!openCard[deepNoteId]) await toggleOpenCard(deepNoteId);
      setTimeout(() => {
        const el = document.getElementById(`note-post-${deepNoteId}`);
        el?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 120);
      const next = new URLSearchParams(searchParams);
      next.delete("noteId");
      setSearchParams(next, { replace: true });
    };
    void openDeepLinkedNote();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items]);

  const visibleItems = useMemo(() => items, [items]);

  return (
    <DashboardLayout>
      <div className="w-full max-w-6xl mx-auto p-3 md:p-6 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">UPSC Notes Feed</h1>
            <p className="text-sm text-muted-foreground">Human-created notes shared by aspirants for revision.</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2"><Plus className="h-4 w-4" />Create Note</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
              <DialogHeader>
                <DialogTitle>Post UPSC Notes</DialogTitle>
                <DialogDescription>This section is only for UPSC study notes.</DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="note-title">Title</Label>
                  <Input id="note-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Example: Fundamental Rights quick revision framework" />
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note-content">Content</Label>
                  <Textarea
                    id="note-content"
                    rows={8}
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    placeholder="Write clear, structured, topic-wise notes helpful for UPSC revision."
                  />
                  <p className="text-xs text-muted-foreground">Minimum 80 characters. Keep it exam focused.</p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label>Category</Label>
                    <Select value={newCategory} onValueChange={setNewCategory}>
                      <SelectTrigger><SelectValue placeholder="Choose category" /></SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map((c) => (
                          <SelectItem key={c} value={c}>{c}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="note-tags">Tags (comma separated)</Label>
                    <Input id="note-tags" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} placeholder="revision, mains, polity" />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="note-images">Add files (up to 5)</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="note-images"
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={(e) => setImageFiles(Array.from(e.target.files || []).slice(0, 5))}
                    />
                    <Button type="button" variant="outline" className="gap-2" onClick={() => document.getElementById("note-images")?.click()}>
                      <ImagePlus className="h-4 w-4" />
                      Attach
                    </Button>
                  </div>
                  {!!imageFiles.length && <p className="text-xs text-muted-foreground">Selected: {imageFiles.length} file(s)</p>}
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
                <Button onClick={createNote} disabled={creating}>{creating ? "Posting..." : "Post Notes"}</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <Card className="p-3 md:p-4 space-y-3">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-2">
            <div className="lg:col-span-7 relative">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input className="pl-9" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search notes by title/content/tags" />
            </div>
            <div className="lg:col-span-5">
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
          </div>

          <Tabs value={sort} onValueChange={(v) => setSort(v as SortKey)}>
            <TabsList>
              <TabsTrigger value="latest">Latest</TabsTrigger>
              <TabsTrigger value="trending">Trending</TabsTrigger>
              <TabsTrigger value="most_saved">Most Saved</TabsTrigger>
            </TabsList>
          </Tabs>
        </Card>

        <div className="space-y-3">
          {loading && <Card className="p-5 text-sm text-muted-foreground">Loading notes...</Card>}
          {!loading && visibleItems.length === 0 && <Card className="p-6 text-sm text-muted-foreground">No notes found for current filters.</Card>}

          {!loading && visibleItems.map((item) => {
            const expanded = Boolean(openCard[item.id]);
            const detail = detailCache[item.id];
            const fullContent = detail?.content || item.content;
            const fullImages = detail?.imageUrls || item.imageUrls || [];

            return (
              <Card id={`note-post-${item.id}`} key={item.id} className="p-3 md:p-4 rounded-2xl border-orange-200/70 dark:border-orange-900/40">
                <div className="flex items-start gap-3">
                  <Avatar className="h-10 w-10 shrink-0">
                    <AvatarFallback>{initials(item.author.name)}</AvatarFallback>
                  </Avatar>

                  <div className="min-w-0 flex-1 space-y-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <span className="font-semibold">{item.author.name}</span>
                      <span className="text-muted-foreground">{when(item.createdAt)}</span>
                      <Badge variant="secondary">{item.category}</Badge>
                      {sort === "trending" && typeof item.trendingScore === "number" && (
                        <Badge variant="outline">Score {item.trendingScore}</Badge>
                      )}
                    </div>

                    <h3 className="font-semibold text-base md:text-lg leading-tight">{item.title}</h3>
                    <p className="text-sm text-muted-foreground whitespace-pre-wrap">{expanded ? fullContent : item.preview}</p>

                    {item.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {item.tags.map((tag) => (
                          <Badge key={tag} variant="outline">#{tag}</Badge>
                        ))}
                      </div>
                    )}

                    {!!fullImages.length && (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 rounded-xl overflow-hidden border bg-muted/20 p-2">
                        {fullImages.map((url) => (
                          <img key={url} src={url} alt="note attachment" className="w-full max-h-[420px] object-contain rounded-md bg-black/5" />
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-2 pt-1 text-muted-foreground">
                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => toggleOpenCard(item.id)}>
                        <Eye className="h-4 w-4" />
                        {expanded ? "Collapse" : "Read"}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className={`gap-1.5 ${item.likedByViewer ? "text-red-500" : ""}`}
                        onClick={() => reactNote(item.id, "like")}
                      >
                        <Heart className={`h-4 w-4 ${item.likedByViewer ? "fill-current" : ""}`} />
                        {item.likesCount}
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="gap-1.5"
                        onClick={() => reactNote(item.id, "save")}
                      >
                        {item.savedByViewer ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                        {item.savesCount}
                      </Button>

                      <Button variant="ghost" size="sm" className="gap-1.5" onClick={() => shareNote(item)}>
                        <Share2 className="h-4 w-4" />
                        {item.sharesCount}
                      </Button>

                      <Button variant="ghost" size="sm" className="gap-1.5 ml-auto" onClick={() => reportNote(item.id)}>
                        <ShieldAlert className="h-4 w-4" />
                        Report
                      </Button>
                      {item.userId === currentUserId && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => startEditNote(item)}>Edit</Button>
                          <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" onClick={() => deleteNote(item.id)}>
                            Delete
                          </Button>
                        </>
                      )}
                    </div>
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
        title={shareTarget?.title || "UPSC Note"}
        url={shareTarget ? noteShareUrl(shareTarget.id) : window.location.href}
        shareCount={shareTarget?.sharesCount || 0}
        onTrackShare={trackShare}
      />

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Note</DialogTitle>
            <DialogDescription>Update your note content.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="edit-note-title">Title</Label>
              <Input id="edit-note-title" value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-note-content">Content</Label>
              <Textarea id="edit-note-content" rows={8} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
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
                <Label htmlFor="edit-note-tags">Tags</Label>
                <Input id="edit-note-tags" value={editTagsInput} onChange={(e) => setEditTagsInput(e.target.value)} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={submitEditNote}>Save Changes</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
};

export default NotesFeed;
