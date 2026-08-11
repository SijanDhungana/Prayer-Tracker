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

  loadPromise ??= injectScript().then(async () => {
    /**
     * The script tag firing `load` is NOT the same as the API being usable.
     *
     * With `loading=async` — which Google now requires to avoid a console
     * warning — the bootstrap returns early and hands back a `google.maps`
     * object carrying little more than `importLibrary`. Constructing a
     * `google.maps.Map` at that moment throws, which is exactly what put the
     * map tab into "Couldn't load the map" on first open: the throw landed in
     * the caller's catch and was reported as a load failure.
     *
     * Awaiting the libraries is the documented contract for async loading,
     * and it is what makes the map appear on the first tap rather than the
     * second.
     */
    await Promise.all([
      google.maps.importLibrary("maps"),
      // Legacy `google.maps.Marker` lives here; the pins use it.
      google.maps.importLibrary("marker"),
    ]);
    return window.google;
  });

  // A cached rejection would be permanent: one flaky network moment on the
  // first tap and the map tab could never recover without a page reload.
  // Dropping the cache on failure lets the next mount try again.
  return loadPromise.catch((error: unknown) => {
    loadPromise = null;
    throw error;
  });
}

function injectScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    // A loaded bootstrap leaves `importLibrary` on google.maps. The typings
    // declare it as always present, so the check is written against the
    // runtime object rather than the type.
    if (typeof window.google?.maps?.importLibrary === "function") {
      resolve();
      return;
    }

    const existing = document.getElementById(
      SCRIPT_ID,
    ) as HTMLScriptElement | null;
    if (existing) {
      existing.addEventListener("load", () => resolve());
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
      // `places` powers the address autocomplete. Requesting it here rather
      // than lazily keeps it to one script fetch, and the app degrades to
      // plain typed addresses if the key can't use it.
      "&libraries=places&v=weekly&loading=async";
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
}
