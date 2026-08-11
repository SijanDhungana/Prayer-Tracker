/**
 * Last-known-good times when the network is gone — design spec v2 §10.7.
 *
 * The masjid data is bundled with the app, so "offline" here does not mean
 * losing the times; it means losing the *approved corrections* that are
 * fetched from Supabase at boot. Caching those keeps a correction that landed
 * yesterday visible today on a train with no signal, rather than silently
 * reverting to the scraper's baseline.
 *
 * A stale read is announced rather than passed off as live (§10.7): the
 * caller shows "Showing times from 9:14 AM".
 */
const KEY = "mt.cache.v1";

export interface Cached<T> {
  at: number;
  data: T;
}

export function readCache<T>(): Cached<T> | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    return typeof parsed?.at === "number" ? parsed : null;
  } catch {
    return null;
  }
}

export function writeCache<T>(data: T): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify({ at: Date.now(), data }));
  } catch {
    // Quota or private mode — the app works, it just won't remember.
  }
}
