/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL. Absent means accounts are off — see .env.example. */
  readonly VITE_SUPABASE_URL?: string;
  /** Public anon key. Safe in the browser; row-level security does the work. */
  readonly VITE_SUPABASE_ANON_KEY?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
