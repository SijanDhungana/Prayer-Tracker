import { useEffect, useMemo, useRef, useState } from "react";
import BottomSheet, { type Snap } from "../components/BottomSheet";
import Icon from "../components/Icon";
import MasjidDetailSheet from "../components/MasjidDetailSheet";
import TimeRow from "../components/TimeRow";
import { useClock } from "../lib/clock";
import { formatDistance, haversineKm } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { googleMapsConfigured, loadGoogleMaps } from "../lib/googleMaps";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { mapPath, masjidPath } from "../lib/route";
import { formatTime } from "../lib/time";
import FreshnessDot from "../components/FreshnessDot";
import { PRAYERS, PRAYER_LABELS, type Masjid, type Prayer } from "../lib/types";

/**
 * The map owns the whole viewport — design spec v2 §8.1.
 *
 * "No page scroll, no header above it, no card wrapper. Everything else
 * floats on top." The old map was a short rectangle inside a scrolling page,
 * which §2 calls out as the worst of both.
 *
 * This screen also absorbs the old "All masjids" tab: the results sheet *is*
 * the list of 32, same data, same filters, one place (§3).
 */
function token(name: string, fallback: string): string {
  if (typeof document === "undefined") return fallback;
  return (
    getComputedStyle(document.documentElement).getPropertyValue(name).trim() ||
    fallback
  );
}

/** A 32px teardrop in --now with a white glyph (§8.1). */
function pinIcon(selected: boolean, favourite: boolean): google.maps.Icon {
  const size = selected ? 40 : 32;
  const fill = token("--now", "#E08B5C");
  const ring = favourite
    ? `<circle cx="16" cy="14" r="12.5" fill="none" stroke="${token("--brand", "#3FA383")}" stroke-width="2"/>`
    : "";
  const svg = `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg">
    <path d="M16 0C7.2 0 0 7.2 0 16c0 12 16 26 16 26s16-14 16-26C32 7.2 24.8 0 16 0z" fill="${fill}"/>
    ${ring}
    <circle cx="16" cy="15" r="5" fill="#fff"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(size, size * 1.3),
    anchor: new google.maps.Point(size / 2, size * 1.3),
  };
}

type MapStatus = "unconfigured" | "loading" | "ready" | "error";

export default function MapScreen({
  masjids,
  date,
  reference,
  masjidId,
  onPublished,
}: {
  masjids: Masjid[];
  date: Date;
  reference: ReferencePoint;
  masjidId: string | null;
  onPublished?: () => void;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const { minute, position } = useClock();
  const { isFavourite, toggle } = useFavourites();

  const [status, setStatus] = useState<MapStatus>(
    googleMapsConfigured ? "loading" : "unconfigured",
  );
  const [query, setQuery] = useState("");
  const [snap, setSnap] = useState<Snap>("half");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [onlyJumuah, setOnlyJumuah] = useState(false);

  const { point } = reference;
  const pointRef = useRef(point);
  pointRef.current = point;

  const prayer = position.window?.prayer ?? "fajr";

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return masjids
      .map((masjid) => ({
        masjid,
        km: haversineKm(point, masjid),
        iqamah: iqamahTimes(masjid, date)[prayer],
        adhan: adhanTimes(masjid, date)[prayer],
      }))
      .filter(({ masjid }) => {
        if (onlyFavourites && !isFavourite(masjid.id)) return false;
        if (onlyJumuah && (masjid.jumuah ?? []).length === 0) return false;
        if (!q) return true;
        return (
          masjid.name.toLowerCase().includes(q) ||
          masjid.address.toLowerCase().includes(q)
        );
      })
      .sort((a, b) => a.km - b.km);
  }, [masjids, point, date, prayer, query, onlyFavourites, onlyJumuah, isFavourite]);

  const detail = masjidId
    ? (masjids.find((m) => m.id === masjidId) ?? null)
    : null;

  // Create the map once. Google owns this node outright, so React must never
  // render children into it.
  useEffect(() => {
    if (!googleMapsConfigured || !holder.current || map.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !holder.current || map.current) return;
        const instance = new google.maps.Map(holder.current, {
          center: pointRef.current,
          zoom: 12,
          gestureHandling: "greedy",
          disableDefaultUI: true,
          clickableIcons: false,
        });
        instance.addListener("click", () => setSelectedId(null));
        map.current = instance;
        // Camera moves before the first idle are dropped by the Maps API.
        google.maps.event.addListenerOnce(instance, "idle", () => {
          if (!cancelled) setStatus("ready");
        });
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    return () => {
      for (const marker of markers.current) marker.setMap(null);
      markers.current = [];
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, []);

  // Pins follow the filtered results, so the map and the sheet never disagree.
  useEffect(() => {
    const instance = map.current;
    if (status !== "ready" || !instance) return;

    for (const marker of markers.current) marker.setMap(null);
    markers.current = rows.map(({ masjid, km, iqamah }) => {
      const marker = new google.maps.Marker({
        position: { lat: masjid.lat, lng: masjid.lng },
        map: instance,
        icon: pinIcon(masjid.id === selectedId, isFavourite(masjid.id)),
        // §12: pins are in the accessibility tree with a real label.
        title: `${masjid.name}, ${formatDistance(km)}${
          iqamah ? `, ${PRAYER_LABELS[prayer]} iqamah ${formatTime(iqamah)}` : ""
        }`,
        zIndex: masjid.id === selectedId ? 1000 : undefined,
      });
      marker.addListener("click", () => {
        setSelectedId(masjid.id);
        // Raise the sheet ourselves. Peek is 120px — barely the handle and a
        // line — so leaving it there made tapping a pin look like nothing had
        // happened until you dragged the sheet up by hand.
        setSnap("half");
      });
      return marker;
    });
  }, [status, rows, selectedId, prayer, isFavourite]);

  const recenter = () => {
    map.current?.panTo(point);
    map.current?.setZoom(13);
  };

  const selected = selectedId
    ? (rows.find((r) => r.masjid.id === selectedId) ?? null)
    : null;

  return (
    <div className="fixed inset-0 top-0">
      <div
        ref={holder}
        role="application"
        aria-label="Map of masjids"
        className="absolute inset-0 bg-surface-2"
      />

      {status !== "ready" && (
        <div className="absolute inset-x-4 top-24 z-20 rounded-lg border border-line bg-surface p-4 text-center text-body text-ink-2">
          {status === "unconfigured"
            ? "The map needs a Google Maps API key. The list below still works."
            : status === "error"
              ? "Couldn't load the map. The list below still works."
              : "Loading the map…"}
        </div>
      )}

      {/* Floating search, inset from the safe area (§8.1). */}
      <div
        className="absolute inset-x-4 z-20"
        style={{ top: "calc(env(safe-area-inset-top) + 12px)" }}
      >
        <div
          className="flex h-12 items-center gap-2 rounded-full border border-line px-4 shadow-float backdrop-blur-xl"
          style={{
            background: "color-mix(in srgb, var(--surface) 92%, transparent)",
          }}
        >
          <Icon name="search" size={18} />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setSnap("half");
            }}
            placeholder="Search masjids or an address"
            aria-label="Search masjids"
            className="min-w-0 flex-1 bg-transparent text-body text-ink outline-none placeholder:text-ink-3"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Clear search"
              className="flex h-9 w-9 items-center justify-center rounded-full text-ink-2 hover:text-ink"
            >
              <Icon name="x" size={18} />
            </button>
          )}
        </div>

        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          <Chip
            active={onlyJumuah}
            onClick={() => setOnlyJumuah((v) => !v)}
            label="Has Jumu'ah"
          />
          <Chip
            active={onlyFavourites}
            onClick={() => setOnlyFavourites((v) => !v)}
            label="Favourites"
          />
        </div>
      </div>

      <button
        type="button"
        onClick={recenter}
        aria-label="Recentre the map"
        className="absolute right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-float hover:text-ink"
        style={{ bottom: "calc(50vh + 24px)" }}
      >
        <Icon name="crosshair" size={20} />
      </button>

      <BottomSheet snap={snap} onSnapChange={setSnap} label="Masjid results">
        {selected ? (
          <SelectedMasjid
            masjid={selected.masjid}
            km={selected.km}
            date={date}
            favourite={isFavourite(selected.masjid.id)}
            onToggleFavourite={() => toggle(selected.masjid.id)}
            currentPrayer={prayer}
          />
        ) : (
          <>
            <p className="px-4 pb-2 text-meta text-ink-3" aria-live="polite">
              {rows.length} masjid{rows.length === 1 ? "" : "s"} nearby ·{" "}
              {PRAYER_LABELS[prayer]} adhan{" "}
              {rows[0] ? formatTime(rows[0].adhan) : "—"}
            </p>
            {/* Clears the floating tab bar, which is drawn over the sheet. */}
            <ul style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}>
              {rows.map((row) => (
                <TimeRow
                  key={row.masjid.id}
                  masjid={row.masjid}
                  today={date}
                  iqamah={row.iqamah}
                  adhan={row.adhan}
                  km={row.km}
                  relative={
                    row.iqamah
                      ? relative(row.iqamah.getTime() - minute.getTime())
                      : undefined
                  }
                  favourite={isFavourite(row.masjid.id)}
                  onToggleFavourite={() => toggle(row.masjid.id)}
                />
              ))}
            </ul>
            {rows.length === 0 && (
              <p className="p-6 text-center text-body text-ink-2">
                Nothing matches. Try a different search or clear the filters.
              </p>
            )}
          </>
        )}
      </BottomSheet>

      {detail && (
        <MasjidDetailSheet
          masjid={detail}
          date={date}
          from={point}
          onClose={() => window.location.assign(mapPath)}
          onPublished={onPublished}
        />
      )}
    </div>
  );
}

/**
 * What a tapped pin shows: the masjid's actual iqamah times.
 *
 * It used to show a "Details" button, which made the map two taps from the
 * only thing anyone opens it for. The times are small enough to just print,
 * so they are printed; the full screen is still one tap away for the address,
 * Jumu'ah sittings and corrections.
 */
function SelectedMasjid({
  masjid,
  km,
  date,
  favourite,
  onToggleFavourite,
  currentPrayer,
}: {
  masjid: Masjid;
  km: number;
  date: Date;
  favourite: boolean;
  onToggleFavourite: () => void;
  currentPrayer: Prayer;
}) {
  const iqamah = iqamahTimes(masjid, date);
  const adhan = adhanTimes(masjid, date);

  return (
    <div
      className="px-4"
      style={{ paddingBottom: "calc(88px + env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-start gap-3">
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2">
            <FreshnessDot masjid={masjid} today={date} showLabel={false} />
            <span className="truncate text-name font-medium text-ink">
              {masjid.name}
            </span>
          </span>
          <span className="mt-0.5 block font-num text-meta text-ink-3">
            {formatDistance(km)}
          </span>
        </span>
        <button
          type="button"
          onClick={onToggleFavourite}
          aria-pressed={favourite}
          aria-label={favourite ? "Remove from your masjids" : "Add to your masjids"}
          className={
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-md " +
            (favourite ? "text-brand" : "text-ink-3")
          }
        >
          <Icon name={favourite ? "star-filled" : "star"} size={18} />
        </button>
      </div>

      {/* §5: iqamah is the primary number, adhan small and grey beneath, and
          the current prayer's column is tinted and named rather than bolded. */}
      <ul className="mt-3 grid grid-cols-5 gap-1">
        {PRAYERS.map((p) => {
          const current = p === currentPrayer;
          return (
            <li
              key={p}
              className="rounded-md py-2 text-center"
              style={
                current
                  ? { background: "var(--now-wash)", color: "var(--now)" }
                  : undefined
              }
            >
              <span className="block text-[11px] uppercase tracking-[0.08em] text-ink-3">
                {PRAYER_LABELS[p]}
              </span>
              <span
                className={
                  "mt-0.5 block font-num text-body font-medium " +
                  (current ? "" : "text-ink")
                }
              >
                {iqamah[p] ? formatTime(iqamah[p]!) : "—"}
              </span>
              <span className="block font-num text-[11px] text-ink-3">
                {formatTime(adhan[p])}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-meta text-ink-3">Iqamah · adhan below</p>

      <a
        href={masjidPath(masjid.id)}
        className="mt-3 flex min-h-[44px] items-center justify-center rounded-md border border-line font-medium text-ink-2"
      >
        Full details, Jumu'ah and directions →
      </a>
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={
        "flex h-9 shrink-0 items-center rounded-full border px-3 text-meta font-medium backdrop-blur-xl " +
        (active
          ? "border-brand bg-brand-wash text-brand"
          : "border-line text-ink-2")
      }
      style={
        active
          ? undefined
          : { background: "color-mix(in srgb, var(--surface) 92%, transparent)" }
      }
    >
      {label}
    </button>
  );
}

function relative(ms: number): string {
  const m = Math.round(ms / 60_000);
  if (m < 0) return `${Math.abs(m)} min ago`;
  if (m === 0) return "now";
  if (m < 60) return `in ${m} min`;
  const h = Math.floor(m / 60);
  return m % 60 === 0 ? `in ${h} h` : `in ${h} h ${m % 60} min`;
}
