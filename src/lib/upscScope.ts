export const UPSC_REFUSAL_TEXT =
  "Sorry Aspirant, I focus only on UPSC-related topics. Let's stay on track! 📘";

export const isWithinUpscScope = (input: string): boolean => {
  const text = input.toLowerCase();
  const hasConstitutionArticlePattern = /\barticle\s*\d{1,3}\b/.test(text);
  const hasGsPaperPattern = /\bgs\s*[- ]?(1|2|3|4)\b/.test(text);

  const upscKeywords = [
    "upsc", "ias", "ips", "ifos", "civil services", "prelims", "mains", "gs", "essay", "interview",
    "polity", "constitution", "parliament", "federal", "fundamental rights", "dpsp", "governor", "president",
    "history", "ancient", "medieval", "modern history", "freedom struggle",
    "geography", "monsoon", "climate", "soil", "plate tectonics", "river system",
    "economy", "gdp", "inflation", "fiscal", "monetary", "budget", "banking", "frbm",
    "environment", "ecology", "biodiversity", "conservation", "climate change",
    "science and technology", "science & tech", "space", "biotechnology", "cyber security",
    "ethics", "integrity", "aptitude", "case study",
    "current affairs", "international relations", "foreign policy", "governance", "social justice",
    "ncert", "laxmikanth", "spectrum"
  ];

  const explicitlyOutOfScopeKeywords = [
    "python", "javascript", "java", "c++", "coding", "programming", "debug", "algorithm",
    "movie", "cinema", "series", "song", "music", "celebrity",
    "relationship", "dating", "breakup", "marriage advice", "career advice outside upsc",
    "gaming", "cricket score", "football score"
  ];

  if (explicitlyOutOfScopeKeywords.some((k) => text.includes(k))) {
    return false;
  }

  return hasConstitutionArticlePattern || hasGsPaperPattern || upscKeywords.some((k) => text.includes(k));
};
