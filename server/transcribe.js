// Whisper proxy. Claude's Messages API does not accept audio, so speech-to-text
// is a separate hop. The key lives here, never in the mobile bundle.
//
// Node 20+ has FormData and Blob globally, so no form-data package is needed.

export async function transcribe(buffer, filename = "clip.m4a", mimetype = "audio/m4a") {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("OPENAI_API_KEY is not set on the server");
  }

  const form = new FormData();
  form.append("file", new Blob([buffer], { type: mimetype }), filename);
  form.append("model", "whisper-1");

  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
    body: form,
  });

  if (!res.ok) {
    throw new Error(`Whisper ${res.status}: ${(await res.text()).slice(0, 400)}`);
  }
  const { text } = await res.json();
  return text;
}
