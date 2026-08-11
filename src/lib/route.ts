import { useEffect, useState } from "react";
import { PRAYERS, type Prayer } from "./types";

/**
 * Minimal hash routing. The app is a static bundle with no server to rewrite
 * paths, and hash URLs keep the phone's back button and shareable links
 * working without pulling in a router.
 *
 * Five destinations (design spec v2 §3) and nothing else gets a tab. The
 * screens that used to be tabs are absorbed rather than deleted: the masjid
 * list is the map's results sheet, Compare is Next up's prayer selector, and
 * Suggestions lives inside Settings.
 */
export type Route =
  | { name: "next"; prayer: Prayer | null }
  | { name: "map"; masjidId: string | null }
  | { name: "plan" }
  | { name: "jummah" }
  | { name: "settings" }
  | { name: "suggestions" }
  | { name: "signin" };

export const nextPath = "#/";
export const mapPath = "#/map";
export const planPath = "#/plan";
export const jummahPath = "#/jummah";
export const settingsPath = "#/settings";
export const suggestionsPath = "#/settings/suggestions";
export const signInPath = "#/signin";

export const masjidPath = (id: string) => `#/map/${encodeURIComponent(id)}`;
export const prayerPath = (prayer: Prayer) => `#/?prayer=${prayer}`;

const isPrayer = (value: string | null): value is Prayer =>
  value != null && (PRAYERS as readonly string[]).includes(value);

/**
 * Old links must keep working (§3). Returns the hash to replace the current
 * one with, or null when nothing needs redirecting.
 */
export function redirectFor(hash: string): string | null {
  const [path] = hash.replace(/^#/, "").split("?");

  if (/^\/masjids\/?$/.test(path)) return mapPath;
  if (/^\/compare\/?$/.test(path)) return nextPath;

  const compare = /^\/compare\/([a-z]+)\/?$/.exec(path);
  if (compare) return isPrayer(compare[1]) ? prayerPath(compare[1]) : nextPath;

  // The detail screen moved under the map, which now owns masjid records.
  const masjid = /^\/masjid\/(.+)$/.exec(path);
  if (masjid) return `#/map/${masjid[1]}`;

  if (/^\/suggestions\/?$/.test(path)) return suggestionsPath;
  if (/^\/admin\/suggestions\/?$/.test(path)) return suggestionsPath;

  return null;
}

export function parseRoute(hash: string): Route {
  const [rawPath, rawQuery] = hash.replace(/^#/, "").split("?");
  const path = rawPath || "/";
  const query = new URLSearchParams(rawQuery ?? "");

  if (/^\/plan\/?$/.test(path)) return { name: "plan" };
  if (/^\/jummah\/?$/.test(path)) return { name: "jummah" };
  if (/^\/signin\/?$/.test(path)) return { name: "signin" };
  if (/^\/settings\/suggestions\/?$/.test(path)) return { name: "suggestions" };
  if (/^\/settings\/?$/.test(path)) return { name: "settings" };

  const detail = /^\/map\/(.+)$/.exec(path);
  if (detail) return { name: "map", masjidId: decodeURIComponent(detail[1]) };
  if (/^\/map\/?$/.test(path)) return { name: "map", masjidId: null };

  const prayer = query.get("prayer");
  return { name: "next", prayer: isPrayer(prayer) ? prayer : null };
}

export function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => {
      const next = window.location.hash;
      const redirect = redirectFor(next);
      if (redirect) {
        // replace, not assign: an old link shouldn't leave a dead entry in
        // the back stack for the user to walk back into.
        window.location.replace(redirect);
        return;
      }
      setHash(next);
    };
    onChange();
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  // The map owns its own scroll and its sheet; resetting it would fight them.
  useEffect(() => {
    if (!hash.startsWith("#/map")) window.scrollTo(0, 0);
  }, [hash]);

  return parseRoute(hash);
}
