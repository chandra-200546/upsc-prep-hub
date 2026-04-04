import { BookPart } from "../types";

export const GEOGRAPHY_BOOK_PARTS: BookPart[] = [
  {
    id: "geography-part-1",
    title: "Part 1: Earth and Space Basics",
    description: "Chapter 1 to 3 coverage from the 6th standard geography book.",
    chapterIds: [
      "geo-ch1-earth-in-solar-system",
      "geo-ch2-globe-latitudes-longitudes",
      "geo-ch3-motions-of-earth",
    ],
  },
  {
    id: "geography-part-2",
    title: "Part 2: Maps and Earth Domains",
    description: "Chapter 4 to 6 coverage with map skills and physical geography fundamentals.",
    chapterIds: [
      "geo-ch4-maps",
      "geo-ch5-major-domains-of-earth",
      "geo-ch6-major-landforms-of-earth",
    ],
  },
  {
    id: "geography-part-3",
    title: "Part 3: India Geography",
    description: "Chapter 7 and 8 coverage focused on India location, climate and ecology.",
    chapterIds: [
      "geo-ch7-our-country-india",
      "geo-ch8-india-climate-vegetation-wildlife",
    ],
  },
];
