import { useMemo, useState } from "react";
import FreshnessDot from "../components/FreshnessDot";
import Icon from "../components/Icon";
import { useClock } from "../lib/clock";
import { formatDistance, haversineKm, type Point } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { orderedJumuah } from "../lib/prayer";
import { formatRelative } from "../lib/nextUp";
import { isFriday } from "../lib/planPrayer";
import { masjidPath } from "../lib/route";
import { clockMinutes, formatClock, zonedTimeOnDate } from "../lib/time";
import type { Masjid } from "../lib/types";

/**
 * Jumu'ah — design spec v2 §8.4.
 *
 * The one change of substance from the old screen: a masjid's sittings are
 * grouped under a single name with a rule connecting them, rather than
 * repeated as three unrelated rows. Three rows all reading "Masjid Toronto"
 * makes the reader do the grouping the screen should have done for them.
 */
const RADII = [5, 10, 25, 50];
/** §10.3: a Toronto app must not silently list a masjid in Windsor. */
const DEFAULT_RADIUS_KM = 25;

type SortOrder = "earliest" | "latest";

interface Group {
  masjid: Masjid;
  km: number;
  sittings: { khutbah: string; minutes: number }[];
  /** Sort key: the group's earliest or latest sitting, per the chosen order. */
  key: number;
}

export default function Jummah({
  masjids,
  date,
  from,
}: {
  masjids: Masjid[];
  date: Date;
  from: Point;
}) {
  const { minute } = useClock();
  const { isFavourite, toggle } = useFavourites();
  const [order, setOrder] = useState<SortOrder>("earliest");
  const [after, setAfter] = useState("");
  const [withinKm, setWithinKm] = useState<number | null>(DEFAULT_RADIUS_KM);

  const cutoff = after ? clockMinutes(after) : null;

  const { groups, sittingCount, silent } = useMemo(() => {
    const groups: Group[] = [];
    let sittingCount = 0;
    let silent = 0;

    for (const masjid of masjids) {
      const sessions = orderedJumuah(masjid);
      if (sessions.length === 0) {
        silent++;
        continue;
      }

      const km = haversineKm(from, masjid);
      if (withinKm != null && km > withinKm) continue;

      const sittings = sessions
        .map((s) => ({ khutbah: s.khutbah, minutes: clockMinutes(s.khutbah) }))
        .filter((s): s is { khutbah: string; minutes: number } => s.minutes != null)
        .filter((s) => cutoff == null || s.minutes >= cutoff);

      if (sittings.length === 0) continue;

      sittingCount += sittings.length;
      groups.push({
        masjid,
        km,
        sittings,
        key:
          order === "earliest"
            ? Math.min(...sittings.map((s) => s.minutes))
            : Math.max(...sittings.map((s) => s.minutes)),
      });
    }

    groups.sort((a, b) =>
      order === "earliest"
        ? a.key - b.key || a.km - b.km
        : b.key - a.key || a.km - b.km,
    );

    return { groups, sittingCount, silent };
  }, [masjids, from, withinKm, cutoff, order]);

  // §8.4: on a Friday, pin what's next rather than making the reader scan.
  const nextToday = useMemo(() => {
    if (!isFriday(date)) return null;
    let best: { masjid: Masjid; at: Date } | null = null;
    for (const group of groups) {
      for (const sitting of group.sittings) {
        const at = zonedTimeOnDate(date, sitting.khutbah);
        if (!at || at <= minute) continue;
        if (!best || at < best.at) best = { masjid: group.masjid, at };
      }
    }
    return best;
  }, [groups, date, minute]);

  return (
    <section>
      <h1 className="font-display text-title font-semibold">Jumu&rsquo;ah</h1>
      <p className="mt-1 text-body text-ink-2">
        Every Friday khutbah on file. Masjids with several sittings appear once
        for each.
      </p>

      {nextToday && (
        <p
          className="mt-4 rounded-md px-4 py-3 text-body"
          style={{ background: "var(--now-wash)", color: "var(--now)" }}
        >
          <span className="font-medium">Today</span> · next khutbah{" "}
          {formatRelative((nextToday.at.getTime() - minute.getTime()) / 60_000)} at{" "}
          {nextToday.masjid.name}
        </p>
      )}

      {/* One row that scrolls, not three that wrap — same as Home. */}
      <div className="-mx-4 mt-4 flex items-center gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <button
          type="button"
          onClick={() =>
            setOrder((o) => (o === "earliest" ? "latest" : "earliest"))
          }
          className="flex min-h-[44px] shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-meta font-medium text-ink-2 hover:text-ink"
        >
          <Icon name="sliders" size={16} />
          {order === "earliest" ? "Earliest first" : "Latest first"}
        </button>

        <label className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
          <span>After</span>
          <input
            type="time"
            value={after}
            onChange={(e) => setAfter(e.target.value)}
            className="bg-transparent font-num text-ink outline-none"
          />
        </label>

        <label className="flex min-h-[44px] shrink-0 items-center gap-2 rounded-full border border-line bg-surface px-3 text-meta text-ink-2">
          <span>Within</span>
          <select
            value={withinKm ?? ""}
            onChange={(e) =>
              setWithinKm(e.target.value ? Number(e.target.value) : null)
            }
            className="bg-transparent text-ink outline-none"
          >
            {RADII.map((km) => (
              <option key={km} value={km}>
                {km} km
              </option>
            ))}
            <option value="">Any distance</option>
          </select>
        </label>
      </div>

      <p className="mt-3 text-meta text-ink-3" aria-live="polite">
        {sittingCount} sitting{sittingCount === 1 ? "" : "s"} across{" "}
        {groups.length} masjid{groups.length === 1 ? "" : "s"}
      </p>

      {groups.length === 0 ? (
        <p className="mt-2 rounded-lg border border-line bg-surface p-6 text-center text-body text-ink-2">
          No Jumu&rsquo;ah matches those filters. Try relaxing one.
        </p>
      ) : (
        <ul className="mt-2 overflow-hidden rounded-lg border border-line bg-surface">
          {groups.map((group) => (
            <li
              key={group.masjid.id}
              className="border-b border-line last:border-b-0"
            >
              <div className="flex items-start gap-3 px-4 pt-3">
                <span className="min-w-0 flex-1">
                  <a
                    href={masjidPath(group.masjid.id)}
                    className="flex items-center gap-2"
                  >
                    <FreshnessDot
                      masjid={group.masjid}
                      today={date}
                      showLabel={false}
                    />
                    <span className="truncate text-name font-medium text-ink">
                      {group.masjid.name}
                    </span>
                  </a>
                  <span className="mt-0.5 block font-num text-meta text-ink-3">
                    {formatDistance(group.km)}
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => toggle(group.masjid.id)}
                  aria-pressed={isFavourite(group.masjid.id)}
                  aria-label={`Favourite ${group.masjid.name}`}
                  className={
                    "flex h-11 w-11 shrink-0 items-center justify-center " +
                    (isFavourite(group.masjid.id) ? "text-brand" : "text-ink-3")
                  }
                >
                  <Icon
                    name={isFavourite(group.masjid.id) ? "star-filled" : "star"}
                    size={18}
                  />
                </button>
              </div>

              {/* One rule down the left ties a masjid's sittings together
                  instead of leaving three unrelated rows (§8.4). */}
              <ul className="mb-3 ml-[26px] mt-1 border-l border-line pl-3">
                {group.sittings.map((sitting, i) => (
                  <li
                    key={`${sitting.khutbah}-${i}`}
                    className="flex items-baseline justify-between gap-3 py-1.5"
                  >
                    <span className="text-meta text-ink-3">
                      {group.sittings.length > 1
                        ? `Sitting ${i + 1} of ${group.sittings.length}`
                        : "Khutbah"}
                    </span>
                    <span className="font-num text-section font-medium text-ink">
                      {formatClock(sitting.khutbah)}
                    </span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      {silent > 0 && (
        <p className="mt-3 text-meta text-ink-3">
          {silent} masjid{silent === 1 ? "" : "s"} not listed — we don&rsquo;t
          have their Friday times yet. They almost certainly hold Jumu&rsquo;ah;
          check their own site.
        </p>
      )}

      <p className="mt-5 text-meta text-ink-3">
        Times are when the khutbah begins, collected from each masjid&rsquo;s
        own site. Confirm with the masjid before relying on them.
      </p>
    </section>
  );
}
