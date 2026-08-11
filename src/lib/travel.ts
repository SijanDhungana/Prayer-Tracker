/**
 * Google's half of trip planning: turning a typed destination into a point,
 * and points into traffic-aware drive times.
 *
 * Kept apart from tripPlan.ts on purpose — the scheduling rules there are
 * exact and testable offline, while everything here is a network call whose
 * answer changes minute to minute.
 */
import { haversineKm, type Point } from "./distance";
import { loadGoogleMaps } from "./googleMaps";
import type { Masjid } from "./types";

/** Bias geocoding toward the region the app actually covers. */
const REGION = "ca";

/** Autocomplete is limited to Canada — the whole country, for now. */
const REGION_CODES = ["ca"];

export interface PlaceSuggestion {
  id: string;
  /** Usually the business or building name. */
  primary: string;
  /** City, street — whatever distinguishes it from a namesake. */
  secondary: string;
  /** Carried so selecting it can resolve coordinates on the same session. */
  prediction: google.maps.places.PlacePrediction;
}

/**
 * A billing session for one destination lookup.
 *
 * Google charges autocomplete per session, not per keystroke: every request
 * sharing a token, plus the final details fetch, counts once. Typing
 * "Costco Overlea" without one would be billed as fifteen separate lookups.
 */
export async function newPlacesSession(): Promise<google.maps.places.AutocompleteSessionToken> {
  // Awaits the SDK: constructing this before the script has run throws, and
  // since it's the first thing a search does, that would stop the script ever
  // being fetched at all.
  await loadGoogleMaps();
  return new google.maps.places.AutocompleteSessionToken();
}

/**
 * Address suggestions for what's been typed so far.
 *
 * Throws when the key can't use Places; callers are expected to fall back to
 * a plain typed address rather than block the trip on it.
 */
export async function placeSuggestions(
  input: string,
  sessionToken: google.maps.places.AutocompleteSessionToken,
  bias?: Point,
): Promise<PlaceSuggestion[]> {
  await loadGoogleMaps();

  const { suggestions } =
    await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions(
      {
        input,
        sessionToken,
        includedRegionCodes: REGION_CODES,
        // Nudge results toward where the traveller is, so "Costco" offers the
        // nearby one first rather than one across the country.
        ...(bias
          ? { origin: new google.maps.LatLng(bias.lat, bias.lng) }
          : {}),
      },
    );

  return suggestions
    .map((suggestion) => suggestion.placePrediction)
    .filter((prediction): prediction is google.maps.places.PlacePrediction =>
      Boolean(prediction),
    )
    .map((prediction) => ({
      id: prediction.placeId,
      primary: prediction.mainText?.text ?? prediction.text.text,
      secondary: prediction.secondaryText?.text ?? "",
      prediction,
    }));
}

/**
 * Turn a chosen suggestion into coordinates, closing the billing session.
 * Cheaper and more exact than geocoding the text again.
 */
export async function resolveSuggestion(
  suggestion: PlaceSuggestion,
): Promise<GeocodeResult> {
  const place = suggestion.prediction.toPlace();
  await place.fetchFields({ fields: ["location", "formattedAddress"] });

  const location = place.location;
  if (!location) throw new Error("That place has no location on file.");

  return {
    point: { lat: location.lat(), lng: location.lng() },
    label:
      place.formattedAddress ??
      [suggestion.primary, suggestion.secondary].filter(Boolean).join(", "),
  };
}

export interface GeocodeResult {
  point: Point;
  /** Google's tidied-up version of what was typed. */
  label: string;
}

export async function geocode(query: string): Promise<GeocodeResult> {
  await loadGoogleMaps();
  const geocoder = new google.maps.Geocoder();

  const { results } = await geocoder.geocode({ address: query, region: REGION });
  const first = results[0];
  if (!first) throw new Error(`Couldn't find "${query}".`);

  return {
    point: {
      lat: first.geometry.location.lat(),
      lng: first.geometry.location.lng(),
    },
    label: first.formatted_address,
  };
}

/**
 * Shortest distance from a point to the origin→destination line, in km.
 *
 * Used to throw out masjids that are nowhere near the trip *before* spending
 * a paid call on them. Flat-earth maths, which over a city is accurate to
 * well within the slop of a corridor width.
 */
export function distanceFromCorridorKm(
  point: Point,
  from: Point,
  to: Point,
): number {
  // Local flat projection: degrees of longitude shrink with latitude.
  const midLat = ((from.lat + to.lat) / 2) * (Math.PI / 180);
  const kmPerDegLat = 110.574;
  const kmPerDegLng = 111.32 * Math.cos(midLat);

  const ax = from.lng * kmPerDegLng;
  const ay = from.lat * kmPerDegLat;
  const bx = to.lng * kmPerDegLng;
  const by = to.lat * kmPerDegLat;
  const px = point.lng * kmPerDegLng;
  const py = point.lat * kmPerDegLat;

  const dx = bx - ax;
  const dy = by - ay;
  const lengthSquared = dx * dx + dy * dy;

  // Degenerate trip (origin === destination): fall back to plain distance.
  if (lengthSquared === 0) return haversineKm(from, point);

  // Projection parameter, clamped so the "corridor" ends at the endpoints
  // rather than running past them.
  const t = Math.max(
    0,
    Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lengthSquared),
  );

  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/**
 * Masjids plausibly "on the way", nearest the route first.
 *
 * Two jobs: it's the cost control (a handful of candidates priced instead of
 * all eighteen) and it's what makes the results feel sane — a masjid 20 km
 * off the line is not a detour, it's a different trip.
 */
export function candidatesAlongRoute(
  masjids: Masjid[],
  from: Point,
  to: Point,
  corridorKm: number,
  limit: number,
): Masjid[] {
  return masjids
    .map((masjid) => ({
      masjid,
      offRoute: distanceFromCorridorKm(masjid, from, to),
    }))
    .filter((entry) => entry.offRoute <= corridorKm)
    .sort((a, b) => a.offRoute - b.offRoute)
    .slice(0, limit)
    .map((entry) => entry.masjid);
}

/** Minutes for each destination, or null where Google had no route. */
export type Durations = (number | null)[];

/**
 * Drive times from one origin to many destinations, in traffic.
 *
 * `departureTime` makes Google return `duration_in_traffic`; for the leg home
 * from the masjid that time is in the future, so it predicts rather than
 * measures. One request covers every destination, which is what keeps a
 * search to two paid calls no matter how many masjids are in range.
 */
export async function drivingMinutes(
  origin: Point,
  destinations: Point[],
  departureTime: Date,
): Promise<Durations> {
  if (destinations.length === 0) return [];
  await loadGoogleMaps();

  const service = new google.maps.DistanceMatrixService();
  const response = await service.getDistanceMatrix({
    origins: [origin],
    destinations,
    travelMode: google.maps.TravelMode.DRIVING,
    drivingOptions: {
      // Google rejects a departure time in the past; "now" is the floor.
      departureTime: departureTime > new Date() ? departureTime : new Date(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
  });

  const row = response.rows[0];
  if (!row) return destinations.map(() => null);

  return row.elements.map((element) => {
    if (element.status !== "OK") return null;
    // duration_in_traffic is absent outside driving mode or without a
    // departure time; plain duration is the honest fallback.
    const seconds = (element.duration_in_traffic ?? element.duration)?.value;
    return seconds == null ? null : seconds / 60;
  });
}

/** Drive times from many origins to a single destination. */
export async function drivingMinutesTo(
  origins: Point[],
  destination: Point,
  departureTime: Date,
): Promise<Durations> {
  if (origins.length === 0) return [];
  await loadGoogleMaps();

  const service = new google.maps.DistanceMatrixService();
  const response = await service.getDistanceMatrix({
    origins,
    destinations: [destination],
    travelMode: google.maps.TravelMode.DRIVING,
    drivingOptions: {
      departureTime: departureTime > new Date() ? departureTime : new Date(),
      trafficModel: google.maps.TrafficModel.BEST_GUESS,
    },
  });

  return origins.map((_, index) => {
    const element = response.rows[index]?.elements[0];
    if (!element || element.status !== "OK") return null;
    const seconds = (element.duration_in_traffic ?? element.duration)?.value;
    return seconds == null ? null : seconds / 60;
  });
}

/** A Google Maps URL for the whole trip, with the masjid as a waypoint. */
export function directionsUrl(
  origin: Point,
  masjid: Masjid,
  destination: Point,
): string {
  const params = new URLSearchParams({
    api: "1",
    origin: `${origin.lat},${origin.lng}`,
    destination: `${destination.lat},${destination.lng}`,
    waypoints: `${masjid.lat},${masjid.lng}`,
    travelmode: "driving",
  });
  return `https://www.google.com/maps/dir/?${params}`;
}
