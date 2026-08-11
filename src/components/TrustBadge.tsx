import { trustStatus } from "../lib/trust";
import type { Masjid } from "../lib/types";

/**
 * How old a masjid's times are, said the same way everywhere — CLAUDE.md §14.
 *
 * `quiet` drops the reassuring cases and renders only the warnings, for rows
 * that are already dense with distance and sitting numbers. A list of thirty
 * masjids each saying "Checked today" is thirty pieces of nothing; the two
 * that say "Not verified yet" are the point.
 */
export default function TrustBadge({
  masjid,
  today,
  quiet = false,
}: {
  masjid: Masjid;
  today: Date;
  quiet?: boolean;
}) {
  const status = trustStatus(masjid, today);

  if (quiet && !status.warn) return null;

  return (
    <span
      className={
        "rounded-full px-2 py-0.5 text-[11px] font-medium " +
        (status.warn
          ? "bg-caution-wash text-caution"
          : "bg-surface-2 text-ink-3")
      }
    >
      {status.label}
    </span>
  );
}

/**
 * The same verdict as plain inline text, for rows too tight for a pill.
 * Returns null when there is nothing worth saying.
 */
export function TrustNote({
  masjid,
  today,
}: {
  masjid: Masjid;
  today: Date;
}) {
  const status = trustStatus(masjid, today);
  if (!status.warn) return null;

  return <span className="text-caution"> · {status.label.toLowerCase()}</span>;
}
