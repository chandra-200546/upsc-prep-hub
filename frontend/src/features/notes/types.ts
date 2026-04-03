export type TopicNote = {
  id?: string;
  title: string;
  notes: string[];
  prelimsFocus: string[];
  mainsFocus: string[];
  tags?: string[];
  pyqHints?: string[];
  answerFramework?: string[];
};

export type Chapter = {
  id: string;
  title: string;
  weight: string;
  topics: TopicNote[];
};

export type BookPart = {
  id: string;
  title: string;
  description: string;
  chapterIds: string[];
};

export type StudyBlock = {
  id: string;
  title: string;
  bullets: string[];
};

export type TopicPreference = {
  bookmarked?: boolean;
  weak?: boolean;
};
