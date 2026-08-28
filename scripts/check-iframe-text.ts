import { createServer } from "node:http";
import { chromium } from "playwright";
import { capturePage } from "../scrape.ts";

/**
 * Some prayer-time widgets — Masjidal's among them, per McKinney Islamic
 * Association's real homepage — are embedded as an iframe, and
 * `page.innerText("body")` only ever reads the main document. A masjid whose
 * times are genuinely, visibly on the page still read as "no times found"
 * until capturePage also read every frame, not just the top one. This proves
 * that mechanism actually works, against a real (if minimal) page rather
 * than by inspecting the code and assuming.
 */
const MAIN_PAGE = `<!doctype html><html><body>
  <h1>Welcome to the masjid</h1>
  <iframe src="/widget"></iframe>
</body></html>`;

// The text a real Masjidal-style widget would render inside its iframe.
const WIDGET_PAGE = `<!doctype html><html><body>
  <div>Fajr 5:45 AM &middot; Dhuhr 1:45 PM &middot; Asr 6:00 PM</div>
</body></html>`;

let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok && detail) console.log(`    ${detail}`);
};

async function main() {
  const server = createServer((req, res) => {
    res.writeHead(200, { "content-type": "text/html" });
    res.end(req.url === "/widget" ? WIDGET_PAGE : MAIN_PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };

  const browser = await chromium.launch();
  try {
    const capture = await capturePage(browser, `http://127.0.0.1:${port}/`);

    check("the page was captured at all", capture != null);
    if (!capture) return;

    check(
      "the main document's own text is still present",
      capture.text.includes("Welcome to the masjid"),
      `got: ${capture.text}`,
    );

    check(
      "text from inside the iframe is present too",
      capture.text.includes("Fajr 5:45 AM"),
      `got: ${capture.text}`,
    );

    check(
      "iframe content reads as real prayer-time text",
      capture.signals.prayers >= 2 && capture.signals.times >= 2,
      `signals: ${JSON.stringify(capture.signals)}`,
    );
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
