import { useCallback, useRef, useState } from "react";
import type { Point } from "./distance";

export interface Preset extends Point {
  id: string;
  label: string;
}

/**
 * Hardcoded neighbourhood centres — CLAUDE.md §9. The default is downtown
 * Toronto, so the app is fully useful before anyone is asked for location.
 */
export const PRESETS: Preset[] = [
  { id: "downtown", label: "Downtown Toronto", lat: 43.6532, lng: -79.3832 },
  { id: "scarborough", label: "Scarborough", lat: 43.7764, lng: -79.2318 },
  { id: "north-york", label: "North York", lat: 43.7615, lng: -79.4111 },
  { id: "etobicoke", label: "Etobicoke", lat: 43.6205, lng: -79.5132 },
  { id: "mississauga", label: "Mississauga", lat: 43.589, lng: -79.6441 },
];

export const DEFAULT_PRESET = PRESETS[0];

export type GeoStatus = "idle" | "locating" | "active" | "error";

/** How long to sit on "Locating…" before offering the button back. */
const WAIT_FOR_PERMISSION_MS = 15_000;

export interface ReferencePoint {
  point: Point;
  label: string;
  presetId: string;
  status: GeoStatus;
  error: string | null;
  selectPreset: (id: string) => void;
  useDeviceLocation: () => void;
}

/**
 * What to say when the browser won't give us a position.
 *
 * Design spec v2 §10.2: a denial is not an error, it is a fallback that
 * worked. The old copy ("Location permission denied.") was rendered as
 * persistent red text on every screen forever. These read as information,
 * are shown once in a toast, and never in red.
 */
function messageFor(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Using Downtown Toronto. Change it from the location chip.";
    case error.TIMEOUT:
      return "Couldn't find your location in time. Using Downtown Toronto.";
    default:
      return "Couldn't get your location. Using Downtown Toronto.";
  }
}

/**
 * The point distances are measured from. Geolocation is requested only when
 * `useDeviceLocation` is called from a click, never on load, and any failure
 * leaves the chosen preset in place — §9.
 */
export function useReferencePoint(): ReferencePoint {
  const [presetId, setPresetId] = useState(DEFAULT_PRESET.id);
  const [device, setDevice] = useState<Point | null>(null);
  const [status, setStatus] = useState<GeoStatus>("idle");
  const [error, setError] = useState<string | null>(null);

  const preset =
    PRESETS.find((p) => p.id === presetId) ?? DEFAULT_PRESET;

  // Identifies the newest request, so a stale callback can't overwrite a
  // choice the user has made since.
  const request = useRef(0);

  const selectPreset = useCallback((id: string) => {
    request.current += 1;
    setPresetId(id);
    setDevice(null);
    setStatus("idle");
    setError(null);
  }, []);

  const useDeviceLocation = useCallback(() => {
    if (!navigator.geolocation) {
      setStatus("error");
      setError("This browser can't share a location.");
      return;
    }

    const id = (request.current += 1);
    const current = () => request.current === id;

    setStatus("locating");
    setError(null);

    // getCurrentPosition's own `timeout` bounds acquiring a fix, not the
    // permission prompt — a prompt the user swipes away from calls back
    // neither way. Without this the button reads "Locating…" forever.
    const giveUp = window.setTimeout(() => {
      if (!current()) return;
      setStatus("error");
      setError(`Still waiting on location permission. Using ${preset.label}.`);
    }, WAIT_FOR_PERMISSION_MS);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        window.clearTimeout(giveUp);
        // Deliberately still accepted after the watchdog fired: someone who
        // grants permission late should get their location, not a dead end.
        if (!current()) return;
        setDevice({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("active");
        setError(null);
      },
      (err) => {
        window.clearTimeout(giveUp);
        if (!current()) return;
        setStatus("error");
        setError(`${messageFor(err)} Using ${preset.label}.`);
      },
      { timeout: 10_000, maximumAge: 300_000 },
    );
  }, [preset.label]);

  return {
    point: device ?? preset,
    label: device ? "My location" : preset.label,
    presetId,
    status,
    error,
    selectPreset,
    useDeviceLocation,
  };
}
