export const API = import.meta.env.VITE_API_URL ?? "http://localhost:3100";

export const getReports = () => fetch(`${API}/api/reports`).then((r) => r.json());
export const getDistricts = () => fetch(`${API}/api/districts`).then((r) => r.json());
export const setStatus = (id, status) =>
  fetch(`${API}/api/reports/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status }),
  }).then((r) => r.json());

export const CATEGORY_LABELS = {
  pothole: "Pothole", blocked_driveway: "Blocked driveway", street_light: "Street light",
  tree_hazard: "Tree hazard", sidewalk: "Sidewalk", flooding: "Flooding",
  debris: "Debris", signage: "Signage", graffiti: "Graffiti", other: "Other",
};
export const STATUSES = ["new", "acknowledged", "assigned", "resolved"];
export const SEV_COLOR = { high: "#FF5A5A", medium: "#FFB020", low: "#4C8DFF" };

export const ago = (iso) => {
  const m = Math.floor((Date.now() - new Date(iso)) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
