import { forwardRef, useEffect, useMemo, useRef, useState } from "react";

import PrayerTimeRow from "../components/PrayerTimeRow";
import { formatDistance, haversineKm } from "../lib/distance";
import { googleMapsConfigured, loadGoogleMaps } from "../lib/googleMaps";
import type { ReferencePoint } from "../lib/location";
import { adhanTimes, iqamahTimes } from "../lib/prayer";
import { masjidPath } from "../lib/route";
import { formatIsoDate } from "../lib/time";
import type { Masjid } from "../lib/types";

/** A pin as an SVG data URI — no icon files to ship, no extra request. */
function pinIcon(selected: boolean): google.maps.Icon {
  const fill = selected ? "#b45309" : "#047857";
  const svg = `<svg width="26" height="34" viewBox="0 0 26 34" xmlns="http://www.w3.org/2000/svg">
    <path d="M13 0C5.82 0 0 5.82 0 13c0 9.75 13 21 13 21s13-11.25 13-21C26 5.82 20.18 0 13 0z" fill="${fill}"/>
    <circle cx="13" cy="13" r="4.75" fill="#fff"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(26, 34),
    anchor: new google.maps.Point(13, 34),
  };
}

// A function, not a module-level constant: `google` doesn't exist until the
// script has loaded, and this module is evaluated the moment the map route
// is opened — well before that.
function meIcon(): google.maps.Icon {
  const svg = `<svg width="16" height="16" viewBox="0 0 16 16" xmlns="http://www.w3.org/2000/svg">
    <circle cx="8" cy="8" r="7" fill="#2563eb" fill-opacity="0.25"/>
    <circle cx="8" cy="8" r="5" fill="#2563eb" stroke="#fff" stroke-width="1.5"/>
  </svg>`;
  return {
    url: "data:image/svg+xml;charset=UTF-8," + encodeURIComponent(svg),
    scaledSize: new google.maps.Size(16, 16),
    anchor: new google.maps.Point(8, 8),
  };
}

type MapStatus = "unconfigured" | "loading" | "ready" | "error";

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
  const map = useRef<google.maps.Map | null>(null);
  const infoWindow = useRef<google.maps.InfoWindow | null>(null);
  const markers = useRef<google.maps.Marker[]>([]);
  const me = useRef<google.maps.Marker | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mapStatus, setMapStatus] = useState<MapStatus>(
    googleMapsConfigured ? "loading" : "unconfigured",
  );

  const { point, label, status, useDeviceLocation } = reference;
  const locating = status === "locating";
  const onDevice = status === "active";
  const ready = mapStatus === "ready";

  // The freshest reference point, for the map-creation effect — which runs
  // once and would otherwise close over a stale first-render value. On a
  // revisit the location is already resolved, so this lets the map be born
  // centred correctly instead of on the downtown default.
  const pointRef = useRef(point);
  pointRef.current = point;

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

  // Load the script and create the map once. Google Maps owns this DOM node
  // outright, so React must never render children into it.
  useEffect(() => {
    if (!googleMapsConfigured || !holder.current || map.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !holder.current || map.current) return;

        const instance = new google.maps.Map(holder.current, {
          center: pointRef.current,
          zoom: 12,
          // A map inside a scrolling page shouldn't hijack the scroll on the
          // way past; a deliberate two-finger gesture or a tap still zooms —
          // Google's equivalent of Leaflet's scrollWheelZoom: false.
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        // Tapping bare map is the natural "never mind" for the open card.
        instance.addListener("click", () => setSelectedId(null));

        map.current = instance;
        infoWindow.current = new google.maps.InfoWindow();

        // Wait for the first render before declaring the map ready. Camera
        // moves (fitBounds) issued before that first `idle` are dropped by
        // the Maps API — which is exactly what stranded the very first visit
        // on the downtown default: geolocation resolved, but the recentre
        // fired too early to take. Since `ready` gates every camera move,
        // holding it until `idle` guarantees they all land.
        google.maps.event.addListenerOnce(instance, "idle", () => {
          if (!cancelled) setMapStatus("ready");
        });
      })
      .catch(() => {
        if (!cancelled) setMapStatus("error");
      });

    return () => {
      cancelled = true;
    };
    // point is the initial centre only — recentring is handled below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Tear the map down on unmount. The JS API has no destroy method; clearing
  // listeners and markers and letting the detached DOM node get garbage
  // collected is the documented approach.
  useEffect(() => {
    return () => {
      for (const marker of markers.current) marker.setMap(null);
      markers.current = [];
      me.current?.setMap(null);
      me.current = null;
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
      infoWindow.current = null;
    };
  }, []);

  // Redraw the pins when the list, the selection, or the distances change.
  useEffect(() => {
    const instance = map.current;
    const info = infoWindow.current;
    if (!ready || !instance) return;

    for (const marker of markers.current) marker.setMap(null);
    markers.current = nearest.map(({ masjid, km }) => {
      const marker = new google.maps.Marker({
        position: { lat: masjid.lat, lng: masjid.lng },
        map: instance,
        icon: pinIcon(masjid.id === selectedId),
        title: masjid.name,
        zIndex: masjid.id === selectedId ? 1000 : undefined,
      });

      marker.addListener("click", () => setSelectedId(masjid.id));
      marker.addListener("mouseover", () => {
        info?.setContent(`${masjid.name} · ${formatDistance(km)}`);
        info?.open({ map: instance, anchor: marker });
      });
      marker.addListener("mouseout", () => info?.close());

      return marker;
    });
  }, [ready, nearest, selectedId]);

  // Follow the reference point: drop the "you" marker and frame the masjids
  // worth walking to, rather than leaving the user to pan and find them.
  useEffect(() => {
    const instance = map.current;
    if (!ready || !instance) return;

    me.current?.setMap(null);
    me.current = onDevice
      ? new google.maps.Marker({
          position: point,
          map: instance,
          icon: meIcon(),
          title: "Your location",
          zIndex: 2000,
        })
      : null;

    const bounds = new google.maps.LatLngBounds();
    bounds.extend(point);
    for (const { masjid } of nearest.slice(0, 5)) {
      bounds.extend({ lat: masjid.lat, lng: masjid.lng });
    }

    // fitBounds has no maxZoom of its own — cap the zoom it lands on once,
    // or two nearby masjids fill the screen with nothing else to see.
    const capZoom = google.maps.event.addListenerOnce(
      instance,
      "bounds_changed",
      () => {
        const zoom = instance.getZoom();
        if (zoom != null && zoom > 15) instance.setZoom(15);
      },
    );
    instance.fitBounds(bounds, 40);

    return () => google.maps.event.removeListener(capZoom);
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

      <div className="relative mt-4">
        <div
          ref={holder}
          role="application"
          aria-label="Map of nearby masjids"
          className="h-[55vh] min-h-[320px] w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
        />

        {mapStatus === "unconfigured" && (
          <MapOverlay>
            The map isn&rsquo;t set up yet — it needs a Google Maps API key.
          </MapOverlay>
        )}
        {mapStatus === "loading" && <MapOverlay>Loading the map…</MapOverlay>}
        {mapStatus === "error" && (
          <MapOverlay>
            Couldn&rsquo;t load the map. The list below still works.
          </MapOverlay>
        )}
      </div>

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

function MapOverlay({ children }: { children: React.ReactNode }) {
  return (
    <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-xl bg-stone-100/90 p-6 text-center text-sm text-stone-600">
      {children}
    </div>
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
