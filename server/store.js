// Reports persistence (flat JSON file) + SSE fan-out.
// One process owns the data, so there is no database to stand up.
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { nanoid } from "nanoid";

const DATA = join(dirname(fileURLToPath(import.meta.url)), "data");
const LIVE = join(DATA, "reports.json");
const SEED = join(DATA, "seed.json");

const readJson = (p, fallback) => {
  try {
    return existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : fallback;
  } catch (e) {
    console.error(`store: could not read ${p}: ${e.message}`);
    return fallback;
  }
};

// First boot has no reports.json, so the board starts from the committed seed.
let reports = readJson(LIVE, null) ?? readJson(SEED, []);

const persist = () => {
  try {
    writeFileSync(LIVE, JSON.stringify(reports, null, 2));
  } catch (e) {
    console.error(`store: could not persist: ${e.message}`);
  }
};
persist();

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

export function create(fields) {
  const report = {
    id: `rpt_${nanoid(12)}`,
    created_at: new Date().toISOString(),
    status: "new",
    landmark: null,
    photo: null,
    transcript: [],
    ...fields,
  };
  reports.push(report);
  persist();
  broadcast("report:new", report);
  return report;
}

export function update(id, patch) {
  const r = get(id);
  if (!r) return null;
  Object.assign(r, patch);
  persist();
  broadcast("report:updated", r);
  return r;
}
