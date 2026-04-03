const PROGRESS_KEY = "upsc_notes_progress_v1";

export type NotesProgress = Record<string, boolean>;

export const readNotesProgress = (): NotesProgress => {
  try {
    return JSON.parse(localStorage.getItem(PROGRESS_KEY) || "{}");
  } catch {
    return {};
  }
};

export const writeNotesProgress = (progress: NotesProgress) => {
  localStorage.setItem(PROGRESS_KEY, JSON.stringify(progress));
};

export const topicKey = (chapterId: string, topicId: string) => `${chapterId}::${topicId}`;
