import { createServer } from "node:http";
import { chromium } from "playwright";
import { capturePage, mapMawaqitMosque, WIDGET_FEEDS, MAWAQIT_SLUG } from "../scrape.ts";

/**
 * Both 2026-08-31 audits found the same thing in two provinces: most entries
 * labelled "no times found" do publish times, inside a widget whose host
 * serves the same data as static text. This proves the three mechanisms that
 * close that gap actually work — that a widget iframe is turned into its
 * host's static URL, that a cross-host link survives the same-origin filter
 * that used to drop it, and that Mawaqit's API shape is read correctly.
 */
let failed = 0;
const check = (name: string, ok: boolean, detail?: string) => {
  if (!ok) failed++;
  console.log(`${ok ? "✓" : "✗"} ${name}`);
  if (!ok && detail) console.log(`    ${detail}`);
};

/** src as it appears in a real embed, and the static URL it should become. */
const EMBEDS: [string, string][] = [
  ["https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=pQKMEGKB",
   "https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=pQKMEGKB"],
  ["https://masjidbox.com/prayer-times/troid?date=2026-08-31",
   "https://masjidbox.com/prayer-times/troid"],
  ["https://themasjidapp.org/brantford", "https://themasjidapp.org/brantford/prayers"],
  ["https://www.prayertimedisplay.com/ptdp/ldt.php?masjid=MAS001",
   "https://www.prayertimedisplay.com/ptdp/ldt.php?masjid=MAS001"],
];

function resolve(src: string): string | null {
  for (const feed of WIDGET_FEEDS) {
    if (!feed.host.test(src)) continue;
    const m = feed.from.exec(src);
    if (m) return feed.to(m[1]);
  }
  return null;
}

async function main() {
  for (const [src, want] of EMBEDS) {
    const got = resolve(src);
    check(`${new URL(src).host} embed resolves to its static feed`, got === want,
      `got ${got}`);
  }

  check("a mawaqit embed yields its slug",
    MAWAQIT_SLUG.exec("https://mawaqit.net/en/w/belleville-masjid")?.[1] === "belleville-masjid");

  // An unrelated iframe must not be mistaken for a timetable feed.
  check("a non-widget iframe is ignored",
    resolve("https://www.youtube.com/embed/abc123") === null);

  // Mawaqit returns adhan plus per-prayer iqamah offsets in minutes.
  const mapped = mapMawaqitMosque({
    times: ["05:07", "06:40", "13:10", "16:53", "19:47", "21:12"],
    iqamaCalendar: ["+23", "+35", "+37", "+5", "+18"],
    jumua: "13:30",
  });
  check("mawaqit sunrise is dropped, not read as a prayer",
    mapped?.iqamah.dhuhr === "13:45", `dhuhr ${mapped?.iqamah.dhuhr}`);
  check("mawaqit iqamah offsets are added to the adhan",
    mapped?.iqamah.fajr === "05:30" && mapped?.iqamah.maghrib === "19:52",
    `fajr ${mapped?.iqamah.fajr}, maghrib ${mapped?.iqamah.maghrib}`);
  check("mawaqit jumu'ah is carried through", mapped?.jumuah[0] === "13:30");
  check("a mawaqit response with no times is refused, not half-read",
    mapMawaqitMosque({ times: [] }) === null);

  // The same-origin filter used to discard a cross-host redirect's own links.
  let servedPort = 0;
  const server = createServer((req, res) => {
    if (req.url === "/") {
      res.writeHead(302, { location: `http://127.0.0.1:${servedPort}/moved` });
      return res.end();
    }
    res.writeHead(200, { "content-type": "text/html" });
    res.end(`<!doctype html><html><body><h1>Masjid</h1>
      <a href="http://127.0.0.1:${servedPort}/prayer-times">Prayer Times</a>
      <iframe src="https://masjidbox.com/prayer-times/example-masjid"></iframe>
    </body></html>`);
  });
  await new Promise<void>((r) => server.listen(0, "127.0.0.1", r));
  const { port } = server.address() as { port: number };
  servedPort = port;
  const browser = await chromium.launch();
  try {
    const capture = await capturePage(browser, `http://127.0.0.1:${port}/`);
    check("a page reached through a redirect still yields its own times link",
      !!capture && capture.timesLinks.some((l) => l.endsWith("/prayer-times")),
      `links: ${JSON.stringify(capture?.timesLinks)}`);
    check("an embedded widget becomes a static feed URL",
      !!capture && capture.feedLinks.includes("https://masjidbox.com/prayer-times/example-masjid"),
      `feeds: ${JSON.stringify(capture?.feedLinks)}`);
  } finally {
    await browser.close();
    server.close();
  }

  console.log(failed ? `\n${failed} failed` : "\nall passed");
  process.exit(failed ? 1 : 0);
}
main();
