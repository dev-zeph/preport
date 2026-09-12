// Shared enums. Imported by server, app and dashboard.
// Divergent enums across three codebases is the classic four-hour-project bug.

export const CATEGORIES = [
  "pothole",
  "blocked_driveway",
  "street_light",
  "tree_hazard",
  "sidewalk",
  "flooding",
  "debris",
  "signage",
  "graffiti",
  "other",
];

export const CATEGORY_LABELS = {
  pothole: "Pothole",
  blocked_driveway: "Blocked driveway",
  street_light: "Street light",
  tree_hazard: "Tree hazard",
  sidewalk: "Sidewalk",
  flooding: "Flooding",
  debris: "Debris",
  signage: "Signage",
  graffiti: "Graffiti",
  other: "Other",
};

export const STATUSES = ["new", "acknowledged", "assigned", "resolved"];

export const SEVERITIES = ["low", "medium", "high"];

export const SOURCES = ["voice", "text", "hrm_import"];

// Claude has returned both "en" and "English" for the same field, so the stored
// value is normalised rather than trusted. Two-letter ISO 639-1, lowercase.
const LANGUAGE_NAMES = {
  english: "en", french: "fr", français: "fr", francais: "fr", arabic: "ar",
  spanish: "es", mandarin: "zh", chinese: "zh", hindi: "hi", punjabi: "pa",
  tagalog: "tl", german: "de", portuguese: "pt", russian: "ru", urdu: "ur",
  farsi: "fa", persian: "fa", korean: "ko", japanese: "ja", vietnamese: "vi",
};

export function normaliseLanguage(value) {
  const v = String(value ?? "").trim().toLowerCase();
  if (!v) return "en";
  if (/^[a-z]{2}$/.test(v)) return v;
  return LANGUAGE_NAMES[v] ?? v.slice(0, 2);
}
