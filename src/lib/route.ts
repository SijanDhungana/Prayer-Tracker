import { useEffect, useState } from "react";

/**
 * Minimal hash routing. The app is a static bundle with no server to rewrite
 * paths, and hash URLs keep the phone's back button and shareable links
 * working without pulling in a router.
 */
export function useHashRoute(): string {
  const [route, setRoute] = useState(() => window.location.hash.slice(1));

  useEffect(() => {
    const onChange = () => setRoute(window.location.hash.slice(1));
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [route]);

  return route;
}

export const masjidPath = (id: string) => `#/masjid/${id}`;

/** Returns the masjid id when `route` is a detail route, else null. */
export function masjidIdFrom(route: string): string | null {
  const match = /^\/masjid\/(.+)$/.exec(route);
  return match ? decodeURIComponent(match[1]) : null;
}
