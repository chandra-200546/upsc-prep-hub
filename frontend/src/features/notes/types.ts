export type TopicNote = {
  id?: string;
  title: string;
  notes: string[];
  prelimsFocus: string[];
  mainsFocus: string[];
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
