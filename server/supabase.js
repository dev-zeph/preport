// Supabase client for the server.
//
// This project deliberately runs with RLS off and no secret key (see
// supabase/04_open_access.sql for the reasoning and the tradeoff). The server
// uses the same publishable key the app and dashboard use. It is the only
// writer not because it has more privilege, but because it is the only place
// that geocodes a location and validates the enums on the way in.
import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_KEY;

export const enabled = Boolean(url && key);

export const supabase = enabled
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;

if (!enabled) {
  console.log("supabase: not configured, falling back to the local JSON store");
}

export const PHOTO_BUCKET = "report-photos";
