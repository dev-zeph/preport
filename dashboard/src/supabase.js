// The dashboard talks to Supabase directly, not through the Express server.
//
// That is the point of moving the board here: Public Works can open this and
// see live reports whether or not the laptop running the AI server is awake.
// The server is still the only writer of new reports, because it is the only
// place that geocodes a location on the way in.
import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_KEY;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;
