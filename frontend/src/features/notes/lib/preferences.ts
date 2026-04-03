import { TopicPreference } from "../types";

const PREF_KEY = "upsc_notes_topic_preferences_v1";

export type TopicPreferenceMap = Record<string, TopicPreference>;

export const readTopicPreferences = (): TopicPreferenceMap => {
  try {
    return JSON.parse(localStorage.getItem(PREF_KEY) || "{}");
  } catch {
    return {};
  }
};

export const writeTopicPreferences = (prefs: TopicPreferenceMap) => {
  localStorage.setItem(PREF_KEY, JSON.stringify(prefs));
};

export const toggleBookmark = (prefs: TopicPreferenceMap, key: string): TopicPreferenceMap => {
  const current = prefs[key] || {};
  return {
    ...prefs,
    [key]: {
      ...current,
      bookmarked: !current.bookmarked,
    },
  };
};

export const toggleWeak = (prefs: TopicPreferenceMap, key: string): TopicPreferenceMap => {
  const current = prefs[key] || {};
  return {
    ...prefs,
    [key]: {
      ...current,
      weak: !current.weak,
    },
  };
};
