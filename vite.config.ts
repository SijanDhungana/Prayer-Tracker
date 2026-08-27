import { readFileSync } from "node:fs";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

/**
 * Publish the masjid directory as a fetchable file, not only as bundled JS.
 *
 * The app imports src/data/masjids.json at build time, which is right for the
 * first paint and for working offline — but it means the times are frozen into
 * whatever build is installed. On the web that is invisible, because the daily
 * scrape triggers a redeploy. Packaged as a native app it would be fatal: every
 * scrape would need an App Store release to reach anyone, so the times shown
 * would be stale by days at best.
 *
 * Emitting the same file as a static asset lets a shipped app fetch today's
 * times from the deployment while still holding a working copy of its own. One
 * source file, two outputs, so the two can never drift.
 */
function publishMasjidData(): Plugin {
  const SOURCE = "src/data/masjids.json";

  return {
    name: "publish-masjid-data",
    generateBundle() {
      const source = readFileSync(SOURCE, "utf8");
      // Parsed purely to fail the build on malformed JSON rather than ship it.
      JSON.parse(source);
      this.emitFile({ type: "asset", fileName: "masjids.json", source });
    },
  };
}

export default defineConfig({
  plugins: [react(), tailwindcss(), publishMasjidData()],
});
