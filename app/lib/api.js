// All network calls. Keys live on the server, never in this bundle.
export const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3000";

async function asJson(res) {
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${res.status} from server: ${text.slice(0, 160)}`);
  }
  if (!res.ok) throw new Error(body.error ?? `${res.status}`);
  return body;
}

export async function health() {
  return asJson(await fetch(`${API}/api/health`));
}

/** React Native FormData takes a URI object, not a Blob. Do not set
 *  Content-Type by hand: RN sets the multipart boundary and overriding
 *  it breaks the request. */
export async function transcribe(uri) {
  const form = new FormData();
  form.append("file", { uri, name: "clip.m4a", type: "audio/m4a" });
  const { text } = await asJson(
    await fetch(`${API}/api/transcribe`, { method: "POST", body: form })
  );
  return text;
}

export async function converse(messages) {
  return asJson(
    await fetch(`${API}/api/converse`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages }),
    })
  );
}

export async function createReport(report) {
  return asJson(
    await fetch(`${API}/api/reports`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(report),
    })
  );
}

export async function uploadPhoto(id, uri) {
  const form = new FormData();
  form.append("photo", { uri, name: `${id}.jpg`, type: "image/jpeg" });
  return asJson(
    await fetch(`${API}/api/reports/${id}/photo`, { method: "POST", body: form })
  );
}
