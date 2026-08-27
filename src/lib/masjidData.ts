import { useEffect, useState } from "react";
import { masjids as bundledMasjids } from "../data/masjids";
import { readCache, writeCache } from "./offline";
import type { Masjid } from "./types";

/**
 * Where today's directory comes from at runtime.
 *
 * The bundled copy is the floor, never the ceiling. A build carries the
 * directory as it stood the day it was made; this fetches the copy the
 * deployment is serving now, so a packaged app picks up the daily scrape
 * without waiting on an App Store release. Same-origin by default, which is
 * what the web wants; a native build points it at the deployment because its
 * own origin is capacitor:// and has no data of its own.
 */
export const DATA_URL: string =
  import.meta.env?.VITE_DATA_URL ?? "/masjids.json";

const CACHE_KEY = "mt.masjids.v1";

export type DataSource = "bundled" | "cache" | "network";

/**
 * Whether a fetched payload is a directory at all.
 *
 * Nothing about a network response is trustworthy: a captive portal returns a
 * login page with HTTP 200, a misconfigured host returns index.html for every
 * path, and either would parse into something that is not this. Wrong prayer
 * times are the one failure this app must never produce, so a payload has to
 * prove itself field by field before it is allowed to replace times that are
 * known to be good. Anything short of that keeps what we already had.
 */
export function validateMasjids(raw: unknown): Masjid[] | null {
  if (!Array.isArray(raw) || raw.length === 0) return null;

  for (const entry of raw) {
    if (!entry || typeof entry !== "object") return null;
    const m = entry as Partial<Masjid>;

    if (typeof m.id !== "string" || m.id === "") return null;
    if (typeof m.name !== "string" || m.name === "") return null;
    if (typeof m.lat !== "number" || !Number.isFinite(m.lat)) return null;
    if (typeof m.lng !== "number" || !Number.isFinite(m.lng)) return null;
    if (!m.calc || typeof m.calc.method !== "string") return null;
    if (m.calc.madhab !== "hanafi" && m.calc.madhab !== "shafi") return null;
    if (!m.iqamah || typeof m.iqamah !== "object") return null;
  }

  return raw as Masjid[];
}

/** The most recent verification date in a directory, for comparing vintages. */
export function newestVerified(masjids: Masjid[]): string | null {
  let newest: string | null = null;
  for (const m of masjids) {
    const at = m.lastVerified;
    if (typeof at !== "string" || at === "") continue;
    if (newest == null || at > newest) newest = at;
  }
  return newest;
}

/**
 * Whether `candidate` should replace `current`.
 *
 * Only refuses when the candidate is provably the older of the two — a
 * rolled-back deployment serving last month's file to a current app, say.
 * When either side carries no date the candidate is accepted, because an
 * unknown vintage is not evidence of a stale one and refusing on a technicality
 * would strand an app on its bundled copy indefinitely.
 */
export function isNewerOrEqual(candidate: Masjid[], current: Masjid[]): boolean {
  const a = newestVerified(candidate);
  const b = newestVerified(current);
  if (a == null || b == null) return true;
  return a >= b;
}

/**
 * The directory to render, freshest trustworthy copy first.
 *
 * Starts from the last good fetch when there is one and the bundled copy
 * otherwise, so the first paint never waits on the network, then upgrades in
 * place if the deployment is serving something newer. Every failure path ends
 * with times still on screen.
 */
export function useMasjidData(): {
  masjids: Masjid[];
  source: DataSource;
  /** When the rendered copy was fetched; null for the bundled one. */
  fetchedAt: number | null;
} {
  const [state, setState] = useState<{
    masjids: Masjid[];
    source: DataSource;
    fetchedAt: number | null;
  }>(() => {
    const cached = readCache<Masjid[]>(CACHE_KEY);
    const valid = cached && validateMasjids(cached.data);
    // A cache written by an older build can fail today's validation; falling
    // back rather than trusting it is the whole point of re-validating here.
    return valid && isNewerOrEqual(valid, bundledMasjids)
      ? { masjids: valid, source: "cache", fetchedAt: cached.at }
      : { masjids: bundledMasjids, source: "bundled", fetchedAt: null };
  });

  useEffect(() => {
    const controller = new AbortController();

    fetch(DATA_URL, { signal: controller.signal, cache: "no-cache" })
      .then((r) => (r.ok ? r.json() : null))
      .then((raw) => {
        const fetched = validateMasjids(raw);
        if (!fetched) return;

        setState((current) => {
          // Only cache what is good enough to render. Writing first meant a
          // rolled-back deployment's payload was rejected on screen but still
          // stored, leaving the next cold start to re-reject it — caching a
          // copy we had already decided not to trust.
          if (!isNewerOrEqual(fetched, current.masjids)) return current;
          writeCache(fetched, CACHE_KEY);
          return { masjids: fetched, source: "network", fetchedAt: Date.now() };
        });
      })
      // Offline, blocked, or serving nonsense: the copy already on screen stands.
      .catch(() => {});

    return () => controller.abort();
  }, []);

  return state;
}
