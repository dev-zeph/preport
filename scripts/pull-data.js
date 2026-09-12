#!/usr/bin/env node
/**
 * One-shot pull from HRM's live ArcGIS feed.
 * Writes server/data/{districts,streets,seed}.json — all committed to the repo.
 *
 * Source: Cityworks_Service_Requests, HRM Data Mapping and Analytics Hub.
 * Run:  node scripts/pull-data.js
 */
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA = join(__dirname, "..", "server", "data");
const BASE =
  "https://services2.arcgis.com/11XBiaBYA9Ep0yNJ/arcgis/rest/services/Cityworks_Service_Requests/FeatureServer/0/query";

// HRM total population, 2021 Census of Canada.
const HRM_POPULATION_2021 = 439819;
const DISTRICT_COUNT = 16;
// Rate window. All-time counts divided by current population give a
// meaningless "849 per 1,000"; a trailing year gives an annual rate.
const WINDOW_DAYS = 365;
const windowStart = new Date(Date.now() - WINDOW_DAYS * 864e5);
const sqlWindow = `DATE_INITIATED >= TIMESTAMP '${windowStart.toISOString().slice(0, 10)} 00:00:00'`;

async function q(params) {
  const u = new URL(BASE);
  for (const [k, v] of Object.entries({ f: "json", ...params })) u.searchParams.set(k, v);
  const r = await fetch(u, { headers: { "User-Agent": "repoth-hackathon/1.0" } });
  if (!r.ok) throw new Error(`ArcGIS ${r.status} ${await r.text()}`);
  const j = await r.json();
  if (j.error) throw new Error(JSON.stringify(j.error));
  return j.features ?? [];
}

const countBy = (field, where = "1=1") =>
  q({
    where,
    groupByFieldsForStatistics: field,
    outStatistics: JSON.stringify([
      { statisticType: "count", onStatisticField: "REQUEST_ID", outStatisticFieldName: "n" },
    ]),
  });

/** Pull the most recent `want` requests, paginated. */
async function recent(want) {
  const out = [];
  const page = 2000;
  for (let off = 0; off < want; off += page) {
    const f = await q({
      where: "LATITUDE IS NOT NULL AND ADDRESS IS NOT NULL AND DISTRICT IS NOT NULL",
      outFields: "REQUEST_ID,DATE_INITIATED,DESCRIPTION,ADDRESS,DISTRICT,LATITUDE,LONGITUDE,STATUS,PRIORITY,INITIATED_BY",
      orderByFields: "DATE_INITIATED DESC",
      resultOffset: off,
      resultRecordCount: page,
    });
    if (!f.length) break;
    out.push(...f.map((x) => x.attributes));
    process.stdout.write(`\r  pulled ${out.length}`);
  }
  console.log();
  return out;
}

/** "6097 LEEDS ST,  HALIFAX,  B3K 2T8" -> "leeds st"   |   "CORK ST & OXFORD ST, HALIFAX" -> "cork st" */
function streetOf(address) {
  if (!address) return null;
  let s = address.split(",")[0].trim().toLowerCase();
  s = s.split("&")[0].trim();          // intersections -> first street
  s = s.replace(/^\d+[a-z]?\s+/, "");  // strip civic number
  s = s.replace(/\s+/g, " ").trim();
  return s.length >= 4 && /[a-z]/.test(s) ? s : null;
}

const median = (a) => {
  const s = [...a].sort((x, y) => x - y);
  return s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2;
};
const mode = (a) => [...a.reduce((m, v) => m.set(v, (m.get(v) ?? 0) + 1), new Map())]
  .sort((x, y) => y[1] - x[1])[0][0];

/** HRM's internal work-type text -> our resident-facing category enum. */
const CATEGORY_RULES = [
  // Ordered most-specific first. Word boundaries matter: an unanchored /tree/
  // matches the "tree" inside "Street".
  [/graffiti|vandal/i, "graffiti"],
  [/\bsign(age|s)?\b|pavement marking|street sign/i, "signage"],
  [/illegally parked|\bparking\b|obstruction|blocked|driveway/i, "blocked_driveway"],
  [/\blight(s|ing)?\b|luminaire|traffic signal/i, "street_light"],
  [/\btrees?\b|\bbranch|\blimb\b|stump|landscaping|\bgrass\b|\bhedge/i, "tree_hazard"],
  [/sidewalk|walking surface|\bcurb\b|crosswalk|accessib/i, "sidewalk"],
  [/flood|drain|catch ?basin|storm ?water|\bsewer\b/i, "flooding"],
  // "Homeless Encampment" is deliberately NOT mapped to debris. It is a
  // person's shelter, not litter, and it is not a resident-reportable
  // infrastructure fault. It falls through to "other".
  [/litter|debris|garbage|deceased animal|dumping|\bwaste\b|\bglass\b|sweeping/i, "debris"],
  [/pothole|street surface|road surface|pavement|road shoulder|road repair|street repair/i, "pothole"],
];

const toCategory = (text) =>
  CATEGORY_RULES.find(([re]) => re.test(text ?? ""))?.[1] ?? "other";

const SEVERITY_BY_PRIORITY = { EMERGENCY: "high", HIGH: "high", MEDIUM: "medium", LOW: "low" };

async function main() {
  mkdirSync(DATA, { recursive: true });

  console.log("1/4  district + channel totals");
  const [byDistrict, byChannel, byDistrictAll] = await Promise.all([
    countBy("DISTRICT", sqlWindow),
    countBy("INITIATED_BY"),
    countBy("DISTRICT"),
  ]);
  const allTime = new Map(
    byDistrictAll.map((f) => [String(f.attributes.DISTRICT), f.attributes.n])
  );

  console.log("2/4  recent requests");
  const rows = await recent(20000);

  // ---- districts.json -------------------------------------------------
  // Council districts are drawn to near population parity by electoral
  // boundary law, so we use an equal share of the 2021 census population as
  // the denominator. This is an approximation and is disclosed in the UI.
  const perDistrictPop = Math.round(HRM_POPULATION_2021 / DISTRICT_COUNT);
  const districts = byDistrict
    .map((f) => f.attributes)
    .filter((a) => a.DISTRICT != null)
    .map((a) => ({
      district: `District ${a.DISTRICT}`,
      district_id: Number(a.DISTRICT),
      population: perDistrictPop,
      reports: a.n,
      reports_all_time: allTime.get(String(a.DISTRICT)) ?? null,
      per_1000: +((a.n / perDistrictPop) * 1000).toFixed(1),
    }))
    .sort((a, b) => a.district_id - b.district_id);

  const med = median(districts.map((d) => d.per_1000));
  for (const d of districts) {
    d.vs_median = +(d.per_1000 / med).toFixed(2);
    d.gap = d.vs_median >= 1.15 ? "above" : d.vs_median <= 0.85 ? "below" : "near";
  }

  const channels = byChannel
    .map((f) => f.attributes)
    .filter((a) => a.INITIATED_BY)
    .map((a) => ({ channel: a.INITIATED_BY, n: a.n }))
    .sort((a, b) => b.n - a.n);
  const totalChannel = channels.reduce((s, c) => s + c.n, 0);
  const residentOriginated = channels
    .filter((c) => c.channel !== "INTERNAL")
    .reduce((s, c) => s + c.n, 0);

  const dates = rows.map((r) => r.DATE_INITIATED).filter(Boolean);
  writeFileSync(
    join(DATA, "districts.json"),
    JSON.stringify(
      {
        source: "HRM Cityworks_Service_Requests, live ArcGIS feed",
        source_url: BASE.replace("/query", ""),
        pulled_at: new Date().toISOString(),
        feed_latest_record: new Date(Math.max(...dates)).toISOString(),
        window_days: WINDOW_DAYS,
        window_start: windowStart.toISOString().slice(0, 10),
        total_requests_in_window: districts.reduce((s, d) => s + d.reports, 0),
        total_requests_all_time: [...allTime.values()].reduce((s, n) => s + n, 0),
        population_basis:
          `2021 census HRM population ${HRM_POPULATION_2021.toLocaleString()} divided equally ` +
          `across ${DISTRICT_COUNT} council districts. Districts are drawn to near population ` +
          `parity, so this approximates per-district population; it is not a per-district census count.`,
        rate_note:
          `per_1000 is requests per 1,000 residents over the trailing ${WINDOW_DAYS} days.`,
        median_per_1000: +med.toFixed(1),
        channels,
        resident_originated_share: +((residentOriginated / totalChannel) * 100).toFixed(1),
        districts,
      },
      null,
      2
    )
  );

  // ---- streets.json ---------------------------------------------------
  const byStreet = new Map();
  for (const r of rows) {
    const s = streetOf(r.ADDRESS);
    if (!s || !r.LATITUDE || !r.LONGITUDE) continue;
    if (!byStreet.has(s)) byStreet.set(s, { lat: [], lng: [], dist: [] });
    const e = byStreet.get(s);
    e.lat.push(r.LATITUDE);
    e.lng.push(r.LONGITUDE);
    e.dist.push(r.DISTRICT);
  }
  const streets = [...byStreet.entries()]
    .filter(([, e]) => e.lat.length >= 3)
    .map(([match, e]) => ({
      match,
      lat: +median(e.lat).toFixed(5),
      lng: +median(e.lng).toFixed(5),
      district: `District ${mode(e.dist)}`,
      n: e.lat.length,
    }))
    .filter((s) => s.lat > 44.2 && s.lat < 45.3 && s.lng > -64.5 && s.lng < -62.3)
    .sort((a, b) => b.n - a.n);
  writeFileSync(join(DATA, "streets.json"), JSON.stringify(streets, null, 2));

  // ---- seed.json ------------------------------------------------------
  const seen = new Set();
  const seed = rows
    .filter((r) => {
      const c = toCategory(r.DESCRIPTION);
      if (c === "other" || seen.has(c + r.DISTRICT)) return false;
      seen.add(c + r.DISTRICT);
      return true;
    })
    .slice(0, 24)
    .map((r) => ({
      id: `rpt_hrm_${r.REQUEST_ID}`,
      created_at: new Date(r.DATE_INITIATED).toISOString(),
      status: r.STATUS === "CLOSED" ? "resolved" : "new",
      source: "hrm_import",
      location_text: r.ADDRESS.split(",")[0].trim(),
      landmark: null,
      category: toCategory(r.DESCRIPTION),
      severity: SEVERITY_BY_PRIORITY[String(r.PRIORITY).toUpperCase()] ?? "medium",
      safety_risk: /emergency|hazard|unsafe/i.test(`${r.PRIORITY} ${r.DESCRIPTION}`),
      description: r.DESCRIPTION,
      language: "en",
      district: `District ${r.DISTRICT}`,
      lat: r.LATITUDE,
      lng: r.LONGITUDE,
      geocode_method: "hrm_source",
      transcript: [],
      photo: null,
    }));
  writeFileSync(join(DATA, "seed.json"), JSON.stringify(seed, null, 2));

  console.log("3/4  distinct DESCRIPTION values (top 30, for category mapping):");
  const descCount = rows.reduce((m, r) => m.set(r.DESCRIPTION, (m.get(r.DESCRIPTION) ?? 0) + 1), new Map());
  [...descCount].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .forEach(([d, n]) => console.log(`     ${String(n).padStart(6)}  ${d}  ->  ${toCategory(d)}`));

  console.log("\n4/4  done");
  console.log(`   districts.json  ${districts.length} districts, median ${med.toFixed(1)}/1k`);
  console.log(`   streets.json    ${streets.length} streets`);
  console.log(`   seed.json       ${seed.length} reports`);
  console.log(`   resident-originated share: ${((residentOriginated / totalChannel) * 100).toFixed(1)}%`);
}

main().catch((e) => {
  console.error("FAILED:", e.message);
  process.exit(1);
});
