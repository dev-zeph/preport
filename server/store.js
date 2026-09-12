// Reports persistence + SSE fan-out.
//
// Supabase is the source of truth so the board survives this laptop closing and
// anyone can read it without the server running. But the process keeps an
// in-memory copy and writes through to it, for two reasons:
//
//   1. list() and get() stay synchronous, so the routes and the SSE fan-out did
//      not have to be rewritten around a network call.
//   2. If Supabase is unreachable mid-demo, reports still file, still appear on
//      the board over SSE, and still persist to disk. A dropped network should
//      cost you durability, not the demo.
//
// The local JSON file is now a backup and a cold-start fallback, not the store.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

import { supabase, enabled as supabaseEnabled } from "./supabase.js";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "data");
const LIVE = join(DATA, "reports.json");
const SEED = join(DATA, "seed.json");

const TABLE = "reports";

const readJson = (p, fallback) => {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
  } catch (e) {
    console.error(`store: could not read ${p}: ${e.message}`);
    return fallback;
  }
};

// First boot with no reports.json falls back to the committed seed, so a fresh
// clone with no Supabase still has a populated board.
let reports = readJson(LIVE, null) ?? readJson(SEED, []);
let live = false;

const persist = () => {
  try {
    writeFileSync(LIVE, JSON.stringify(reports, null, 2));
  } catch (e) {
    console.error(`store: could not persist: ${e.message}`);
  }
};

/** Pull the board from Supabase at boot. Falls back to whatever is on disk. */
export async function hydrate() {
  if (!supabaseEnabled) return;
  try {
    const { data, error } = await supabase
      .from(TABLE)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw new Error(error.message);
    live = true;

    // An empty table with a populated local store almost always means the
    // migration has not been run yet, not that the board is genuinely empty.
    // Adopting the empty result here would overwrite reports.json and destroy
    // the only copy, so it is refused.
    if (!data?.length && reports.length) {
      console.log(
        `store: supabase reachable but empty, keeping ${reports.length} local reports. ` +
        `Run "npm run migrate" to push them up.`
      );
      return;
    }

    reports = data ?? [];
    persist();
    console.log(`store: hydrated ${reports.length} reports from supabase`);
  } catch (e) {
    console.error(`store: supabase unreachable (${e.message}), using local ${reports.length} reports`);
  }
}

export const isLive = () => live;

// ---- SSE ---------------------------------------------------------------
const clients = new Set();

export function addClient(res) {
  clients.add(res);
  return () => clients.delete(res);
}

export function broadcast(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const c of clients) {
    try {
      c.write(payload);
    } catch {
      clients.delete(c);
    }
  }
}

export const clientCount = () => clients.size;

// ---- CRUD --------------------------------------------------------------
export const list = () =>
  [...reports].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));

export const get = (id) => reports.find((r) => r.id === id) ?? null;

const TRAIL_EVENT = {
  new: "Reported by a resident",
  acknowledged: "Acknowledged by Public Works",
  assigned: "Crew assigned",
  resolved: "Marked resolved",
};

export async function create(fields) {
  const created_at = new Date().toISOString();
  const report = {
    id: `rpt_${nanoid(12)}`,
    created_at,
    status: "new",
    landmark: null,
    photo: null,
    transcript: [],
    ...fields,
    // The trail records only what we actually observed. Nothing is backdated.
    trail: [{
      at: created_at,
      what: fields.source === "text" ? "Reported by a resident, typed" : "Reported by a resident, by voice",
    }],
  };

  // Local first, so a Supabase outage cannot swallow a report mid-demo.
  reports.push(report);
  persist();
  broadcast("report:new", report);

  if (supabaseEnabled) {
    const { error } = await supabase.from(TABLE).insert(report);
    if (error) console.error(`store: supabase insert failed for ${report.id}: ${error.message}`);
  }
  return report;
}

export async function update(id, patch) {
  const r = get(id);
  if (!r) return null;

  // A status change is an event, so record it rather than only overwriting the
  // current value. The panel reads this back as the report's history.
  if (patch.status && patch.status !== r.status) {
    patch = {
      ...patch,
      trail: [...(r.trail ?? []), {
        at: new Date().toISOString(),
        what: TRAIL_EVENT[patch.status] ?? `Status set to ${patch.status}`,
      }],
    };
  }
  Object.assign(r, patch);
  persist();
  broadcast("report:updated", r);

  if (supabaseEnabled) {
    const { error } = await supabase.from(TABLE).update(patch).eq("id", id);
    if (error) console.error(`store: supabase update failed for ${id}: ${error.message}`);
  }
  return r;
}
