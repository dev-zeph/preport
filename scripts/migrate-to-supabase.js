// One-shot: push the local JSON board into Supabase.
//
// Idempotent. Rows are upserted on the primary key, so running it twice is
// harmless and running it after a few live reports have arrived will not
// duplicate them.
//
// Requires supabase/04_open_access.sql to have been run, otherwise every insert
// comes back as 42501 (row-level security) and this will tell you so.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { supabase, enabled } from "../server/supabase.js";
import { normaliseLanguage } from "../constants.js";

if (!enabled) {
  console.error("SUPABASE_URL / SUPABASE_KEY are not set in .env");
  process.exit(1);
}

const DATA = join(dirname(fileURLToPath(import.meta.url)), "..", "server", "data");
const src = existsSync(join(DATA, "reports.json"))
  ? join(DATA, "reports.json")
  : join(DATA, "seed.json");

const reports = JSON.parse(readFileSync(src, "utf8"));
console.log(`migrating ${reports.length} reports from ${src.split("/").slice(-2).join("/")}`);

// Only send columns the table actually has, so a stray field in an old local
// record cannot fail the whole batch.
const COLUMNS = [
  "id", "created_at", "status", "source", "location_text", "landmark", "district",
  "lat", "lng", "geocode_method", "category", "severity", "safety_risk",
  "description", "language", "transcript", "trail", "photo",
];

const rows = reports.map((r) => {
  const row = Object.fromEntries(COLUMNS.filter((c) => r[c] !== undefined).map((c) => [c, r[c]]));
  // Older rows stored "English" where newer ones store "en".
  if (row.language) row.language = normaliseLanguage(row.language);
  return row;
});

const CHUNK = 200;
let done = 0;
for (let i = 0; i < rows.length; i += CHUNK) {
  const batch = rows.slice(i, i + CHUNK);
  const { error } = await supabase.from("reports").upsert(batch, { onConflict: "id" });
  if (error) {
    console.error(`\nfailed at row ${i}: ${error.message}`);
    if (String(error.message).includes("row-level security") || error.code === "42501") {
      console.error("\nRow-level security is still on. Run supabase/04_open_access.sql first.");
    }
    process.exit(1);
  }
  done += batch.length;
  process.stdout.write(`  upserted ${done}/${rows.length}\r`);
}

const { count, error } = await supabase
  .from("reports")
  .select("id", { count: "exact", head: true });
if (error) {
  console.error(`\nupserted ${done}, but could not read the count back: ${error.message}`);
  process.exit(1);
}
console.log(`\nupserted ${done}. supabase now holds ${count} reports.`);
