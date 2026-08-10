import { useEffect, useState } from "react";
import { PRAYERS, type Prayer } from "./types";

/**
 * Minimal hash routing. The app is a static bundle with no server to rewrite
 * paths, and hash URLs keep the phone's back button and shareable links
 * working without pulling in a router.
 */
export type Route =
  | { name: "list" }
  | { name: "compare"; prayer: Prayer | null }
  | { name: "masjid"; id: string };

export const listPath = "#/";
export const comparePath = (prayer?: Prayer) =>
  prayer ? `#/compare/${prayer}` : "#/compare";
export const masjidPath = (id: string) => `#/masjid/${encodeURIComponent(id)}`;

const isPrayer = (value: string): value is Prayer =>
  (PRAYERS as readonly string[]).includes(value);

export function parseRoute(hash: string): Route {
  const path = hash.replace(/^#/, "");

  const masjid = /^\/masjid\/(.+)$/.exec(path);
  if (masjid) return { name: "masjid", id: decodeURIComponent(masjid[1]) };

  const compare = /^\/compare(?:\/([a-z]+))?\/?$/.exec(path);
  if (compare) {
    const prayer = compare[1];
    // An unrecognized prayer in the URL falls back to the view's own default
    // rather than rendering an empty comparison.
    return { name: "compare", prayer: prayer && isPrayer(prayer) ? prayer : null };
  }

  return { name: "list" };
}

export function useHashRoute(): Route {
  const [hash, setHash] = useState(() => window.location.hash);

  useEffect(() => {
    const onChange = () => setHash(window.location.hash);
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [hash]);

  return parseRoute(hash);
}
