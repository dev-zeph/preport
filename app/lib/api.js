// All network calls. Keys live on the server, never in this bundle.
import { File, UploadType } from "expo-file-system";

export const API = process.env.EXPO_PUBLIC_API_URL ?? "http://localhost:3100";

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

/**
 * Multipart upload of a file already on disk, addressed by its file:// URI.
 *
 * Why this is not just `fetch` with a FormData part:
 *
 * Expo SDK 57 replaces the global fetch with its own standards-compliant
 * implementation, and that one rejects React Native's `{ uri, name, type }`
 * form part outright:
 *
 *     expo/src/winter/fetch/convertFormData.ts
 *     "`uri` is not supported for React Native's FormData."
 *     -> throws Error('Unsupported FormDataPart implementation')
 *
 * That error is exactly what the recorder was hitting. A standards-compliant
 * part has to be a Blob or a File, which would mean pulling the whole
 * recording through JS memory.
 *
 * So we use expo-file-system's File.upload(), which is the native multipart
 * uploader: it streams straight off disk and never builds a FormData at all.
 * XHR is kept behind it as an independent fallback, because React Native's own
 * networking layer still understands a `uri` part. Two different mechanisms,
 * so a failure in one does not take the demo down.
 *
 * Do NOT set Content-Type on either path. The native layer writes the
 * multipart boundary, and overriding the header breaks the request.
 */
function parseBody(status, text, where) {
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    throw new Error(`${status} from ${where}: ${String(text).slice(0, 160)}`);
  }
  if (status < 200 || status >= 300) throw new Error(body.error ?? `${status}`);
  return body;
}

function postFileXhr(url, field, uri, name, type) {
  return new Promise((resolve, reject) => {
    const form = new FormData();
    form.append(field, { uri, name, type });

    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.timeout = 60000;
    xhr.onload = () => {
      try { resolve(parseBody(xhr.status, xhr.responseText, "server")); }
      catch (e) { reject(e); }
    };
    // Every failure has to carry a readable message: nobody can attach a
    // debugger to the phone mid-demo.
    xhr.onerror = () => reject(new Error(`Network request failed reaching ${url}`));
    xhr.ontimeout = () => reject(new Error(`Timed out after 60s reaching ${url}`));
    xhr.onabort = () => reject(new Error("Upload was aborted"));
    xhr.send(form);
  });
}

async function postFile(path, field, uri, name, type) {
  const url = `${API}${path}`;
  try {
    const res = await new File(uri).upload(url, {
      httpMethod: "POST",
      uploadType: UploadType.MULTIPART,
      fieldName: field,
      mimeType: type,
    });
    // upload() resolves for non-2xx as well, so the status is checked here
    // rather than assumed.
    return parseBody(res.status, res.body, "server");
  } catch (primary) {
    console.warn(`native upload failed (${primary.message}), trying XHR`);
    try {
      return await postFileXhr(url, field, uri, name, type);
    } catch (fallback) {
      // Surface both, so a failure on stage names which paths were tried.
      throw new Error(`Upload failed. Native: ${primary.message}. XHR: ${fallback.message}`);
    }
  }
}

export async function health() {
  return asJson(await fetch(`${API}/api/health`));
}

export async function transcribe(uri) {
  const { text } = await postFile("/api/transcribe", "file", uri, "clip.m4a", "audio/m4a");
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

/** Ask the server to voice a line. Returns an absolute URL to an mp3. */
export async function speak(text, language) {
  const { absolute } = await asJson(
    await fetch(`${API}/api/speak`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, language }),
    })
  );
  return absolute;
}

export async function uploadPhoto(id, uri) {
  return postFile(`/api/reports/${id}/photo`, "photo", uri, `${id}.jpg`, "image/jpeg");
}
