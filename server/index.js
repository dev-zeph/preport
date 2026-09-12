// Repoth server. Three jobs: proxy the AI calls, own the data, push updates.
import express from "express";
import multer from "multer";
import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import * as store from "./store.js";
import { converse, modelName } from "./claude.js";
import { transcribe } from "./transcribe.js";
import { geocode, streetCount } from "./geocode.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PHOTOS = join(__dirname, "photos");
mkdirSync(PHOTOS, { recursive: true });

const app = express();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 25 * 1024 * 1024 } });

app.use(express.json({ limit: "2mb" }));
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
  req.method === "OPTIONS" ? res.sendStatus(204) : next();
});
app.use("/photos", express.static(PHOTOS));

// Errors are returned as JSON with a readable message. The app renders them
// on screen rather than failing silently, so a bad demo is debuggable.
const fail = (res, code, e) => {
  console.error(`  ! ${e.message}`);
  res.status(code).json({ error: e.message });
};

app.get("/api/health", (_req, res) =>
  res.json({
    ok: true,
    model: modelName(),
    reports: store.list().length,
    streets: streetCount(),
    sse_clients: store.clientCount(),
    anthropic_key: Boolean(process.env.ANTHROPIC_API_KEY),
    openai_key: Boolean(process.env.OPENAI_API_KEY),
  })
);

app.post("/api/transcribe", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) throw new Error("no audio file in request");
    const text = await transcribe(req.file.buffer, req.file.originalname, req.file.mimetype);
    console.log(`  transcribed: "${text.slice(0, 70)}"`);
    res.json({ text });
  } catch (e) {
    fail(res, 500, e);
  }
});

app.post("/api/converse", async (req, res) => {
  try {
    const { messages } = req.body;
    if (!Array.isArray(messages) || !messages.length) throw new Error("messages[] required");
    const out = await converse(messages);
    console.log(`  converse -> ${out.type}${out.type === "question" ? `: ${out.question}` : ""}`);
    res.json(out);
  } catch (e) {
    fail(res, 500, e);
  }
});

app.get("/api/reports", (_req, res) => res.json(store.list()));

app.post("/api/reports", (req, res) => {
  try {
    const b = req.body ?? {};
    if (!b.description) throw new Error("description required");
    // When the two-question cap forces a report with nothing to go on, Claude
    // fills location with a placeholder. Store that as absent, not as a street.
    const loc = b.location_text?.trim();
    const locationText =
      !loc || /^<?unknown>?$|^n\/?a$|^unspecified$/i.test(loc) ? null : loc;
    // Never guess a location. Unmatched stores null coords and renders as
    // "location not mapped" rather than dropping the report or faking a pin.
    const place = geocode(locationText);
    const report = store.create({
      source: b.source ?? "voice",
      location_text: locationText,
      landmark: b.landmark ?? null,
      category: b.category ?? "other",
      severity: b.severity ?? "medium",
      safety_risk: Boolean(b.safety_risk),
      description: b.description,
      language: b.language ?? "en",
      transcript: b.transcript ?? [],
      ...place,
    });
    console.log(`  + ${report.id} ${report.category} ${report.district ?? "unmapped"}`);
    res.status(201).json({ id: report.id, report });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.post("/api/reports/:id/photo", upload.single("photo"), (req, res) => {
  try {
    if (!req.file) throw new Error("no photo in request");
    if (!store.get(req.params.id)) throw new Error(`no report ${req.params.id}`);
    const name = `${req.params.id}.jpg`;
    writeFileSync(join(PHOTOS, name), req.file.buffer);
    const report = store.update(req.params.id, { photo: `/photos/${name}` });
    res.json({ ok: true, photo: report.photo });
  } catch (e) {
    fail(res, 400, e);
  }
});

app.patch("/api/reports/:id", (req, res) => {
  const report = store.update(req.params.id, { status: req.body.status });
  report ? res.json(report) : res.status(404).json({ error: "not found" });
});

app.get("/api/districts", (_req, res) => {
  const f = join(__dirname, "data", "districts.json");
  existsSync(f)
    ? res.type("json").send(readFileSync(f, "utf8"))
    : res.status(404).json({ error: "districts.json missing — run npm run pull-data" });
});

// SSE. This is the whole live-update feature.
app.get("/api/stream", (req, res) => {
  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.flushHeaders();
  res.write(`event: hello\ndata: {"ok":true}\n\n`);
  const remove = store.addClient(res);
  const beat = setInterval(() => res.write(": keepalive\n\n"), 15000);
  req.on("close", () => {
    clearInterval(beat);
    remove();
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, "0.0.0.0", () => {
  console.log(`repoth server  :${PORT}   model ${modelName()}`);
  if (!process.env.ANTHROPIC_API_KEY) console.log("  ! ANTHROPIC_API_KEY not set");
  if (!process.env.OPENAI_API_KEY) console.log("  ! OPENAI_API_KEY not set");
});
