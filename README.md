# Repoth

Voice-first municipal incident reporting for the Halifax Regional Municipality.

Built for the Claude Community Impact Lab Halifax, 12 September 2026, against
Problem 1, "Reporting What's Wrong".

A resident taps one button and says what is wrong. Claude asks at most two
clarifying questions, then files a structured report. It appears on a Public
Works board in real time. A separate panel shows which districts under-report
relative to population, which is the part that answers the question the brief
actually asks: who is the city not hearing from.

## The finding

Across HRM's own service request record, over the trailing 12 months:

- **13.8x** spread between the quietest and loudest council district.
  District 2 logs 21.6 requests per 1,000 residents; District 8 logs 298.
- Council districts are drawn to near population parity, so that gap is not
  explained by district size.
- **12.1%** of all service requests begin with a resident rather than city
  staff. The other 87.9% are opened internally.

Low reports per capita is **not** proof of unmet need. It could mean fewer
problems, or different problems, or a district that phones instead of clicking.
The defensible claim is narrower: these districts are quiet in the record, the
city's response follows the record, and nobody has checked whether the quiet is
real.

## What's real

- Voice capture on device, transcription, and the Claude clarification loop run
  live against real APIs. Nothing is scripted.
- Claude is given exactly two tools, `ask_follow_up` and `file_report`, with
  `tool_choice: "any"`, so every turn is a structured tool call rather than
  parsed free text.
- The two-question limit is enforced **in code**, not only in the prompt. After
  two assistant turns the server pins `tool_choice` to `file_report`.
- Reports are stored server side and pushed to the dashboard over SSE. The row
  appears while the resident is still talking.
- Photos are captured on device and attached to the report.
- Status changes on the dashboard broadcast back to every connected client.
- The resident may speak any language. Follow-up questions come back in their
  language; the description written for city crews is in English.

## What's real data, not invented

This is the part most likely to be assumed fake, so it is worth being precise.

- **Coverage gap analysis** is aggregated from HRM's live
  `Cityworks_Service_Requests` ArcGIS feed: 477343 records, latest
  2026-09-05. Window 2025-09-12 to 2026-09-05.
- **Geocoding** uses 816 Halifax streets whose coordinates are the median of
  every real service request logged on that street, with the district taken as
  the modal district for that street. Not hand-typed.
- **Seed reports** on the board are real recent HRM service requests mapped into
  our schema, labelled `HRM data` in the UI and `source: "hrm_import"` in the
  record. They are not synthetic.

Regenerate all three with `npm run pull-data`.

### A correction to the brief

The brief states that HRM 311 data ends December 2024. That is true of the
widely published 311 extract. The operational Cityworks feed used here is
current to **2026-09-05**. Both facts are disclosed on the coverage panel.

## What's approximated

- **District population.** HRM does not publish population per council district
  in the feed, and the census layers are keyed to census geography rather than
  council districts. We divide the 2021 census HRM population (439,819) equally
  across the 16 districts. Districts are legislated to near population parity,
  so this approximates the denominator, but it is not a per-district census
  count. Stated on the panel itself, not buried here.

## What's stubbed

- **Geocoding is a lookup, not general address resolution.** A location that
  does not match a known street is stored with null coordinates and shown as
  "location not mapped". It is never guessed and never dropped.
- **Photos are stored on the server filesystem**, not cloud storage.
- **No database.** Reports live in a JSON file owned by the server process.

## Not built

Auth and user accounts, push notifications, offline queueing, work order
integration, photo moderation, multi-tenancy, cloud file storage.

## Known rough edges

- Claude occasionally asks a second question about category when the prompt asks
  it to infer category. The hard two-question cap bounds this, so the loop still
  terminates, but the prompt could be tightened.
- `language` comes back as a human-readable name ("English", "French") rather
  than an ISO code.

## Run it

Needs Node 20+. Four commands.

```bash
git clone https://github.com/dev-zeph/preport.git && cd preport
npm install && npm --prefix dashboard install && npm --prefix app install
cp .env.example .env        # then paste your two API keys into it
npm run dev                 # server on :3100
```

Then, in two more terminals:

```bash
npm run dashboard           # http://localhost:5173
npm run app                 # Expo Go, scan the QR code
```

Set `app/.env` to your machine's LAN IP so the phone can reach the server:

```bash
echo "EXPO_PUBLIC_API_URL=http://$(ipconfig getifaddr en0):3100" > app/.env
```

If the venue wifi isolates clients, tunnel instead and point `app/.env` at the
public URL:

```bash
npx cloudflared tunnel --url http://localhost:3100
```

### Filing a report without the phone

The whole pipeline is reachable over HTTP, which is also the fallback if a
device is unreachable during a demo:

```bash
curl -X POST http://localhost:3100/api/reports -H "Content-Type: application/json" \
  -d '{"location_text":"North Street near Agricola","category":"pothole","severity":"high","safety_risk":true,"description":"Deep pothole in the eastbound lane.","language":"en","source":"text"}'
```

## Architecture

```
  Expo app (phone)
        |  HTTPS/HTTP over LAN
        v
  Node + Express  -->  OpenAI Whisper   (transcription)
  (holds all keys) -->  Anthropic API    (clarify + extract)
        |
        +-- JSON file        (reports)
        +-- SSE stream  -->  React dashboard
```

One server, three jobs: proxy the AI calls, own the data, push updates. The
server exists because this repo is public and API keys cannot ship inside a
mobile bundle. Given it has to exist, putting the data layer in it costs
almost nothing and removes a signup and a network dependency.

## API

| Method | Route | Purpose |
|---|---|---|
| POST | `/api/transcribe` | multipart audio to `{ text }` |
| POST | `/api/converse` | `{ messages }` to a follow-up question or a finished report |
| POST | `/api/reports` | create; returns `{ id }`; broadcasts on SSE |
| POST | `/api/reports/:id/photo` | multipart image |
| GET | `/api/reports` | list, newest first |
| PATCH | `/api/reports/:id` | `{ status }` |
| GET | `/api/stream` | SSE, emits `report:new` and `report:updated` |
| GET | `/api/districts` | coverage gap data |
| GET | `/api/health` | model, counts, whether keys are loaded |

## Data sources

- HRM `Cityworks_Service_Requests`, Halifax Data Mapping and Analytics Hub
  (ArcGIS FeatureServer, public, no key).
- Statistics Canada 2021 Census, HRM population.
- OpenStreetMap tiles, © OpenStreetMap contributors.

## Licence

MIT.
