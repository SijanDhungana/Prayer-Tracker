// @types/google.maps declares the `google` namespace but not that `window`
// carries it — the script tag below is what actually puts it there.
declare global {
  interface Window {
    google: typeof google;
  }
}

// Optional chaining because `import.meta.env` only exists under Vite — see
// supabase.ts, which this mirrors.
export const GOOGLE_MAPS_API_KEY =
  import.meta.env?.VITE_GOOGLE_MAPS_API_KEY ?? "";

/**
 * Whether the map has a key to work with. When false the map tab explains
 * what's missing instead of the times pages, which come from static JSON,
 * ever depending on it.
 */
export const googleMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY);

const SCRIPT_ID = "google-maps-js";

let loadPromise: Promise<typeof google> | null = null;

/**
 * Loads the Maps JavaScript API on demand via a script tag — there is no npm
 * package for the API itself, only typings. Cached so the map view mounting
 * twice (e.g. StrictMode) reuses one script tag and one promise.
 */
export function loadGoogleMaps(): Promise<typeof google> {
  if (!googleMapsConfigured) {
    return Promise.reject(new Error("Google Maps is not configured."));
  }

  loadPromise ??= new Promise((resolve, reject) => {
    if (window.google?.maps) {
      resolve(window.google);
      return;
    }

    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve(window.google));
      existing.addEventListener("error", () =>
        reject(new Error("Failed to load Google Maps.")),
      );
      return;
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.async = true;
    script.src =
      "https://maps.googleapis.com/maps/api/js?key=" +
      encodeURIComponent(GOOGLE_MAPS_API_KEY) +
      // `places` powers the destination autocomplete. Requesting it here
      // rather than lazily keeps it to one script fetch, and the app degrades
      // to plain typed addresses if the key can't use it.
      "&libraries=places&v=weekly&loading=async";
    script.onload = () => resolve(window.google);
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });

  return loadPromise;
}
