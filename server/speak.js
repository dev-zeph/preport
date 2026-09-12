// Text to speech, server side.
//
// The app used to speak follow-ups with expo-speech, which is the phone's own
// voice (Siri on iOS). That reads as a phone assistant, not as the city, and it
// gives no control over accent. OpenAI's gpt-4o-mini-tts takes a free-text
// `instructions` field, so the voice can be steered directly.
//
// Output is cached on disk by a hash of everything that affects the audio.
// Claude asks the same handful of questions constantly ("Which street or
// intersection is it on?"), so in practice most turns cost nothing and return
// instantly, which matters more on stage than it does in the bill.
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const MODEL = process.env.TTS_MODEL || "gpt-4o-mini-tts";
const VOICE = process.env.TTS_VOICE || "shimmer";

// Steering, not a script. Keep it about delivery.
//
// On pace: this model ignores the API's `speed` parameter almost entirely
// (1.25x measured only 4% shorter), and responds to pace wording by roughly
// 8%, which is inside take-to-take variance. So pace is asked for firmly here
// and the voice choice does the rest. Measured on the same sentence:
// shimmer ~165 wpm, coral ~160, nova ~154, sage ~135. Ordinary speech is
// 140-160, so shimmer is the brisk end of natural.
const INSTRUCTIONS = process.env.TTS_INSTRUCTIONS ||
  "Speak in a warm, friendly Canadian English accent, like a city works " +
  "employee chatting with a neighbour on the street. Brisk and natural: move " +
  "through the sentence at the pace of ordinary conversation, no pauses " +
  "between sentences, never drawn out, never announcer-like.";

export const CACHE = join(dirname(fileURLToPath(import.meta.url)), "speech");
mkdirSync(CACHE, { recursive: true });

export const voiceName = () => `${MODEL}/${VOICE}`;

/**
 * Returns the public path of an mp3 for this text, synthesising it if it is not
 * already cached. Throws so the caller can fall back to on-device speech.
 */
export async function speak(text, { language } = {}) {
  if (!process.env.OPENAI_API_KEY) throw new Error("OPENAI_API_KEY is not set on the server");
  const clean = String(text ?? "").trim();
  if (!clean) throw new Error("nothing to speak");

  // The language rides in the key because it changes the instructions, and so
  // must change the cached file.
  const key = createHash("sha256")
    .update([MODEL, VOICE, INSTRUCTIONS, language ?? "en", clean].join(" "))
    .digest("hex")
    .slice(0, 32);
  const file = join(CACHE, `${key}.mp3`);
  const url = `/speech/${key}.mp3`;
  if (existsSync(file)) return { url, cached: true };

  // The resident may speak any language, and the follow-up comes back in
  // theirs. Tell the voice, or it reads French with an English mouth.
  const instructions = language && language !== "en"
    ? `${INSTRUCTIONS} The text is in "${language}"; speak it natively in that language.`
    : INSTRUCTIONS;

  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      voice: VOICE,
      input: clean,
      instructions,
      response_format: "mp3",
    }),
  });

  if (!res.ok) {
    throw new Error(`TTS ${res.status}: ${(await res.text()).slice(0, 300)}`);
  }

  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
  return { url, cached: false };
}
