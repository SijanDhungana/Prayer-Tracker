import { useCallback, useState } from "react";
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

export interface ReferencePoint {
  point: Point;
  label: string;
  presetId: string;
  status: GeoStatus;
  error: string | null;
  selectPreset: (id: string) => void;
  useDeviceLocation: () => void;
}

function messageFor(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return "Location permission denied.";
    case error.TIMEOUT:
      return "Timed out finding your location.";
    default:
      return "Couldn't get your location.";
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

  const selectPreset = useCallback((id: string) => {
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

    setStatus("locating");
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setDevice({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
        setStatus("active");
      },
      (err) => {
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
