import type { Masjid } from "../lib/types";
import raw from "./masjids.json";

/**
 * The scraper rewrites masjids.json daily, so it is plain JSON with no type
 * annotations. This is the one place we assert its shape.
 */
export const masjids = (raw as Masjid[])
  .slice()
  .sort((a, b) => a.name.localeCompare(b.name));
