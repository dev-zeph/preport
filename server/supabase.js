// Supabase client for the server.
//
// This project deliberately runs with RLS off and no secret key (see
// supabase/04_open_access.sql for the reasoning and the tradeoff). The server
// uses the same publishable key the app and dashboard use. It is the only
// writer not because it has more privilege, but because it is the only place
// that geocodes a location and validates the enums on the way in.
import { createClient } from "@supabase/supabase-js";

//
// The project's own values are the fallback, committed on purpose. This repo is
// public, RLS is off, and the board holds no private data (see
// supabase/04_open_access.sql). The goal is that anyone who clones this can run
// it end to end without being handed a key first, so a missing .env must not be
// the thing that stops them.
//
// The consequence, stated rather than discovered: anyone reading this repo can
// write to that board. That is the accepted tradeoff, not an oversight.
// Set VITE_SUPABASE_URL / VITE_SUPABASE_KEY (or SUPABASE_URL / SUPABASE_KEY on
// the server) to point at your own project instead.
const PUBLIC_URL = "https://tfftfummozlowcazckts.supabase.co";
const PUBLIC_KEY = "sb_publishable_-FTlo-pt7IN8SbW5G3JjEA_B3_jjUcT";

const url = process.env.SUPABASE_URL || PUBLIC_URL;
const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY || PUBLIC_KEY;

export const enabled = Boolean(url && key);

export const supabase = enabled
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

if (!enabled) {
  console.log("supabase: not configured, falling back to the local JSON store");
}

export const PHOTO_BUCKET = "report-photos";
