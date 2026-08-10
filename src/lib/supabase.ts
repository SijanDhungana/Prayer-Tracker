import type { SupabaseClient } from "@supabase/supabase-js";

// Optional chaining because `import.meta.env` only exists under Vite — this
// module is also imported by node-side checks, where it must not throw.
export const SUPABASE_URL = import.meta.env?.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env?.VITE_SUPABASE_ANON_KEY ?? "";

/**
 * Whether accounts are switched on for this deployment.
 *
 * When false the site behaves exactly as it did before accounts existed:
 * everyone browses as a guest and the prayer times, which come from a static
 * JSON file, are unaffected. A backend that is missing or down must never take
 * the times down with it.
 */
export const authConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);

let clientPromise: Promise<SupabaseClient> | null = null;

/**
 * Loads the Supabase SDK on demand.
 *
 * It is ~60 kB gzipped — more than the rest of the app — and nothing about
 * reading prayer times needs it. Importing it dynamically keeps it out of the
 * initial bundle so the first paint costs a guest nothing.
 */
export function getSupabase(): Promise<SupabaseClient> | null {
  if (!authConfigured) return null;
  clientPromise ??= import("@supabase/supabase-js").then((m) =>
    m.createClient(SUPABASE_URL, SUPABASE_ANON_KEY),
  );
  return clientPromise;
}

export type Role = "user" | "admin";

export interface SuggestionRow {
  id: number;
  masjid_id: string;
  slot: string;
  /** One of these is set, never both — see supabase/003_offset_suggestions.sql. */
  suggested_time: string | null;
  offset_minutes: number | null;
  note: string | null;
  status: "pending" | "approved" | "rejected";
  created_by: string;
  created_at: string;
  reviewed_at: string | null;
  review_note: string | null;
}
