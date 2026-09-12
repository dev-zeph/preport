// Whisper proxy. Claude's Messages API does not accept audio, so speech-to-text
// is a separate hop. The key lives here, never in the mobile bundle.
//
// Node 20+ has FormData and Blob globally, so no form-data package is needed.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = process.env.TRANSCRIBE_MODEL || "whisper-1";

// ---------------------------------------------------------------------------
// Vocabulary hint.
//
// Measured, not guessed. On a real recording of "Gottingen Street", every model
// we have access to got it wrong unprompted:
//
//   whisper-1               -> "Gerdingen Street"
//   gpt-4o-mini-transcribe  -> "Girdingin Street"
//   gpt-4o-transcribe       -> "Gerdingen Street"
//
// With the street names supplied as a prompt, whisper-1 and gpt-4o-transcribe
// both return "Gottingen Street". So this is a vocabulary problem, not a model
// problem, and a bigger model does not fix it.
//
// It matters more than a spelling nit: geocode.js matches on the street name,
// so a mangled one costs the report its district and its map pin. Gottingen is
// in the demo script.
//
// The list is built from the same real HRM data the geocoder uses, ordered by
// how often each street actually appears in service requests. The prompt is
// capped because Whisper only reads the last 224 tokens of it, so a longer list
// would silently push the busiest streets out of the window.
// ---------------------------------------------------------------------------
const HINT_STREETS = 55;

function buildHint() {
  const f = join(dirname(fileURLToPath(import.meta.url)), "data", "streets.json");
  if (!existsSync(f)) return "";
  try {
    const streets = JSON.parse(readFileSync(f, "utf8"));
    const names = streets
      .slice()
      .sort((a, b) => (b.n ?? 0) - (a.n ?? 0))
      .slice(0, HINT_STREETS)
      .map((s) => s.match.replace(/\b[a-z]/g, (c) => c.toUpperCase()));
    return `Halifax Regional Municipality street names: ${names.join(", ")}.`;
  } catch (e) {
    console.error(`transcribe: could not build street hint: ${e.message}`);
    return "";
  }
}

const HINT = buildHint();
console.log(`transcribe: ${MODEL}, hint ${HINT ? `${HINT.length} chars` : "unavailable"}`);

export async function transcribe(buffer, filename = "clip.m4a", mimetype = "audio/m4a") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), filename);
  form.append("model", MODEL);
  if (HINT) form.append("prompt", HINT);

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Transcription ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const { text } = await res.json();
  return text;
}
