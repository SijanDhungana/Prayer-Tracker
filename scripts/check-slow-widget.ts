import { createServer } from "node:http";
import { chromium } from "playwright";
import { capturePage, SETTLE_MAX_MS } from "../scrape.ts";

/**
 * Two ways a homepage that genuinely publishes its times still read as "no
 * times found", both found by hand-checking real masjids from the Ontario run
 * rather than guessed at:
 *
 *   1. The widget takes longer to paint than the scraper waited. capturePage
 *      used a flat five-second pause, so a widget that needed ten seconds was
 *      photographed as an empty placeholder.
 *
 *   2. The times are on the page but behind a control — a "Prayer Times" tab
 *      or accordion header — that is a <button>, not a link, so collecting
 *      a[href] never saw it and there was no page to follow.
 *
 * This proves both fixes against real pages served locally, rather than by
 * reading the code and assuming.
 */
const SLOW_MS = 7000;

// Nothing but a heading until the timer fires — exactly what a slow widget
// looks like to a screenshot taken too early.
const SLOW_PAGE = `<!doctype html><html><body>
  <h1>Slow widget masjid</h1>
  <div id="t">Loading…</div>
  <script>
    setTimeout(() => {
      document.getElementById("t").textContent =
        "Fajr 5:45 AM Dhuhr 1:45 PM Asr 6:00 PM Maghrib 8:05 PM Isha 9:45 PM";
    }, ${SLOW_MS});
  </script>
</body></html>`;

// Times exist immediately but are hidden behind a button, not a link.
const TAB_PAGE = `<!doctype html><html><body>
  <h1>Tabbed masjid</h1>
  <button id="b">Prayer Times</button>
  <div id="panel" style="display:none">
    Fajr 6:15 AM Dhuhr 1:30 PM Asr 5:45 PM Maghrib 8:01 PM Isha 9:30 PM
  </div>
  <script>
    document.getElementById("b").onclick = () => {
      document.getElementById("panel").style.display = "block";
    };
  </script>
</body></html>`;

// No times anywhere, and no control that claims to have any. Must not hang.
const EMPTY_PAGE = `<!doctype html><html><body>
  <h1>Nothing here</h1><p>Contact us for details.</p>
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
    if (req.url === "/tab") res.end(TAB_PAGE);
    else if (req.url === "/empty") res.end(EMPTY_PAGE);
    else res.end(SLOW_PAGE);
  });
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const { port } = server.address() as { port: number };
  const base = `http://127.0.0.1:${port}`;

  const browser = await chromium.launch();
  try {
    // 1. A widget slower than the old fixed five-second wait.
    const slow = await capturePage(browser, `${base}/slow`);
    check("the slow page was captured", slow != null);
    if (slow) {
      check(
        `times that appear after ${SLOW_MS}ms are captured, not missed`,
        slow.text.includes("Fajr 5:45 AM"),
        `got: ${slow.text.replace(/\s+/g, " ").slice(0, 120)}`,
      );
      check(
        "the slow page reads as a real timetable",
        slow.signals.prayers >= 4 && slow.signals.times >= 5,
        `prayers=${slow.signals.prayers} times=${slow.signals.times}`,
      );
    }

    // 2. Times behind a button rather than a link.
    const tab = await capturePage(browser, `${base}/tab`);
    check("the tabbed page was captured", tab != null);
    if (tab) {
      check(
        "times hidden behind a button are revealed by clicking it",
        tab.text.includes("Fajr 6:15 AM"),
        `got: ${tab.text.replace(/\s+/g, " ").slice(0, 120)}`,
      );
    }

    // 3. A page with genuinely nothing must give up, not spin forever.
    const startedAt = Date.now();
    const empty = await capturePage(browser, `${base}/empty`);
    const elapsed = Date.now() - startedAt;
    check("a page with no times still returns a capture", empty != null);
    check(
      `giving up is bounded (${elapsed}ms, ceiling ${SETTLE_MAX_MS}ms + click retry)`,
      elapsed < SETTLE_MAX_MS * 2 + 8000,
      `took ${elapsed}ms`,
    );
    if (empty) {
      check(
        "a page with no times is not mistaken for one that has them",
        !(empty.signals.prayers >= 4 && empty.signals.times >= 5),
        `prayers=${empty.signals.prayers} times=${empty.signals.times}`,
      );
    }
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failed === 0 ? "\nall passed" : `\n${failed} failed`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
