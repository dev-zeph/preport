# Repoth — session handoff

**Written 2026-09-12, 14:35 ADT, at the end of session 1.**
**Read this top to bottom before touching anything. It is written so a cold session can continue without re-deriving any of it.**

---

## 0. Resume in sixty seconds

```bash
cd /Users/zephaniahchizulu/Desktop/preport

# 1. server (needs .env with real keys, see §9)
nohup node --env-file-if-exists=.env server/index.js > /tmp/repoth-server.log 2>&1 & disown

# 2. dashboard
cd dashboard && nohup npm run dev > /tmp/repoth-vite.log 2>&1 & disown

# 3. expo (run in a REAL terminal if you want to see the QR code)
cd app && npx expo start

# 4. confirm
curl -s localhost:3100/api/health
```

Healthy output looks like:

```json
{"ok":true,"model":"claude-sonnet-5","reports":26,"streets":816,
 "sse_clients":0,"anthropic_key":true,"openai_key":true}
```

If `anthropic_key` or `openai_key` is `false`, the `.env` is wrong. See §9.
**Repoth runs on port 3100, not 3000.** Reason in §5.2.

---

## 1. What this is

A voice-first municipal incident reporting system for the Halifax Regional Municipality, built for the **Claude Community Impact Lab Halifax, 12 September 2026**, against **Problem 1, "Reporting What's Wrong"**.

A resident taps one button and says what is wrong out loud. Speech is transcribed, Claude asks at most two clarifying questions, optionally requests a photo, and produces a structured report. A Public Works dashboard receives it live. A separate panel shows which council districts under-report relative to population, which is the part that answers what the brief actually asks: **who is the city not hearing from.**

- **Repo:** https://github.com/dev-zeph/preport (public)
- **Local:** `/Users/zephaniahchizulu/Desktop/preport`
- **Hard deadlines that shaped everything:** open source on GitHub by 2:30 PM, demo 2:45 PM, three minutes.

The original spec the user supplied is a document called the "Repoth technical blueprint". This handoff records where we **followed** it, where we **deviated**, and why. Deviations are marked **DEVIATION** and every one of them was deliberate.

---

## 2. Status at end of session 1

**Shipped and pushed. Four commits, working tree clean, `main` level with `origin/main`.**

| Commit | What |
|---|---|
| `1c29aa1` | Fold diacritics in geocode matching |
| `de39401` | Demo run sheet |
| `8c724cf` | Expo app, dashboard, and README |
| `a556244` | Server, shared enums, and real HRM data pull |

1,607 lines of hand-written source across server, app, dashboard and the data script.

**Working and verified by me:** server (all 9 routes), Claude conversation layer, Whisper transcription, geocoding, SSE live updates, dashboard (list, detail, map, coverage panel), the HRM data pipeline, the Cloudflare tunnel.

**Built but NOT verified:** the Expo app on a physical phone. This is the single biggest open risk. See §8.2.

---

## 3. Decisions the user made

These were put to the user explicitly and answered. Do not silently reverse them.

| # | Question | Decision | Consequence |
|---|---|---|---|
| D1 | API keys available? | **Both Anthropic and OpenAI** | Whisper path is live; no fallback STT needed |
| D2 | Who builds? | **Solo. Claude builds all of it.** | User holds keys, drives the phone, rehearses. The blueprint's 4-person hour-by-hour table was discarded. |
| D3 | Mobile delivery | **Expo Go native only** | User was explicitly warned that Claude cannot test on device and every cycle runs through them. They chose it anyway. A mobile-web fallback was offered and declined. |
| D4 | Disk full, clear 5.8 GB of cache? | **Yes, clear all 7 targets** | See §10.2 |

**On D3:** the tradeoff was stated plainly at the time. Mobile web would have been testable by Claude end to end; Expo Go matches the brief's stated stack and demos better. The user chose fidelity over testability. **Do not re-litigate this in a new session unless the user raises it.** If the phone fails at the last minute, the text fallback and the curl path (§11) are the rehearsed escapes.

---

## 4. The single most important finding

**HRM publishes a live, queryable ArcGIS feed of real municipal service requests, and nobody expected the coverage panel to run on real data.**

Endpoint (public, no key, no auth):

```
https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/Cityworks_Service_Requests/FeatureServer/0/query
```

Fields: `REQUEST_ID, DATE_INITIATED, DATE_CLOSED, DESCRIPTION, INITIATED_BY, PRIORITY, ADDRESS, COMMUNITY, DISTRICT, REQUEST_CATEGORY, RESOLUTION, LATITUDE, LONGITUDE, STATUS, DEPT_RESPONSIBILITY, WORK_ORDER`. **477,343 records.**

This replaced three separate stubs the blueprint had accepted as unavoidable:

| Blueprint said | We shipped instead |
|---|---|
| Hand-type ~15 Halifax streets with approximate centroids | **816 streets**, coordinates = median of every real request on that street, district = modal district |
| Write 12 to 20 synthetic seed reports | **24 real recent HRM requests** mapped into our schema, labelled `source: "hrm_import"` |
| Precompute coverage from a published 311 CSV that ends Dec 2024 | **Live aggregation** over the operational feed, current to **2026-09-05** |

### 4.1 The numbers currently on the panel

| Metric | Value |
|---|---|
| Spread, quietest to loudest district | **13.8x** |
| Quietest | District 2, 21.6 requests per 1,000 residents per year |
| Loudest | District 8, 298 per 1,000 |
| Districts below the municipal median | 7 (D2, D1, D13, D14, D4, D3, D15) |
| Municipal median | 145.9 per 1,000 |
| Requests in the 12-month window | 64,636 |
| All-time requests | 477,343 |
| **Resident-originated share** | **12.1%** (INTERNAL 419,742 / 311 Online 41,992 / Respond 15,609) |
| Window | 2025-09-12 to 2026-09-05 |

**The 12.1% is the demo's opening stat** and it is stronger than the brief's "one in five report online", because it comes from the city's own live operational record rather than a published summary.

### 4.2 The honesty framing — do not weaken this

Low reports per capita is **not** proof of unmet need. It could mean fewer problems, or different problems, or a district that phones instead of clicking. This is said on the panel itself, in the README, and in the demo script.

The defensible claim is narrower and much harder to attack: **these districts are quiet in the record, the city's response follows the record, and nobody has checked whether the quiet is real.**

The 13.8x number carries extra weight because **council districts are drawn to near population parity by electoral boundary law**, so the gap is not explained by district size. That argument is the spine of the whole panel.

### 4.3 The correction to the brief

The brief tells teams HRM 311 data ends December 2024 and that judges are told to check whether teams disclose it. **That is true of the widely published 311 extract, but the operational Cityworks feed used here is current to 2026-09-05.** Both facts are stated on the coverage panel. Disclosing the *distinction* is a stronger honesty story than repeating the brief, and it demonstrates we actually went and looked.

---

## 5. Technical decisions

### 5.1 Stack corrections to the blueprint

**DEVIATION — `expo-av` is wrong for Expo SDK 57.** The blueprint specifies `expo-av`. That package is frozen at `16.0.8` on the old version scheme; the SDK-aligned package is **`expo-audio` at `57.0.5`**. We use `expo-audio`. Verified API, taken from the live docs, not memory:

```js
import { useAudioRecorder, RecordingPresets, setAudioModeAsync, AudioModule } from "expo-audio";

const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
await AudioModule.requestRecordingPermissionsAsync();
await setAudioModeAsync({ playsInSilentMode: true, allowsRecording: true });
await recorder.prepareToRecordAsync();
recorder.record();
await recorder.stop();
recorder.uri            // only valid AFTER stop()
```

**Node v25.9.0** confirmed, so global `FormData` and `Blob` exist and the Whisper proxy works exactly as the blueprint wrote it. No `form-data` package needed.

**Leaflet:** `leaflet@^1.9.4` with `react-leaflet@^5.0.0`. We use `CircleMarker`, not `Marker`, deliberately — the default Leaflet marker icon breaks under bundlers and `CircleMarker` sidesteps the whole problem while also letting us encode severity as colour.

### 5.2 Port 3100, not 3000

**DEVIATION.** The blueprint says port 3000. **Port 3000 on this machine is occupied by an unrelated Next.js dev server belonging to one of the user's other projects.** We did not kill it. Repoth runs on **3100** everywhere: `.env`, `.env.example`, `app/.env`, `dashboard/src/api.js`, README, DEMO.md.

Symptom if this regresses: the server appears to start, prints its banner, then the port check shows a `next-server` process and `/api/health` returns Next.js 404 HTML instead of JSON.

### 5.3 The Claude layer

Followed the blueprint exactly, because the design is right.

- Two tools only: `ask_follow_up` and `file_report`.
- `tool_choice: { type: "any" }` forces a tool call every turn. No free-text parsing, no JSON-in-a-string, no preamble handling.
- Branch on `content.find(b => b.type === "tool_use").name`.
- Model **`claude-sonnet-5`**. One-line swap to `claude-haiku-4-5-20251001` in `server/claude.js` if the loop feels slow.
- System prompt is the blueprint's, verbatim.

**The two-question cap is enforced in code, not just in the prompt** (`server/claude.js`):

```js
const askedSoFar = messages.filter((m) => m.role === "assistant").length;
const tool_choice = askedSoFar >= MAX_FOLLOW_UPS
  ? { type: "tool", name: "file_report" }
  : { type: "any" };
```

A model that keeps asking questions on stage is a dead demo, so it is made structurally impossible. **Verified working** — see §8.1.

**Conversation shape, worth knowing before you edit it:** we do *not* thread `tool_use`/`tool_result` blocks. The client sends a flat array of `{role, content}` plain-text turns, and the follow-up question is stored as a plain assistant text turn. This works because we force a tool call every turn and treat the tool call as the *output* rather than as a step in an agentic loop. It is much simpler and it is deliberate.

### 5.4 Server owns everything

One Express process does three jobs: proxy the AI calls, own the data, push updates over SSE. No database, no Supabase.

The reasoning, which still holds: **the repo is public and API keys cannot live in a mobile bundle**, so the server has to exist regardless. Given that, putting the data layer in it costs almost nothing and removes a signup, a second dashboard and a network dependency from the critical path.

Reports persist to `server/data/reports.json`, which is **gitignored**. On first boot with no `reports.json`, the store seeds itself from the committed `server/data/seed.json`, so a fresh clone has a populated board.

### 5.5 Geocoding is a lookup and never guesses

`server/geocode.js` loads `streets.json`, sorts longest-name-first so "north street" beats a bare "north", and matches on substring. **An unmatched location stores `lat`/`lng`/`district` as null with `geocode_method: "none"` and renders in the UI as "location not mapped".** It is never guessed and never dropped. A report the city cannot place is still a report, and showing that honestly beats a fake pin.

We **did not** build the blueprint's optional Nominatim fallback. With 816 real streets it stopped being worth the rate-limit risk.

### 5.6 Deliberate product calls

- **"Homeless Encampment" is NOT classified as `debris`.** The first classifier pass mapped it there via the `litter|debris|garbage` rule. In a demo about equity, labelling people's shelter as debris is exactly the wrong note. It now falls through to `other`, with a comment in `scripts/pull-data.js` saying why. **Do not let a future classifier change put it back.**
- **Follow-up questions are spoken with `expo-speech` AND shown as text.** Some rooms are loud and some users are deaf.
- **Photo capture uses `quality: 0.5`.** Full-resolution phone photos are several megabytes and visibly stall the upload.
- **Every app error renders as visible on-screen text**, never a silent catch, including the server URL. Because Claude cannot see the device, the user must be able to screenshot a failure and have it be diagnosable.
- **Text fallback exists on every screen that accepts voice**, posting to the same `/api/converse`. A dead mic on stage is a rehearsed switch, not an improvisation.

---

## 6. Architecture and file map

```
  Expo app (phone)
        |  HTTP over LAN, or Cloudflare tunnel
        v
  Node + Express :3100  -->  OpenAI Whisper   (transcription)
  (holds all keys)      -->  Anthropic API    (clarify + extract)
        |
        +-- JSON file        (reports)
        +-- SSE stream  -->  React dashboard :5173
```

```
preport/
├── README.md                    scored deliverable: real / precomputed / stubbed / not built
├── DEMO.md                      3-minute run sheet, failure paths, expected questions
├── docs/HANDOFF.md              this file
├── .gitignore                   .env on line 1
├── .env                         REAL KEYS, gitignored, never commit
├── .env.example                 committed
├── constants.js                 shared category + status enums
├── package.json                 root; server deps; scripts dev / pull-data / dashboard / app
├── scripts/
│   └── pull-data.js       255   one-shot HRM aggregation -> the three data files
├── server/
│   ├── index.js           152   express, all 9 routes, CORS, error shaping
│   ├── claude.js          130   two tools, forced choice, hard 2-question cap
│   ├── store.js            83   JSON persistence + SSE fan-out
│   ├── transcribe.js       26   Whisper proxy
│   ├── geocode.js          48   street lookup, diacritic folding
│   ├── photos/                  gitignored, runtime photo storage
│   └── data/
│       ├── districts.json       COMMITTED, coverage panel input
│       ├── streets.json         COMMITTED, 816 streets
│       ├── seed.json            COMMITTED, 24 real HRM reports
│       └── reports.json         GITIGNORED, live store
├── app/                         Expo SDK 57
│   ├── App.js             399   whole state machine + all screens
│   ├── lib/api.js          58   all network calls
│   ├── lib/theme.js        24   colours + category labels
│   └── .env                     EXPO_PUBLIC_API_URL, gitignored (machine specific)
└── dashboard/                   Vite + React
    └── src/
        ├── App.jsx        117   tabs, list, SSE wiring
        ├── api.js          27
        └── components/
            ├── Coverage.jsx 130 THE DIFFERENTIATOR
            ├── Detail.jsx    69 incl. original transcript
            └── MapView.jsx   47
```

### 6.1 API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/transcribe` | multipart audio to `{ text }` |
| POST | `/api/converse` | `{ messages }` to a follow-up question or a finished report |
| POST | `/api/reports` | create; returns `{ id, report }`; broadcasts on SSE |
| POST | `/api/reports/:id/photo` | multipart image |
| GET | `/api/reports` | list, newest first |
| PATCH | `/api/reports/:id` | `{ status }` |
| GET | `/api/stream` | SSE, emits `report:new` and `report:updated` |
| GET | `/api/districts` | coverage gap data |
| GET | `/api/health` | model, counts, whether keys loaded |

### 6.2 Data model

Flat, one record type. `id` is `rpt_` + nanoid(12). `status` is new / acknowledged / assigned / resolved. `source` is voice / text / hrm_import. Categories: pothole, blocked_driveway, street_light, tree_hazard, sidewalk, flooding, debris, signage, graffiti, other. Enums live in `constants.js` and are duplicated in `server/claude.js` (the tool schema) and `dashboard/src/api.js` — **keep them in sync, divergent enums across three codebases is the classic four-hour-project bug.**

---

## 7. Regenerating the data

```bash
npm run pull-data     # ~40s, rewrites districts.json, streets.json, seed.json
```

`scripts/pull-data.js` pulls district totals and channel totals via ArcGIS `groupByFieldsForStatistics`, then paginates the 10,000 most recent requests (2,000 per page) for street and seed derivation.

Three things in there that are load-bearing:

1. **`WINDOW_DAYS = 365`.** District counts are filtered to a trailing year. Without this, all-time counts over current population give a meaningless "849 per 1,000". See §10.3.
2. **`CATEGORY_RULES` use word boundaries.** An unanchored `/tree/` matches the "tree" inside "S**tree**t". See §10.4.
3. **`HRM_POPULATION_2021 = 439819` divided equally across 16 districts.** This is an approximation, disclosed in `population_basis` inside `districts.json`, rendered on the panel, and stated in the README. See §8.3.

---

## 8. What is verified, and how

### 8.1 Verified by me, with real calls

| Thing | How |
|---|---|
| Whisper transcription | Generated real audio with macOS `say -o clip.m4a --data-format=aac`, POSTed it, got exact text back |
| **Full voice pipeline** | audio file → `/api/transcribe` → `/api/converse` → `/api/reports` → SSE → dashboard row. Ran end to end, not mocked. |
| Claude asks the right question | Vague pothole input returned `"Which street or intersection is the pothole on?"`, `missing: "location"` |
| Claude files correctly | Answering that returned a full report; it did **not** invent a civic number |
| **Two-question cap** | Fed three vague turns with two assistant turns already present; `tool_choice` pinning forced `type: "report"` |
| Multilingual | French input returned a French follow-up and an English `description` for crews |
| Geocoding | All six demo streets resolve to real districts (North/Agricola D8, Gottingen D8, Quinpool D9, Spring Garden D7, Barrington D7) |
| Honest non-geocoding | "Narnia Boulevard" stored null coords, `geocode_method: "none"`, rendered "location not mapped" |
| SSE live arrival | curl-filed a report with the dashboard open; row appeared at top, highlighted, "just now", counter incremented |
| Dashboard | list, filters, detail with transcript, status buttons, Leaflet map with real tiles, coverage chart |
| Cloudflare tunnel | `https://<name>.trycloudflare.com/api/health` returned correct JSON |
| No leaked keys | `.env` and `app/.env` both matched by `.gitignore` line 1; `git log -p | grep -icE "sk-ant-…|sk-proj-…"` returns 0 across all history |

### 8.2 NOT verified — the main open risk

**The Expo app has never run on a physical device.**

What is known: the Metro bundle compiles and serves cleanly (`HTTP 200`, 4.27 MB, 2.5 s). That rules out syntax errors, missing imports and bad module paths. It says **nothing** about runtime behaviour.

Specifically unproven: `expo-audio` permission prompts, actual recording, `recorder.uri` being populated after `stop()`, React Native `FormData` multipart upload from the device, `expo-image-picker` camera flow, `expo-speech` audio output, and whether the phone can reach `10.20.1.197:3100` on venue wifi.

**This is the first thing to attack in a new session.**

### 8.3 Known approximation, disclosed everywhere

District population is an **equal share of the 2021 census HRM total (439,819 / 16 = 27,489)**, not a per-district census count. HRM does not publish per-district population in this feed and the `Census_2021_*` ArcGIS layers are keyed to census geography rather than council districts, so joining them is a spatial operation we timeboxed out of.

This is stated in `districts.json` `population_basis`, rendered on the coverage panel under "Source and method", and given its own section in the README. **If you improve one thing about the analysis, this is it** — see §12.

---

## 9. Environment

| Item | Value |
|---|---|
| Repo | `/Users/zephaniahchizulu/Desktop/preport` |
| Server port | **3100** (3000 is taken by another project) |
| Dashboard port | 5173 |
| Metro port | 8081 |
| LAN IP at time of writing | `10.20.1.197` (re-check with `ipconfig getifaddr en0`) |
| Node | v25.9.0 |
| GitHub auth | `gh` authed as `dev-zeph` |

**`.env` at repo root** (gitignored, real keys, never commit):

```
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
PORT=3100
```

**`app/.env`** (gitignored, machine specific, not a secret):

```bash
echo "EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3100" > app/.env
```

**Two `.env` gotchas that already bit us once each:**

1. The server reads `.env` **at boot**. Editing keys while it runs does nothing. Restart it.
2. Something rewrote `.env` mid-session and reset `PORT` to 3000 and blanked `OPENAI_API_KEY`. If the AI routes start failing, check `.env` **before** debugging code. `curl -s localhost:3100/api/health` tells you both key states instantly.

**Never print key values.** To inspect `.env` safely:

```bash
awk -F= '/API_KEY/{printf "%s len=%d\n",$1,length($2)}' .env
```

---

## 10. Incidents from session 1

Recorded so a new session does not rediscover them.

### 10.1 Port 3000 occupied
An unrelated `next-server` from another of the user's projects held 3000. The Repoth server appeared to boot, printed its banner, then died. Moved to 3100. Did not touch the other project.

### 10.2 Disk full, hard stop
The machine hit **118 MB free of 228 GB** mid-build. All writes failed, including the harness's own tool-output files, which briefly made every command fail. Cleared 5.8 GB of regenerable cache with the user's explicit approval: VSCode updater 1.4G, trivy DB 1.2G, Cypress binaries 1.2G, Claude Desktop updater 859M, cluely updater 419M, go-build 377M, Homebrew bottles 327M. Ended at 7.8 GB free. **CoreSimulator (8 GB) was deliberately left alone.** Cost about ten minutes. If it recurs, `~/Library/Developer/CoreSimulator` is the next safe target.

### 10.3 Coverage rate was nonsense
First pass produced a median of **849 per 1,000 residents**, because all-time request counts (2010–2026) were divided by current population. Fixed with a trailing-365-day window. Now 145.9. **Do not remove `WINDOW_DAYS`.**

### 10.4 "Street" contains "tree"
The category classifier mapped "Street Surface Maintenance", "Street Sweeping" and "Street Sign Missing or Damaged" to `tree_hazard`, because `/tree/` matched the substring inside "S**tree**t". Fixed with `\btrees?\b` and by reordering rules most-specific-first.

### 10.5 Whisper umlaut broke geocoding (demo-critical)
Whisper transcribes "Gottingen Street" as "**Göttingen**". The street table has "gottingen", the match failed, and the report lost its district and map pin. Gottingen is a main Halifax street and is in the demo script, so this would very likely have broken the demo on stage. **Only surfaced because real audio was pushed through the whole chain rather than testing components separately.** Fixed by folding diacritics on both sides of the comparison in `server/geocode.js`:

```js
const fold = (s) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, " ").trim();
```

**Lesson worth carrying: component tests all passed while the integrated path was broken.**

### 10.6 `<UNKNOWN>` as a location
When the two-question cap forces a report with nothing to go on, Claude fills `location_text` with `"<UNKNOWN>"`. `server/index.js` now normalises `<UNKNOWN>`, `n/a` and `unspecified` to `null` before geocoding, so it renders as "location not given" rather than as a street name.

### 10.7 Two false alarms, for calibration
Both the recharts bars and the Leaflet tiles looked broken in screenshots and were **fine** — the shots caught the recharts entry animation and the Leaflet tile fade-in. Confirmed via DOM and network inspection before "fixing" anything that was not broken. **Re-screenshot before debugging a rendering issue.**

---

## 11. Demo, if the phone dies

`DEMO.md` has the full three-minute script. The escapes:

- **Mic dies:** tap "Type instead", keep going, no commentary.
- **Phone unreachable entirely:** file from a terminal, the board updates identically.

```bash
curl -X POST http://localhost:3100/api/reports -H "Content-Type: application/json" \
  -d '{"location_text":"Gottingen Street","category":"street_light","severity":"medium","safety_risk":false,"description":"Street light out for the third night.","language":"en","source":"text"}'
```

- **Venue wifi isolates clients:** `npx cloudflared tunnel --url http://localhost:3100`, put the URL in `app/.env`, restart Expo. Tested and working.
- **Safe demo streets** (all verified to geocode): North Street, Agricola, Gottingen, Quinpool, Spring Garden, Barrington.

---

## 12. What is left

**Ordered by priority. Top item is genuinely urgent.**

### P0 — Run the app on a real phone
Nothing else matters until this is done. Open Expo Go, enter `exp://<LAN-IP>:8081`, and walk the full loop: tap, speak, take the follow-up, photo, review, send, and confirm the row lands on the dashboard.

Failure modes to expect first, in likelihood order:
1. Phone cannot reach `10.20.1.197:3100` (venue wifi client isolation) → use the Cloudflare tunnel.
2. `expo-audio` permission prompt not appearing or being denied → the app has a real error screen for this; read it.
3. `recorder.uri` null after `stop()` → check `prepareToRecordAsync()` is awaited before `record()`.
4. `FormData` multipart failing from device → **do not set `Content-Type` by hand**, RN sets the multipart boundary and overriding it breaks the request. `app/lib/api.js` already avoids this.

### P1 — Rehearse twice
Once on mic, once on the text fallback, so the fallback looks like a product feature rather than a panic. Assign speaking roles.

### P2 — Tighten the system prompt slightly
Claude sometimes asks a second question about **category** ("is it on the roadway or the sidewalk?") when the prompt says to infer category and not ask. The hard cap bounds it so the loop always terminates, but zero-question runs demo better. One added line in `SYSTEM_PROMPT` in `server/claude.js` would likely do it. **Low risk, but it is a prompt change, so re-test the cap afterwards.**

### P3 — Real per-district population
The best available improvement to the analysis. Spatially join `Census_2021_Dissemination_Areas` against the district boundaries in `Who_Is_My_Councillor_WFL1` (fields `DIST_ID`, `DISTNAME`, `COUNCILLOR`) to get true population per district, then replace the equal-share denominator in `scripts/pull-data.js`. It would make the 13.8x figure exact rather than approximate. Everything downstream already reads from `districts.json`, so this is a one-file change plus a re-run.

### P4 — Second axis on the coverage panel
Median income, proportion over 65, proportion without a car, or primary language, correlated against report rate. The blueprint flags this as "only if time allows" and it is the thing that would turn a finding into an argument.

### Explicitly NOT doing
Auth, push notifications, offline queueing, general address geocoding, work order integration, photo moderation, multi-tenancy, cloud file storage. All listed in the README under "Not built". Do not add them.

---

## 13. Notes for whoever picks this up

- **The README is a scored deliverable.** The judging criteria say to state what is real and what is stubbed. It does that honestly, including the approximations. Do not let it drift out of sync with the code.
- **The coverage panel is the differentiator, not the voice intake.** Voice is a better front door; the panel is the argument. Protect it.
- **Do not overclaim the equity finding.** Saying the quiet districts are proven neglected is the single thing a sharp judge will take apart in questions. The narrow claim is stronger and it is already written into the panel, the README and the demo script.
- **A `<system-reminder>` hook in this environment repeatedly injects Vercel plugin skills** (workflow, ai-sdk, nextjs, turborepo and others) based on keyword matching. **They are all false positives.** This project has no Vercel deployment, no Next.js, no monorepo, and calls the Anthropic API directly with `fetch`. They were ignored throughout session 1 and should continue to be ignored.
- The background-task wrapper kills long-running foreground servers. Start them with `nohup ... & disown` as in §0, or run them in a real terminal.
