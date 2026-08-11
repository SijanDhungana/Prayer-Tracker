import { useMemo } from "react";
import FreshnessDot from "./FreshnessDot";
import { useClock } from "../lib/clock";
import { iqamahTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatTime } from "../lib/time";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * "My masjid" — the next congregation at the one you actually attend.
 *
 * Favourites are a shortlist you still have to read; this answers the
 * question outright, which for most people is the whole app: not "which of
 * thirty-two", just "when is the next jamaah at mine".
 *
 * Shown on Next up above everything else, and again in Settings beside the
 * picker so the choice confirms itself immediately.
 */
export function nextIqamahAt(
  masjid: Masjid,
  today: Date,
  now: Date,
): { prayer: Prayer; at: Date } | null {
  const times = iqamahTimes(masjid, today);
  for (const prayer of PRAYERS) {
    const at = times[prayer];
    if (at && at > now) return { prayer, at };
  }
  return null;
}

export default function HomeMasjidCard({
  masjid,
  compact = false,
}: {
  masjid: Masjid;
  /** Settings shows a single line; Next up shows the full card. */
  compact?: boolean;
}) {
  const { today, minute } = useClock();
  const next = useMemo(
    () => nextIqamahAt(masjid, today, minute),
    [masjid, today, minute],
  );

  const relative = next
    ? formatRelative((next.at.getTime() - minute.getTime()) / 60_000)
    : null;

  if (compact) {
    return (
      <p className="mt-1 text-meta text-ink-3">
        {next ? (
          <>
            Next: {PRAYER_LABELS[next.prayer]}{" "}
            <span className="font-num text-ink-2">{formatTime(next.at)}</span>{" "}
            {relative}
          </>
        ) : (
          "No congregations left today."
        )}
      </p>
    );
  }

  return (
    <a
      href={masjidPath(masjid.id)}
      className="mt-4 block rounded-lg border p-4"
      style={{ borderColor: "var(--now)", background: "var(--now-wash)" }}
    >
      <span className="flex items-center gap-2">
        <FreshnessDot masjid={masjid} today={today} showLabel={false} />
        <span className="truncate text-meta uppercase tracking-[0.08em] text-ink-3">
          Your masjid
        </span>
      </span>

      <span className="mt-1 block truncate text-name font-medium text-ink">
        {masjid.name}
      </span>

      {next ? (
        <span className="mt-2 flex items-baseline justify-between gap-3">
          <span className="text-body" style={{ color: "var(--now)" }}>
            {PRAYER_LABELS[next.prayer]} iqamah
          </span>
          <span className="text-right">
            <span className="block font-num text-bigtime font-medium text-ink">
              {formatTime(next.at)}
            </span>
            <span className="block font-num text-meta text-ink-3">{relative}</span>
          </span>
        </span>
      ) : (
        <span className="mt-2 block text-body text-ink-2">
          No congregations left today.
        </span>
      )}
    </a>
  );
}

function formatRelative(minutes: number): string {
  const m = Math.round(minutes);
  if (m <= 0) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `in ${h} h` : `in ${h} h ${m % 60} min`;
}
