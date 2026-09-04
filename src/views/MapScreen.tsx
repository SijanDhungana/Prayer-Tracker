import { useEffect, useMemo, useRef, useState } from "react";
import BottomSheet, { HEIGHTS, type Snap } from "../components/BottomSheet";
import Icon from "../components/Icon";
import MasjidDetailSheet from "../components/MasjidDetailSheet";
import TimeRow from "../components/TimeRow";
import { useClock } from "../lib/clock";
import { formatDistance, haversineKm } from "../lib/distance";
import { useFavourites } from "../lib/favourites";
import { googleMapsConfigured, loadGoogleMaps } from "../lib/googleMaps";
import type { ReferencePoint } from "../lib/location";
import { congregationAdhan, formatRelative, nextCongregation } from "../lib/nextUp";
import { prayerLabel, resolvePlanIqamah } from "../lib/planPrayer";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { mapPath, masjidPath } from "../lib/route";
import { formatTime, formatTimeShort } from "../lib/time";
import FreshnessDot from "../components/FreshnessDot";
import { nextIqamahAt } from "../components/HomeMasjidCard";
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

/**
 * Pins are labelled pills, not teardrops.
 *
 * A dot tells you a masjid is there, which you could have guessed. The thing
 * worth knowing at a glance is *when the next jamaah is*, so — the way a
 * lettings map prints the nightly price right on the pin — each pin prints
 * that masjid's own next iqamah. Scanning the map then answers "which one can
 * I still make" without tapping anything.
 *
 * "Its own" matters: at 6:50pm one masjid's Asr at 7:00 is still ahead while
 * another's at 6:30 has gone, so the pins deliberately name different prayers
 * at the same moment. That difference *is* the answer, and it is why the
 * prayer is named on the pill rather than assumed from a global header.
 */

/**
 * Data-URI SVG renders in its own document and cannot reach the page's
 * webfonts, so the pill is drawn in a system stack and measured in the same
 * stack — guessing a per-character width clipped the longer labels.
 */
const PIN_FONT_STACK =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';
const PIN_FONT = `600 12px ${PIN_FONT_STACK}`;

let measurer: CanvasRenderingContext2D | null = null;
const widthCache = new Map<string, number>();

function textWidth(text: string): number {
  const cached = widthCache.get(text);
  if (cached != null) return cached;

  measurer ??= document.createElement("canvas").getContext("2d");
  if (!measurer) return text.length * 7;

  measurer.font = PIN_FONT;
  const width = measurer.measureText(text).width;
  widthCache.set(text, width);
  return width;
}

interface PillState {
  label: string;
  selected: boolean;
  favourite: boolean;
  /** Nothing left today — shown muted, since it answers "not this one". */
  dim: boolean;
}

function pillIcon({ label, selected, favourite, dim }: PillState): google.maps.Icon {
  const height = 26;
  const tail = 6;
  const width = Math.ceil(textWidth(label)) + 20;

  const surface = token("--surface", "#ffffff");
  const ink = token("--ink", "#12130F");
  const background = selected ? ink : surface;
  const foreground = selected ? surface : dim ? token("--ink-3", "#6B6F66") : ink;
  const stroke = selected
    ? ink
    : favourite
      ? token("--brand", "#3FA383")
      : token("--line", "#DDE1D8");
  const strokeWidth = favourite && !selected ? 2 : 1;

  const mid = width / 2;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height + tail}" viewBox="0 0 ${width} ${height + tail}">
    <g>
      <path d="M${mid - 5} ${height - 1} L${mid} ${height + tail - 1} L${mid + 5} ${height - 1} Z" fill="${background}" stroke="${stroke}" stroke-width="${strokeWidth}" stroke-linejoin="round"/>
      <rect x="${strokeWidth / 2}" y="${strokeWidth / 2}" width="${width - strokeWidth}" height="${height - strokeWidth}" rx="${(height - strokeWidth) / 2}" fill="${background}" stroke="${stroke}" stroke-width="${strokeWidth}"/>
      <text x="${mid}" y="${height / 2}" text-anchor="middle" dominant-baseline="central"
            font-family='${PIN_FONT_STACK}' font-size="12" font-weight="600" fill="${foreground}">${escapeXml(label)}</text>
    </g>
  </svg>`;

  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(width, height + tail),
    anchor: new google.maps.Point(mid, height + tail),
  };
}

function escapeXml(text: string): string {
  return text.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!,
  );
}

/** Google's own blue, so the dot reads as "you" without explanation. */
function youAreHereIcon(): google.maps.Icon {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 22 22">
    <circle cx="11" cy="11" r="10" fill="#4285F4" fill-opacity="0.22"/>
    <circle cx="11" cy="11" r="6" fill="#4285F4" stroke="#fff" stroke-width="2.5"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(22, 22),
    anchor: new google.maps.Point(11, 11),
  };
}

/** "Asr 7:00" — the meridiem is dropped because the prayer name carries it. */
function pillLabel(prayer: Prayer, at: Date): string {
  return `${PRAYER_LABELS[prayer]} ${formatTime(at).replace(/\s*(AM|PM)$/i, "")}`;
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
  const markers = useRef(
    new Map<string, { marker: google.maps.Marker; key: string }>(),
  );
  const you = useRef<google.maps.Marker | null>(null);
  const { minute } = useClock();
  const { isFavourite, toggle } = useFavourites();

  const [status, setStatus] = useState<MapStatus>(
    googleMapsConfigured ? "loading" : "unconfigured",
  );
  const [query, setQuery] = useState("");
  // Opens lowered. The map is what people come to this tab for; a sheet
  // covering half of it on arrival made the list the main event and the map
  // a strip above it. Peek keeps the header line and the first row in view,
  // and a drag or a search raises it.
  const [snap, setSnap] = useState<Snap>("peek");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [onlyFavourites, setOnlyFavourites] = useState(false);
  const [onlyJumuah, setOnlyJumuah] = useState(false);
  /** Bumped by "Try again" so the creation effect runs a second time. */
  const [attempt, setAttempt] = useState(0);

  const { point } = reference;
  const pointRef = useRef(point);
  pointRef.current = point;

  /**
   * The list names the congregation you can still get to, the same rule as
   * Next up. It used to name the current *window's* prayer, which is a
   * different thing: at 8am the clock is inside Fajr's window, so the sheet
   * listed Fajr congregations that had all finished two hours earlier — a
   * page of "ago" under a header for a prayer nobody could still pray. The
   * next congregation some masjid still holds ahead of now is the answer to
   * the question the map is opened for, and on a Friday that is Jumu'ah.
   */
  const congregation = useMemo(
    () => nextCongregation(masjids, date, minute),
    [masjids, date, minute],
  );
  const prayer = congregation.prayer;
  const listDate = congregation.date;

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return masjids
      .map((masjid) => ({
        masjid,
        km: haversineKm(point, masjid),
        iqamah: resolvePlanIqamah(masjid, prayer, minute, listDate),
        adhan: congregationAdhan(masjid, prayer, listDate),
        // What the pin prints: this masjid's own next congregation, which
        // rolls to tomorrow's Fajr once today's are done.
        next: nextIqamahAt(masjid, date, minute),
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
  }, [masjids, point, date, listDate, prayer, query, onlyFavourites, onlyJumuah, isFavourite, minute]);

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

        /**
         * Ready on whichever comes first.
         *
         * Camera moves before the first idle are dropped by the Maps API, so
         * idle is the honest signal — but everything the user can see is
         * gated behind it, pins included, and a single event that never
         * arrives leaves the screen blank for good. `tilesloaded` means the
         * map is genuinely painted and is the better of the two to trust;
         * either one is enough.
         */
        const ready = () => {
          if (!cancelled) setStatus("ready");
        };
        google.maps.event.addListenerOnce(instance, "idle", ready);
        google.maps.event.addListenerOnce(instance, "tilesloaded", ready);
      })
      .catch(() => !cancelled && setStatus("error"));

    return () => {
      cancelled = true;
    };
  }, [attempt]);

  useEffect(() => {
    const live = markers.current;
    return () => {
      for (const { marker } of live.values()) marker.setMap(null);
      live.clear();
      you.current?.setMap(null);
      you.current = null;
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, []);

  /**
   * Pins follow the filtered results, so the map and the sheet never disagree.
   *
   * Reconciled rather than rebuilt. The labels tick over as congregations pass,
   * so this effect now runs every minute; tearing all 32 markers down and
   * re-adding them at that rate made the pins visibly blink, and dropped any
   * pin the user was mid-tap on. Markers are keyed by masjid and only the ones
   * whose drawn state actually changed get a new icon.
   */
  useEffect(() => {
    const instance = map.current;
    if (status !== "ready" || !instance) return;

    const live = markers.current;
    const seen = new Set<string>();

    for (const { masjid, km, next } of rows) {
      seen.add(masjid.id);
      const selected = masjid.id === selectedId;
      const favourite = isFavourite(masjid.id);
      const label = next ? pillLabel(next.prayer, next.at) : "No times";
      const state: PillState = {
        label,
        selected,
        favourite,
        dim: next?.tomorrow ?? true,
      };
      const key = `${label}|${selected}|${favourite}|${state.dim}`;

      const title = `${masjid.name}, ${formatDistance(km)}${
        next
          ? `, next ${PRAYER_LABELS[next.prayer]} iqamah ${formatTime(next.at)}${next.tomorrow ? " tomorrow" : ""}`
          : ", no iqamah times on file"
      }`;

      const existing = live.get(masjid.id);
      if (existing) {
        if (existing.key !== key) {
          existing.marker.setIcon(pillIcon(state));
          existing.marker.setTitle(title);
          existing.key = key;
        }
        // Sooner congregations sit above later ones so the pill that still
        // matters is the one you can read where they overlap.
        existing.marker.setZIndex(zIndexFor(selected, next?.at ?? null));
        continue;
      }

      const marker = new google.maps.Marker({
        position: { lat: masjid.lat, lng: masjid.lng },
        map: instance,
        icon: pillIcon(state),
        // §12: pins are in the accessibility tree with a real label.
        title,
        zIndex: zIndexFor(selected, next?.at ?? null),
      });
      marker.addListener("click", () => {
        setSelectedId(masjid.id);
        // Raise the sheet ourselves. Peek is 120px — barely the handle and a
        // line — so leaving it there made tapping a pin look like nothing had
        // happened until you dragged the sheet up by hand.
        setSnap("half");
      });
      live.set(masjid.id, { marker, key });
    }

    for (const [id, entry] of live) {
      if (seen.has(id)) continue;
      entry.marker.setMap(null);
      live.delete(id);
    }
  }, [status, rows, selectedId, isFavourite]);

  /** The blue "you are here" dot, only once a real fix has come back. */
  useEffect(() => {
    const instance = map.current;
    if (status !== "ready" || !instance) return;

    if (reference.status !== "active") {
      you.current?.setMap(null);
      you.current = null;
      return;
    }

    if (!you.current) {
      you.current = new google.maps.Marker({
        map: instance,
        icon: youAreHereIcon(),
        clickable: false,
        title: "Your location",
        zIndex: 2000,
      });
      // Finding you is only useful if the map then shows where that is —
      // close enough to tell streets apart, not the city-wide zoom the
      // preset opens at.
      instance.panTo(point);
      instance.setZoom(14);
    }
    you.current.setPosition(point);
  }, [status, reference.status, point.lat, point.lng]);

  /**
   * The crosshair asks for a location before it recentres on one.
   *
   * It used to pan to the reference point, which without a fix is downtown
   * Toronto — so on a phone in Scarborough the button appeared broken: it
   * moved the map somewhere that was not where you are, and nothing on the
   * map ever showed your position. The map now asks for a fix as it opens
   * (see above); this button re-asks for anyone who said no the first time.
   */
  /**
   * Ask for the device's location as soon as the map opens.
   *
   * §9 keeps location off the boot path and behind a tap, and opening the
   * map *is* that tap: nobody comes to a map to see a neighbourhood preset
   * centred on City Hall. Asked once per visit to this screen, not on every
   * render; a refusal falls back to the preset exactly as before, with the
   * reason surfaced in the location chip's sheet.
   */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || reference.status === "active") return;
    asked.current = true;
    reference.useDeviceLocation();
    // Deliberately once: useDeviceLocation is stable, and re-asking on each
    // status change would re-prompt someone who just said no.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const recenter = () => {
    // Recentring is the button's original job and still happens either way:
    // on your position once we have one, on the chosen neighbourhood until
    // then, so a denied or unavailable fix still leaves the button useful.
    map.current?.panTo(point);
    map.current?.setZoom(reference.status === "active" ? 14 : 12);
    if (reference.status !== "active") reference.useDeviceLocation();
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

      {/*
        Loading is a skeleton, not a message.

        The first open pays for a cold fetch of the Maps SDK — a second or
        more on mobile — and the old treatment put the word "Loading" in a
        bordered box over a blank grey rectangle, which reads as a failure.
        People backed out and came in again, which appeared to fix it only
        because the script was cached by then. A shimmering surface reads as
        "coming", so the same wait no longer looks broken.
      */}
      {status === "loading" && (
        <div className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-surface-2" />
      )}

      {(status === "unconfigured" || status === "error") && (
        <div className="absolute inset-x-4 top-24 z-20 rounded-lg border border-line bg-surface p-4 text-center text-body text-ink-2">
          {status === "unconfigured"
            ? "The map needs a Google Maps API key. The list below still works."
            : "Couldn't load the map. The list below still works."}
          {status === "error" && (
            <button
              type="button"
              onClick={() => {
                setStatus("loading");
                setAttempt((n) => n + 1);
              }}
              className="mt-3 flex min-h-[44px] w-full items-center justify-center rounded-md border border-line font-medium text-ink"
            >
              Try again
            </button>
          )}
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
              className="-mr-2 flex h-11 w-11 items-center justify-center rounded-full text-ink-2 hover:text-ink"
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
        disabled={reference.status === "locating"}
        aria-label={
          reference.status === "active"
            ? "Centre the map on your location"
            : reference.status === "locating"
              ? "Finding your location"
              : "Show my location"
        }
        className={
          "absolute right-4 z-20 flex h-11 w-11 items-center justify-center rounded-full border bg-surface shadow-float " +
          (reference.status === "active"
            ? "border-line text-brand"
            : "border-line text-ink-2 hover:text-ink") +
          // At Full the sheet is the whole screen and the map is gone; a
          // recentre button floating over a list has nothing to recentre.
          (snap === "full" ? " invisible" : "")
        }
        // Rides just above the sheet at every snap. It used to be pinned to
        // the half-height position, which left it hanging mid-screen at Peek.
        style={{
          bottom: `calc(${HEIGHTS[snap]} + 16px)`,
          transition: "bottom var(--base) var(--spring)",
        }}
      >
        <span className={reference.status === "locating" ? "animate-pulse" : ""}>
          <Icon name="crosshair" size={20} />
        </span>
      </button>

      <BottomSheet snap={snap} onSnapChange={setSnap} label="Masjid results">
        {selected ? (
          <SelectedMasjid
            masjid={selected.masjid}
            km={selected.km}
            date={date}
            favourite={isFavourite(selected.masjid.id)}
            onToggleFavourite={() => toggle(selected.masjid.id)}
            // Jumu'ah sits in Dhuhr's column of the five-up grid.
            currentPrayer={prayer === "jumuah" ? "dhuhr" : prayer}
          />
        ) : (
          <>
            <p className="px-4 pb-2 text-meta text-ink-3" aria-live="polite">
              {rows.length} masjid{rows.length === 1 ? "" : "s"} nearby ·{" "}
              {prayerLabel(prayer)} adhan{" "}
              {rows[0] ? formatTime(rows[0].adhan) : "—"}
              {congregation.isTomorrow ? " tomorrow" : ""}
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
                      ? formatRelative((row.iqamah.getTime() - minute.getTime()) / 60_000)
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
                {iqamah[p] ? formatTimeShort(iqamah[p]!) : "—"}
              </span>
              <span className="block font-num text-[11px] text-ink-3">
                {formatTimeShort(adhan[p])}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-1 text-meta text-ink-3">
        Iqamah on top, adhan beneath. Morning times are AM, the rest PM.
      </p>

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
        "flex min-h-11 shrink-0 items-center rounded-full border px-3 text-meta font-medium backdrop-blur-xl " +
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

/**
 * Stacking order for overlapping pills: selected on top, then soonest first.
 *
 * Pins in a dense area cover each other, and the one worth reading is the
 * congregation you can still get to, not whichever masjid happens to sit
 * lowest on the map.
 */
function zIndexFor(selected: boolean, at: Date | null): number {
  if (selected) return 1_000_000;
  if (!at) return 0;
  // Nearer in time wins; minutes-from-epoch descending keeps it monotonic.
  return Math.max(1, 900_000 - Math.floor(at.getTime() / 60_000) / 1000);
}

