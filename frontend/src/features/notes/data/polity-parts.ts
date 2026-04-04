import { BookPart } from "../types";

export const POLITY_BOOK_PARTS: BookPart[] = [
  {
    id: "polity-part-1",
    title: "Part 1: Core Constitution",
    description: "Foundations, system of government, Union and State institutions.",
    chapterIds: [
      "polity-constitutional-framework",
      "polity-system-of-government",
      "polity-central-government",
      "polity-state-government",
      "polity-local-government",
    ],
  },
  {
    id: "polity-part-2",
    title: "Part 2: Institutions and Dynamics",
    description: "Bodies, special provisions, legal dimensions and political process.",
    chapterIds: [
      "polity-ut-special-areas",
      "polity-constitutional-bodies",
      "polity-non-constitutional-bodies",
      "polity-other-dimensions",
      "polity-political-dynamics",
      "polity-advanced-topics",
    ],
  },
];
