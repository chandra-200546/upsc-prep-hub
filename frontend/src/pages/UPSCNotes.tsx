import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookMarked, BookOpen, ChevronLeft, ChevronRight, Maximize2, Search, Target } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HISTORY_NOTES } from "@/features/notes/data/history-book";
import { HISTORY_BOOK_PARTS } from "@/features/notes/data/history-parts";
import { POLITY_NOTES } from "@/features/notes/data/polity-book";
import { POLITY_BOOK_PARTS } from "@/features/notes/data/polity-parts";
import { GEOGRAPHY_NOTES } from "@/features/notes/data/geography-book";
import { GEOGRAPHY_BOOK_PARTS } from "@/features/notes/data/geography-parts";
import { buildRevisionQueue, buildStudyBlocks, buildTopicId, chaptersForPart, filterChaptersByQuery, paginateChapters, totalPages } from "@/features/notes/lib/engine";
import { readNotesProgress, topicKey, writeNotesProgress } from "@/features/notes/lib/progress";
import { readTopicPreferences, toggleBookmark, toggleWeak, writeTopicPreferences } from "@/features/notes/lib/preferences";
import { Chapter } from "@/features/notes/types";

type SubjectId = "history" | "polity" | "geography";

const SUBJECT_REFERENCE_BOOKS: Record<SubjectId, { title: string; src: string }[]> = {
  history: [
    { title: "A Brief History of Modern India (Spectrum)", src: "/books/history/modern-history-spectrum.pdf" },
  ],
  polity: [
    { title: "Indian Polity (M. Laxmikanth 8th Edition)", src: "/books/polity/indian-polity-laxmikant-8th.pdf" },
  ],
  geography: [
    { title: "Geography 6th Standard", src: "/books/geography/6th.pdf" },
    { title: "Geography 7th Standard", src: "/books/geography/7th.pdf" },
    { title: "Geography 8th Standard", src: "/books/geography/8th.pdf" },
    { title: "Geography 9th Standard", src: "/books/geography/9th.pdf" },
    { title: "Geography 10th Standard", src: "/books/geography/10th-1.pdf" },
    { title: "11th Physical Geography", src: "/books/geography/11th-part1-physical.pdf" },
    { title: "11th Environment", src: "/books/geography/11th-part2-environment.pdf" },
    { title: "11th Map Practice", src: "/books/geography/11th-part3-maps.pdf" },
    { title: "12th India: People and Economy", src: "/books/geography/12th-part1-india-2.pdf" },
    { title: "12th Human Geography", src: "/books/geography/12th-part2-human.pdf" },
  ],
};

const NOTES_SUBJECTS: Record<SubjectId, { label: string; chapters: Chapter[]; parts: typeof HISTORY_BOOK_PARTS }> = {
  history: {
    label: "History",
    chapters: HISTORY_NOTES,
    parts: HISTORY_BOOK_PARTS,
  },
  polity: {
    label: "Indian Polity",
    chapters: POLITY_NOTES,
    parts: POLITY_BOOK_PARTS,
  },
  geography: {
    label: "Geography",
    chapters: GEOGRAPHY_NOTES,
    parts: GEOGRAPHY_BOOK_PARTS,
  },
};

const UPSCNotes = () => {
  const navigate = useNavigate();
  const [activeSubjectId, setActiveSubjectId] = useState<SubjectId>("history");
  const [query, setQuery] = useState("");
  const [activePartId, setActivePartId] = useState(NOTES_SUBJECTS.history.parts[0]?.id || "");
  const [chapterId, setChapterId] = useState(NOTES_SUBJECTS.history.chapters[0]?.id || "");
  const [topicIndex, setTopicIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [chapterPage, setChapterPage] = useState(1);
  const [progress, setProgress] = useState(readNotesProgress());
  const [preferences, setPreferences] = useState(readTopicPreferences());
  const [viewFilter, setViewFilter] = useState<"all" | "weak" | "bookmarked" | "incomplete">("all");
  const [activeReferenceBookIndex, setActiveReferenceBookIndex] = useState(0);
  const referenceViewerRef = useRef<HTMLDivElement | null>(null);
  const CHAPTERS_PER_PAGE = 6;
  const activeSubject = NOTES_SUBJECTS[activeSubjectId];
  const currentParts = activeSubject.parts;
  const currentNotes = activeSubject.chapters;
  const referenceBooks = SUBJECT_REFERENCE_BOOKS[activeSubjectId] || [];
  const activeReferenceBook = referenceBooks[activeReferenceBookIndex] || referenceBooks[0] || null;

  const activePart = useMemo(
    () => currentParts.find((part) => part.id === activePartId) || currentParts[0],
    [currentParts, activePartId],
  );

  const chaptersInPart = useMemo(
    () => (activePart ? chaptersForPart(currentNotes, activePart) : currentNotes),
    [activePart, currentNotes],
  );

  const filteredChapters = useMemo(() => {
    const searched = filterChaptersByQuery(chaptersInPart, query);
    if (viewFilter === "all") return searched;
    return searched
      .map((chapter) => ({
        ...chapter,
        topics: chapter.topics.filter((topic, idx) => {
          const tId = buildTopicId(chapter.id, topic, idx);
          const pref = preferences[topicKey(chapter.id, tId)] || {};
          const done = Boolean(progress[topicKey(chapter.id, tId)]);
          if (viewFilter === "weak") return Boolean(pref.weak);
          if (viewFilter === "bookmarked") return Boolean(pref.bookmarked);
          if (viewFilter === "incomplete") return !done;
          return true;
        }),
      }))
      .filter((chapter) => chapter.topics.length > 0);
  }, [chaptersInPart, query, viewFilter, preferences, progress]);
  const chaptersPageCount = totalPages(filteredChapters.length, CHAPTERS_PER_PAGE);
  const pagedChapters = useMemo(
    () => paginateChapters(filteredChapters, chapterPage, CHAPTERS_PER_PAGE),
    [filteredChapters, chapterPage],
  );

  const activeChapter = useMemo(() => {
    const chapter = filteredChapters.find((c) => c.id === chapterId);
    return chapter || filteredChapters[0] || null;
  }, [filteredChapters, chapterId]);

  const activeTopic = activeChapter?.topics[topicIndex] || null;
  const blocks = activeTopic ? buildStudyBlocks(activeTopic) : [];
  const activeBlock = blocks[blockIndex] || null;

  const topicCount = activeChapter?.topics.length || 0;
  const activeTopicId = activeChapter && activeTopic ? buildTopicId(activeChapter.id, activeTopic, topicIndex) : "";
  const isTopicDone = activeTopicId ? Boolean(progress[topicKey(activeChapter!.id, activeTopicId)]) : false;
  const topicPref = activeChapter && activeTopicId ? preferences[topicKey(activeChapter.id, activeTopicId)] || {} : {};
  const topicTotalInPart = useMemo(
    () => chaptersInPart.reduce((sum: number, chapter: Chapter) => sum + chapter.topics.length, 0),
    [chaptersInPart],
  );
  const topicDoneInPart = useMemo(() => {
    let done = 0;
    chaptersInPart.forEach((chapter: Chapter) => {
      chapter.topics.forEach((topic, idx) => {
        const id = buildTopicId(chapter.id, topic, idx);
        if (progress[topicKey(chapter.id, id)]) done += 1;
      });
    });
    return done;
  }, [chaptersInPart, progress]);
  const coveragePct = topicTotalInPart > 0 ? Math.round((topicDoneInPart / topicTotalInPart) * 100) : 0;
  const revisionQueue = useMemo(
    () =>
      buildRevisionQueue({
        chapters: chaptersInPart,
        isDone: (cId, tId) => Boolean(progress[topicKey(cId, tId)]),
        getPreference: (cId, tId) => preferences[topicKey(cId, tId)],
        limit: 10,
      }),
    [chaptersInPart, progress, preferences],
  );

  const resetForChapter = (nextChapterId: string) => {
    setChapterId(nextChapterId);
    setTopicIndex(0);
    setBlockIndex(0);
  };

  const switchPart = (partId: string) => {
    setActivePartId(partId);
    setQuery("");
    setChapterPage(1);
    const nextPart = currentParts.find((part) => part.id === partId);
    const nextChapterId = nextPart?.chapterIds?.[0] || currentNotes[0]?.id || "";
    resetForChapter(nextChapterId);
  };

  const switchSubject = (subjectId: SubjectId) => {
    const next = NOTES_SUBJECTS[subjectId];
    setActiveSubjectId(subjectId);
    setQuery("");
    setChapterPage(1);
    setTopicIndex(0);
    setBlockIndex(0);
    setActivePartId(next.parts[0]?.id || "");
    setChapterId(next.chapters[0]?.id || "");
    setActiveReferenceBookIndex(0);
  };

  const openReferenceFullScreen = () => {
    const el = referenceViewerRef.current;
    if (!el) return;
    if (typeof el.requestFullscreen === "function") {
      void el.requestFullscreen();
    }
  };

  useEffect(() => {
    if (chapterPage > chaptersPageCount) {
      setChapterPage(chaptersPageCount);
    }
  }, [chapterPage, chaptersPageCount]);

  const moveTopic = (dir: "prev" | "next") => {
    if (!activeChapter) return;
    const max = activeChapter.topics.length - 1;
    const next = dir === "next" ? Math.min(topicIndex + 1, max) : Math.max(topicIndex - 1, 0);
    setTopicIndex(next);
    setBlockIndex(0);
  };

  const moveBlock = (dir: "prev" | "next") => {
    const max = blocks.length - 1;
    const next = dir === "next" ? Math.min(blockIndex + 1, max) : Math.max(blockIndex - 1, 0);
    setBlockIndex(next);
  };

  const markCompleted = () => {
    if (!activeChapter || !activeTopicId) return;
    const key = topicKey(activeChapter.id, activeTopicId);
    const next = { ...progress, [key]: true };
    setProgress(next);
    writeNotesProgress(next);
  };

  const toggleActiveBookmark = () => {
    if (!activeChapter || !activeTopicId) return;
    const key = topicKey(activeChapter.id, activeTopicId);
    const next = toggleBookmark(preferences, key);
    setPreferences(next);
    writeTopicPreferences(next);
  };

  const toggleActiveWeak = () => {
    if (!activeChapter || !activeTopicId) return;
    const key = topicKey(activeChapter.id, activeTopicId);
    const next = toggleWeak(preferences, key);
    setPreferences(next);
    writeTopicPreferences(next);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">UPSC {activeSubject.label} Notes</h1>
            <p className="text-sm text-muted-foreground">Book-part navigation, chapter pagination, and coverage analytics.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />{activeSubject.label} Book Index</CardTitle>
            <CardDescription>{activePart?.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-3 flex flex-wrap gap-2">
              {Object.entries(NOTES_SUBJECTS).map(([id, meta]) => (
                <Button
                  key={id}
                  size="sm"
                  variant={id === activeSubjectId ? "default" : "outline"}
                  onClick={() => switchSubject(id as SubjectId)}
                >
                  {meta.label}
                </Button>
              ))}
            </div>
            <div className="mb-3 flex flex-wrap gap-2">
              {currentParts.map((part) => (
                <Button
                  key={part.id}
                  size="sm"
                  variant={part.id === activePartId ? "default" : "outline"}
                  onClick={() => switchPart(part.id)}
                >
                  {part.title}
                </Button>
              ))}
            </div>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapter/topic/keyword..." />
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant={viewFilter === "all" ? "default" : "outline"} onClick={() => setViewFilter("all")}>All</Button>
              <Button size="sm" variant={viewFilter === "incomplete" ? "default" : "outline"} onClick={() => setViewFilter("incomplete")}>Incomplete</Button>
              <Button size="sm" variant={viewFilter === "weak" ? "default" : "outline"} onClick={() => setViewFilter("weak")}>Weak</Button>
              <Button size="sm" variant={viewFilter === "bookmarked" ? "default" : "outline"} onClick={() => setViewFilter("bookmarked")}>Bookmarked</Button>
            </div>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Topics Completed</p>
                <p className="text-lg font-semibold">{topicDoneInPart}/{topicTotalInPart}</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Coverage</p>
                <p className="text-lg font-semibold">{coveragePct}%</p>
              </div>
              <div className="rounded-md border p-3">
                <p className="text-xs text-muted-foreground">Chapters in Part</p>
                <p className="text-lg font-semibold">{chaptersInPart.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-lg">Chapters</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
              {pagedChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => resetForChapter(chapter.id)}
                  className={`w-full rounded-md border p-3 text-left ${chapter.id === activeChapter?.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <p className="font-medium text-sm">{chapter.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{chapter.topics.length} topics</p>
                </button>
              ))}
              <div className="flex items-center justify-between pt-2">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={chapterPage <= 1}
                  onClick={() => setChapterPage((p) => Math.max(1, p - 1))}
                >
                  Prev Page
                </Button>
                <span className="text-xs text-muted-foreground">Page {chapterPage} / {chaptersPageCount}</span>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={chapterPage >= chaptersPageCount}
                  onClick={() => setChapterPage((p) => Math.min(chaptersPageCount, p + 1))}
                >
                  Next Page
                </Button>
              </div>
              {filteredChapters.length === 0 && <p className="text-sm text-muted-foreground">No chapters matched your search.</p>}
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between gap-2">
                <div>
                  <CardTitle className="text-xl">{activeChapter?.title || "Select Chapter"}</CardTitle>
                  <CardDescription>
                    Topic {topicIndex + 1} of {topicCount} | Block {blockIndex + 1} of {blocks.length || 10}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  {topicPref.bookmarked && <Badge variant="outline">Bookmarked</Badge>}
                  {topicPref.weak && <Badge variant="destructive">Weak</Badge>}
                  {isTopicDone && <Badge variant="secondary">Completed</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {activeTopic && (
                <div className="rounded-lg border bg-primary/5 p-4">
                  <p className="text-xs font-semibold text-primary mb-1">Current Topic</p>
                  <h3 className="text-lg font-semibold">{activeTopic.title}</h3>
                </div>
              )}

              {activeBlock && (
                <Card className="border-border/60">
                  <CardHeader className="pb-2"><CardTitle className="text-base">{activeBlock.title}</CardTitle></CardHeader>
                  <CardContent>
                    <ul className="space-y-2 text-sm text-muted-foreground">
                      {activeBlock.bullets.map((b, i) => <li key={`${activeBlock.id}-${i}`}>{i + 1}. {b}</li>)}
                    </ul>
                  </CardContent>
                </Card>
              )}

              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold text-primary mb-2">Prelims Focus</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(activeTopic?.prelimsFocus || []).map((p, i) => <li key={`pf-${i}`}>- {p}</li>)}
                  </ul>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold text-primary mb-2">Mains Focus</p>
                  <ul className="space-y-1 text-xs text-muted-foreground">
                    {(activeTopic?.mainsFocus || []).map((m, i) => <li key={`mf-${i}`}>- {m}</li>)}
                  </ul>
                </div>
              </div>

              {Array.isArray(activeTopic?.visuals) && activeTopic.visuals.length > 0 && (
                <div className="rounded-md border p-3">
                  <p className="text-xs font-semibold text-primary mb-3">Visual Reference (From Book)</p>
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {activeTopic.visuals.map((visual, idx) => (
                      <div key={`visual-${idx}`} className="rounded-md border bg-background/60 p-2 space-y-2">
                        <p className="text-xs font-medium">{visual.title}</p>
                        {(visual.kind || "").toLowerCase() === "pdf" || /\.pdf(#|$)/i.test(visual.src) ? (
                          <iframe
                            src={visual.src}
                            title={visual.title}
                            className="h-56 w-full rounded border"
                          />
                        ) : (
                          <img src={visual.src} alt={visual.title} className="h-56 w-full rounded border object-contain bg-muted/40" />
                        )}
                        {visual.caption && <p className="text-[11px] text-muted-foreground">{visual.caption}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => moveTopic("prev")} disabled={!activeChapter || topicIndex === 0}>Prev Topic</Button>
                  <Button variant="outline" onClick={() => moveTopic("next")} disabled={!activeChapter || topicIndex >= topicCount - 1}>Next Topic</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => moveBlock("prev")} disabled={blockIndex === 0}><ChevronLeft className="h-4 w-4" />Prev Block</Button>
                  <Button variant="outline" onClick={() => moveBlock("next")} disabled={blockIndex >= blocks.length - 1}>Next Block<ChevronRight className="h-4 w-4" /></Button>
                  <Button variant="outline" onClick={toggleActiveBookmark}><BookMarked className="h-4 w-4 mr-1" />Bookmark</Button>
                  <Button variant="outline" onClick={toggleActiveWeak}><Target className="h-4 w-4 mr-1" />Weak</Button>
                  <Button onClick={markCompleted}>Mark Topic Complete</Button>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle className="text-lg">Smart Revision Queue</CardTitle>
              <CardDescription>Priority order based on weak topics, incomplete coverage, and bookmarks.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {revisionQueue.map((item) => (
                <div key={`${item.chapterId}-${item.topicId}`} className="rounded-md border p-3">
                  <p className="text-sm font-medium">{item.topicTitle}</p>
                  <p className="text-xs text-muted-foreground">{item.chapterTitle}</p>
                  <div className="mt-2 flex gap-1">
                    {item.weak && <Badge variant="destructive">Weak</Badge>}
                    {item.bookmarked && <Badge variant="outline">Bookmarked</Badge>}
                    {!item.done && <Badge variant="secondary">Incomplete</Badge>}
                    {item.done && <Badge variant="secondary">Done</Badge>}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />Reference Book Viewer</CardTitle>
            <CardDescription>Full reference material for {activeSubject.label} after your slide study.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {referenceBooks.map((book, idx) => (
                <Button
                  key={`${book.src}-${idx}`}
                  size="sm"
                  variant={idx === activeReferenceBookIndex ? "default" : "outline"}
                  onClick={() => setActiveReferenceBookIndex(idx)}
                >
                  {book.title}
                </Button>
              ))}
            </div>
            {activeReferenceBook ? (
              <div ref={referenceViewerRef} className="rounded-md border bg-background">
                <div className="flex items-center justify-between gap-2 border-b p-2">
                  <p className="text-sm font-medium">{activeReferenceBook.title}</p>
                  <Button size="sm" variant="outline" onClick={openReferenceFullScreen}>
                    <Maximize2 className="mr-1 h-4 w-4" />
                    Full Screen
                  </Button>
                </div>
                <iframe
                  src={activeReferenceBook.src}
                  title={activeReferenceBook.title}
                  className="h-[88vh] w-full rounded-b-md"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Reference PDF is not available for this subject yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default UPSCNotes;
