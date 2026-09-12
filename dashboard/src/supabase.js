// The dashboard talks to Supabase directly, not through the Express server.
//
// That is the point of moving the board here: Public Works can open this and
// see live reports whether or not the laptop running the AI server is awake.
// The server is still the only writer of new reports, because it is the only
// place that geocodes a location on the way in.
import { createClient } from "@supabase/supabase-js";

// NOTE for deploys: Vite only exposes variables prefixed VITE_ to client code.
// NEXT_PUBLIC_* is a Next.js convention and is silently dropped here.
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

const url = import.meta.env.VITE_SUPABASE_URL || PUBLIC_URL;
const key = import.meta.env.VITE_SUPABASE_KEY || PUBLIC_KEY;

export const configured = Boolean(url && key);

export const supabase = configured
  ? createClient(url, key, { auth: { persistSession: false } })
  : null;
