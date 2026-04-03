import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, BookOpen, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { HISTORY_NOTES } from "@/features/notes/data/history-book";
import { buildStudyBlocks, buildTopicId, filterChaptersByQuery } from "@/features/notes/lib/engine";
import { readNotesProgress, topicKey, writeNotesProgress } from "@/features/notes/lib/progress";

const UPSCNotes = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [chapterId, setChapterId] = useState(HISTORY_NOTES[0]?.id || "");
  const [topicIndex, setTopicIndex] = useState(0);
  const [blockIndex, setBlockIndex] = useState(0);
  const [progress, setProgress] = useState(readNotesProgress());

  const filteredChapters = useMemo(() => filterChaptersByQuery(HISTORY_NOTES, query), [query]);

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

  const resetForChapter = (nextChapterId: string) => {
    setChapterId(nextChapterId);
    setTopicIndex(0);
    setBlockIndex(0);
  };

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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/20">
      <div className="container mx-auto max-w-7xl px-4 py-6 space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-3xl font-bold text-primary">UPSC History Notes</h1>
            <p className="text-sm text-muted-foreground">Phase 1: chapter index, search, 10-block study format, progress tracking.</p>
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2"><BookOpen className="h-5 w-5" />History Book Index</CardTitle>
            <CardDescription>Search and open chapter/topic notes.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input className="pl-9" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search chapter/topic/keyword..." />
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <Card className="lg:col-span-1">
            <CardHeader><CardTitle className="text-lg">Chapters</CardTitle></CardHeader>
            <CardContent className="space-y-2 max-h-[70vh] overflow-auto">
              {filteredChapters.map((chapter) => (
                <button
                  key={chapter.id}
                  onClick={() => resetForChapter(chapter.id)}
                  className={`w-full rounded-md border p-3 text-left ${chapter.id === activeChapter?.id ? "border-primary bg-primary/10" : "border-border"}`}
                >
                  <p className="font-medium text-sm">{chapter.title}</p>
                  <p className="text-xs text-muted-foreground mt-1">{chapter.topics.length} topics</p>
                </button>
              ))}
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
                {isTopicDone && <Badge variant="secondary">Completed</Badge>}
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

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => moveTopic("prev")} disabled={!activeChapter || topicIndex === 0}>Prev Topic</Button>
                  <Button variant="outline" onClick={() => moveTopic("next")} disabled={!activeChapter || topicIndex >= topicCount - 1}>Next Topic</Button>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => moveBlock("prev")} disabled={blockIndex === 0}><ChevronLeft className="h-4 w-4" />Prev Block</Button>
                  <Button variant="outline" onClick={() => moveBlock("next")} disabled={blockIndex >= blocks.length - 1}>Next Block<ChevronRight className="h-4 w-4" /></Button>
                  <Button onClick={markCompleted}>Mark Topic Complete</Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default UPSCNotes;
