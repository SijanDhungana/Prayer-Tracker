/**
 * "I go to these three" — the commonest real behaviour, unsupported until now
 * (design spec v2 §2, §10.6).
 *
 * Stored as masjid ids under `mt.favourites.v1`, the key the spec names.
 * Local-only is explicitly acceptable, so there is no account sync here; the
 * shape is a plain array so adding one later is a migration, not a rewrite.
 */
import { useCallback, useEffect, useState } from "react";

const KEY = "mt.favourites.v1";

function read(): string[] {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    // Anything else in this key came from a different version or a bad write;
    // an empty list is a safer read than a crash on boot.
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

function write(ids: string[]) {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(ids));
  } catch {
    // Private mode: the stars still work for this visit.
  }
}

export function useFavourites() {
  const [ids, setIds] = useState<string[]>(read);

  // Two tabs, one set of favourites.
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === KEY) setIds(read());
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = prev.includes(id)
        ? prev.filter((x) => x !== id)
        : [...prev, id];
      write(next);
      return next;
    });
  }, []);

  const isFavourite = useCallback((id: string) => ids.includes(id), [ids]);

  return { favourites: ids, toggle, isFavourite };
}
