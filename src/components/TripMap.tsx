import { useEffect, useRef, useState } from "react";

import type { Point } from "../lib/distance";
import { loadGoogleMaps } from "../lib/googleMaps";
import type { Masjid } from "../lib/types";

/**
 * The chosen option drawn as a real route — origin to masjid to destination —
 * on a Google map, the way the trip will actually be driven.
 *
 * One Directions call per option viewed, so the route is only fetched for the
 * option the user is looking at, not for every candidate in the list.
 */
export default function TripMap({
  from,
  masjid,
  destination,
}: {
  from: Point;
  masjid: Masjid;
  destination: Point;
}) {
  const holder = useRef<HTMLDivElement>(null);
  const map = useRef<google.maps.Map | null>(null);
  const renderer = useRef<google.maps.DirectionsRenderer | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);

  // Create the map once. Google owns this node; React never renders into it.
  useEffect(() => {
    if (!holder.current || map.current) return;
    let cancelled = false;

    loadGoogleMaps()
      .then(() => {
        if (cancelled || !holder.current || map.current) return;

        const instance = new google.maps.Map(holder.current, {
          center: from,
          zoom: 11,
          gestureHandling: "cooperative",
          streetViewControl: false,
          mapTypeControl: false,
          fullscreenControl: false,
        });

        map.current = instance;
        renderer.current = new google.maps.DirectionsRenderer({
          map: instance,
        });

        // Camera moves issued before the first render are dropped (the map
        // view learned this the hard way), and the renderer's fitBounds is
        // exactly such a move — so wait for idle before routing.
        google.maps.event.addListenerOnce(instance, "idle", () => {
          if (!cancelled) setReady(true);
        });
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
    // Initial centre only; the route fit takes over from there.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    return () => {
      renderer.current?.setMap(null);
      renderer.current = null;
      if (map.current) google.maps.event.clearInstanceListeners(map.current);
      map.current = null;
    };
  }, []);

  // Route whenever the viewed option changes.
  useEffect(() => {
    if (!ready || !renderer.current) return;
    let cancelled = false;

    const service = new google.maps.DirectionsService();
    service
      .route({
        origin: from,
        destination,
        waypoints: [{ location: { lat: masjid.lat, lng: masjid.lng } }],
        travelMode: google.maps.TravelMode.DRIVING,
      })
      .then((result) => {
        if (!cancelled) renderer.current?.setDirections(result);
      })
      .catch(() => {
        // The card's numbers still stand; only the drawing is lost.
        if (!cancelled) setFailed(true);
      });

    return () => {
      cancelled = true;
    };
  }, [ready, from.lat, from.lng, masjid, destination.lat, destination.lng]);
  // masjid is in deps as an object: candidates are stable per plan run, and
  // the id is what actually varies between renders.

  if (failed) return null;

  return (
    <div
      ref={holder}
      role="application"
      aria-label={`Route via ${masjid.name}`}
      className="mt-4 h-72 w-full overflow-hidden rounded-xl border border-stone-200 bg-stone-100"
    />
  );
}
