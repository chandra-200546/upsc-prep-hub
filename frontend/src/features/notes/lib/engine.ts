import { Chapter, StudyBlock, TopicNote } from "../types";

const clean = (v: string) => v.replace(/\s+/g, " ").trim();

const safeTake = (items: string[], count: number, fallback: string[]) => {
  const src = items.map(clean).filter(Boolean);
  if (src.length >= count) return src.slice(0, count);
  const out = [...src];
  let i = 0;
  while (out.length < count) {
    out.push(fallback[i % fallback.length]);
    i += 1;
  }
  return out;
};

export const buildStudyBlocks = (topic: TopicNote): StudyBlock[] => {
  const notes = topic.notes.map(clean).filter(Boolean);
  const prelims = topic.prelimsFocus.map(clean).filter(Boolean);
  const mains = topic.mainsFocus.map(clean).filter(Boolean);

  const baseFallback = [
    "Revise this topic with chronology + cause-effect framing.",
    "Connect static concepts with movement outcomes.",
    "Keep answer structure: intro, body points, conclusion.",
  ];

  return [
    { id: "concept", title: "1. Concept Snapshot", bullets: safeTake(notes, 3, baseFallback) },
    { id: "background", title: "2. Historical Background", bullets: safeTake(notes.slice(1), 3, baseFallback) },
    { id: "timeline", title: "3. Timeline Anchors", bullets: safeTake(prelims, 3, baseFallback) },
    { id: "features", title: "4. Core Features", bullets: safeTake(notes, 4, baseFallback) },
    { id: "impact", title: "5. Impact and Significance", bullets: safeTake(mains, 3, baseFallback) },
    { id: "prelims", title: "6. Prelims Focus", bullets: safeTake(prelims, 4, baseFallback) },
    { id: "mains", title: "7. Mains Focus", bullets: safeTake(mains, 4, baseFallback) },
    { id: "compare", title: "8. Comparison / Debate Angle", bullets: safeTake(mains.concat(notes), 3, baseFallback) },
    { id: "revision", title: "9. Quick Revision Points", bullets: safeTake(notes.concat(prelims), 5, baseFallback) },
    { id: "answer", title: "10. Answer Writing Blueprint", bullets: [
      "Intro: define context in 2-3 lines.",
      ...safeTake(mains, 2, baseFallback),
      "Conclusion: balanced assessment + way forward.",
    ] },
  ];
};

export const buildTopicId = (chapterId: string, topic: TopicNote, index: number) =>
  topic.id || `${chapterId}-${index + 1}`;

export const filterChaptersByQuery = (chapters: Chapter[], query: string): Chapter[] => {
  const q = query.trim().toLowerCase();
  if (!q) return chapters;
  return chapters
    .map((chapter) => ({
      ...chapter,
      topics: chapter.topics.filter((topic) => {
        const hay = [
          chapter.title,
          topic.title,
          ...topic.notes,
          ...topic.prelimsFocus,
          ...topic.mainsFocus,
        ]
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      }),
    }))
    .filter((chapter) => chapter.topics.length > 0);
};
