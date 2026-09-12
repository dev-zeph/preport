// Classical design system tokens, mobile surface.
// Values come from _ds/classical-.../styles.css and the Repoth handoff, not
// from taste. Do not invent a colour here: if a colour appears on screen it
// encodes severity, status, or a data deficit. There is one accent.

export const color = {
  bg: "#f3f2f2",
  surface: "#eae9e9",
  text: "#201f1d",
  divider: "rgba(32,31,29,0.16)",

  accent: "#b68235",      // hi-viz ochre, the single accent
  accent100: "#fff3e4",   // tinted fills
  accent200: "#ffe3bf",   // pressed fill, helmet shell
  accent300: "#facb8d",   // helmet brim
  accent400: "#e1ad66",   // listening rings
  accent500: "#c28d41",
  accent600: "#a06f24",   // the helmet's expression line
  accent700: "#7d5411",   // accent text at body size
  accent800: "#5a3b0a",   // label text on accent-100
  accent900: "#3a270d",

  neutral100: "#f8f4f4",
  neutral200: "#eae7e7",
  neutral300: "#d7d3d3",
  neutral400: "#bab6b6",
  neutral500: "#9b9797",
  neutral600: "#7d7979",
  neutral700: "#605d5d",
  neutral800: "#444141",
  neutral900: "#2d2b2b",
};

// Meaning only. Identical to the values the dashboard uses.
export const sev = { low: "#7d7979", mod: "#c28d41", high: "#8f3a1c" };
export const status = { new: "#7d5411", ack: "#605d5d", res: "#33685c" };

// 1.15x density scale. Prefer gap over margins.
export const space = { 1: 4.6, 2: 9.2, 3: 13.8, 4: 18.4, 6: 27.6, 8: 36.8 };

// Nothing rounder than 7, except the circular talk target.
export const radius = { sm: 2, md: 4, lg: 7 };

// Elevation is a whisper. The talk target takes sm; almost nothing else does.
export const shadow = {
  sm: { shadowColor: "#2d2b2b", shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.14, shadowRadius: 2, elevation: 1 },
  md: { shadowColor: "#2d2b2b", shadowOffset: { width: 0, height: 3 }, shadowOpacity: 0.16, shadowRadius: 10, elevation: 3 },
  lg: { shadowColor: "#2d2b2b", shadowOffset: { width: 0, height: 12 }, shadowOpacity: 0.22, shadowRadius: 32, elevation: 10 },
};

// Two faces, two jobs. Heading never goes past 600; the larger it sets, the
// lighter the cut, so display sizes take the 400.
export const font = {
  heading: "CormorantGaramond_400Regular",
  headingSemi: "CormorantGaramond_600SemiBold",
  body: "Lora_400Regular",
  bodySemi: "Lora_600SemiBold",
};

// Figures that stand in columns set tabular. Running prose does not.
export const tabular = { fontVariant: ["tabular-nums"] };

// The 10px caps label that runs above almost every field on this surface.
export const kicker = {
  fontFamily: font.bodySemi,
  fontSize: 10,
  letterSpacing: 1.4,        // .14em at 10px
  textTransform: "uppercase",
  color: color.neutral600,
};
