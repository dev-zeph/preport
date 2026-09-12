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
