# Demo run sheet

Three minutes. Open on the problem, close on the honesty.

## Before you start

| Check | Command | Expect |
|---|---|---|
| Server up | `curl -s localhost:3100/api/health` | `openai_key: true` and `anthropic_key: true` |
| Dashboard | http://localhost:5173 | board populated, green "Live" dot |
| Phone | Expo Go on `exp://<LAN-IP>:8081` | idle screen, blue orb |

If `openai_key` is false, voice transcription will fail. Use the text fallback
and say nothing about it.

## Script

**0:00 to 0:25 — the problem.**
Only 12% of Halifax service requests start with a resident. The rest are opened
by staff. Phone reporting does not scale and web forms exclude people. The city
fixes what it hears about.

**0:25 to 1:20 — file a report.** Phone on screen. Tap, speak, take the
follow-up question, snap the photo, send. *Say nothing while it works.*

Use a street that is in the lookup table. Safe ones, verified:
North Street, Agricola, Gottingen, Quinpool, Spring Garden, Barrington.

**1:20 to 1:50 — cut to the dashboard.** The report is already there. Open it:
photo, pin, structured fields, and the original transcript underneath. That
transcript is the honesty feature. Staff can check what the resident actually
said when the summary looks wrong.

**1:50 to 2:35 — the coverage gap panel.** This is what the intake channel is
for. 13.8x between District 2 and District 8, on districts drawn to equal
population. Name the quiet districts. **State the limits before anyone asks:**
low reports per capita is not proof of unmet need. The claim is that these
districts are quiet, the city's response follows the record, and nobody has
checked whether the quiet is real.

**2:35 to 3:00 — what's real, what's stubbed.** Real: voice, Claude, live
board, and the coverage numbers, which come from HRM's live feed, current to
last week. Stubbed: geocoding is a lookup over 816 streets, photos are on
local disk. Approximated: district population is an equal share of the census
total, and that is stated on the panel.

## If it breaks

- **Mic dies:** tap "Type instead" and keep going. No commentary.
- **Phone unreachable:** file from a terminal, the board updates identically.
  ```bash
  curl -X POST http://localhost:3100/api/reports -H "Content-Type: application/json" \
    -d '{"location_text":"Gottingen Street","category":"street_light","severity":"medium","safety_risk":false,"description":"Street light out for the third night.","language":"en","source":"text"}'
  ```
- **Venue wifi isolates devices:** `npx cloudflared tunnel --url http://localhost:3100`,
  then put that URL in `app/.env` and restart Expo.

## Questions you should expect

**"Isn't low reporting just fewer problems?"** Yes, possibly. That is exactly
why we do not claim it proves neglect. What we claim is that nobody has checked.

**"Where did the population numbers come from?"** An equal share of the 2021
census HRM total, because districts are drawn to near parity and HRM does not
publish per-district population in this feed. It is on the panel.

**"Is the data current?"** The published 311 extract ends December 2024. The
operational Cityworks feed we used is current to September 2026.
