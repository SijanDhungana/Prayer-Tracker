export interface Point {
  lat: number;
  lng: number;
}

const EARTH_RADIUS_KM = 6371;
const toRadians = (degrees: number) => (degrees * Math.PI) / 180;

/** Great-circle distance in kilometres. */
export function haversineKm(from: Point, to: Point): number {
  const dLat = toRadians(to.lat - from.lat);
  const dLng = toRadians(to.lng - from.lng);

  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(from.lat)) *
      Math.cos(toRadians(to.lat)) *
      Math.sin(dLng / 2) ** 2;

  return 2 * EARTH_RADIUS_KM * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** "700 m", "4.2 km", "18 km" — precision that matches how far away it is. */
export function formatDistance(km: number): string {
  if (km < 0.995) return `${Math.round(km * 1000)} m`;
  // Rounded before the threshold check, so 9.96 reads "10 km", not "10.0 km".
  if (Number(km.toFixed(1)) < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km)} km`;
}
