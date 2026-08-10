import { forwardRef, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import PrayerTimeRow from "../components/PrayerTimeRow";
import { formatDistance, haversineKm } from "../lib/distance";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatIsoDate } from "../lib/time";
import type { Masjid } from "../lib/types";

/**
 * Leaflet's default marker points at PNGs by relative URL, which a bundler
 * rewrites out from under it. Drawing the pin inline sidesteps that and keeps
 * the map to one network dependency: the tiles.
 */
function pin(selected: boolean): L.DivIcon {
  const fill = selected ? "#b45309" : "#047857";
  return L.divIcon({
    className: "",
    html: `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
      <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill="${fill}"/>
      <circle cx="13" cy="13" r="4.75" fill="#fff"/>
    </svg>`,
    iconSize: [26, 34],
    iconAnchor: [13, 34],
  });
}

const ME_ICON = L.divIcon({
  className: "",
  html: `<span style="display:block;width:16px;height:16px;border-radius:9999px;background:#2563eb;box-shadow:0 0 0 4px rgba(37,99,235,.25),0 0 0 1.5px #fff inset"></span>`,
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

export default function MapView({
  masjids,
  date,
  reference,
}: {
  masjids: Masjid[];
  date: Date;
  reference: ReferencePoint;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pins = useRef<L.LayerGroup | null>(null);
  const me = useRef<L.Marker | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const { point, label, status, useDeviceLocation } = reference;
  const locating = status === "locating";
  const onDevice = status === "active";

  // The tap that opened the map is the click §9 asks for, so ask once on
  // arrival. A refusal is not an error state here — the preset still works.
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current || status !== "idle") return;
    asked.current = true;
    useDeviceLocation();
  }, [status, useDeviceLocation]);

  const nearest = useMemo(
    () =>
      masjids
        .map((masjid) => ({ masjid, km: haversineKm(point, masjid) }))
        .sort((a, b) => a.km - b.km),
    [masjids, point],
  );

  const selected = selectedId
    ? (nearest.find((n) => n.masjid.id === selectedId) ?? null)
    : null;

  // On a phone the card sits below the fold, so tapping a pin would otherwise
  // look like nothing happened.
  const card = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (selectedId) {
      card.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [selectedId]);

  // Create the map once. Leaflet owns this DOM node outright, so React must
  // never render children into it.
  useEffect(() => {
    if (!holder.current || map.current) return;

    const instance = L.map(holder.current, {
      center: [point.lat, point.lng],
      zoom: 12,
      zoomControl: true,
      // A map inside a scrolling page shouldn't hijack the scroll on the way
      // past; a deliberate two-finger gesture or a tap still zooms.
      scrollWheelZoom: false,
    });

    L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: "&copy; OpenStreetMap contributors",
    }).addTo(instance);

    // Tapping bare map is the natural "never mind" for the open card.
    instance.on("click", () => setSelectedId(null));

    map.current = instance;
    pins.current = L.layerGroup().addTo(instance);
    setReady(true);

    return () => {
      instance.remove();
      map.current = null;
      pins.current = null;
      me.current = null;
    };
    // point is the initial centre only — recentring is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Redraw the pins when the list, the selection, or the distances change.
  useEffect(() => {
    const layer = pins.current;
    if (!ready || !layer) return;

    layer.clearLayers();
    for (const { masjid, km } of nearest) {
      L.marker([masjid.lat, masjid.lng], {
        icon: pin(masjid.id === selectedId),
        title: masjid.name,
        alt: masjid.name,
        riseOnHover: true,
      })
        .on("click", () => setSelectedId(masjid.id))
        .bindTooltip(`${masjid.name} · ${formatDistance(km)}`, {
          direction: "top",
          offset: [0, -32],
        })
        .addTo(layer);
    }
  }, [ready, nearest, selectedId]);

  // Follow the reference point: drop the "you" marker and frame the masjids
  // worth walking to, rather than leaving the user to pan and find them.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    me.current?.remove();
    me.current = onDevice
      ? L.marker([point.lat, point.lng], {
          icon: ME_ICON,
          title: "Your location",
          zIndexOffset: 1000,
        }).addTo(instance)
      : null;

    const close = nearest.slice(0, 5).map(({ masjid }): L.LatLngTuple => [
      masjid.lat,
      masjid.lng,
    ]);

    instance.fitBounds(L.latLngBounds([[point.lat, point.lng], ...close]), {
      padding: [40, 40],
      maxZoom: 14,
    });
  }, [ready, onDevice, point.lat, point.lng, nearest]);

  return (
    <section>
      <h1 className="text-2xl font-semibold tracking-tight">Nearby</h1>
      {/* The picker above owns location control — repeating its button and its
          error here just gives the same choice two places to live. */}
      <p className="mt-1 text-sm text-stone-600">
        {locating
          ? "Finding your location…"
          : `Masjids around ${label}. Tap a pin for its times.`}
      </p>

      <div
        ref={holder}
        role="application"
        aria-label="Map of nearby masjids"
        className="mt-4 h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100 z-0"
      />

      {selected ? (
        <SelectedCard
          ref={card}
          masjid={selected.masjid}
          km={selected.km}
          date={date}
          onClose={() => setSelectedId(null)}
        />
      ) : (
        <ul className="mt-4 divide-y divide-stone-100 overflow-hidden rounded-xl border border-stone-200 bg-white">
          {nearest.slice(0, 5).map(({ masjid, km }) => (
            <li key={masjid.id}>
              <button
                type="button"
                onClick={() => setSelectedId(masjid.id)}
                className="flex w-full items-baseline justify-between gap-3 p-3.5 text-left hover:bg-stone-50"
              >
                <span className="min-w-0 truncate text-sm font-medium text-stone-900">
                  {masjid.name}
                </span>
                <span className="shrink-0 text-sm tabular-nums text-stone-500">
                  {formatDistance(km)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/** The point of the map: pick a pin, get that masjid's congregation times. */
const SelectedCard = forwardRef<
  HTMLDivElement,
  { masjid: Masjid; km: number; date: Date; onClose: () => void }
>(function SelectedCard({ masjid, km, date, onClose }, ref) {
  const adhan = adhanTimes(masjid, date);
  const iqamah = iqamahTimes(masjid, date);

  return (
    <div
      ref={ref}
      className="mt-4 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 className="min-w-0 text-base font-semibold text-stone-900">
          {masjid.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="shrink-0 text-sm font-medium text-stone-400 hover:text-stone-600"
        >
          ✕
        </button>
      </div>
      <p className="mt-1 text-sm text-stone-600">
        {formatDistance(km)} · {masjid.address}
      </p>

      <div className="mt-3 border-t border-stone-100 pt-3">
        <PrayerTimeRow iqamah={iqamah} adhan={adhan} />
        <p className="mt-2 text-[11px] text-stone-400">
          Iqamah in bold · adhan below
          {masjid.lastVerified &&
            ` · verified ${formatIsoDate(masjid.lastVerified)}`}
        </p>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm font-medium text-emerald-700">
        <a className="underline underline-offset-2" href={masjidPath(masjid.id)}>
          Full day →
        </a>
        <a
          className="underline underline-offset-2"
          href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(
            `${masjid.name}, ${masjid.address}`,
          )}`}
          target="_blank"
          rel="noreferrer"
        >
          Directions
        </a>
      </div>
    </div>
  );
});
