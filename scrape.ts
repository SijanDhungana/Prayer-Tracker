/**
 * scrape.ts — daily masjid prayer-time scraper
 *
 * Strategy (works for plain HTML, JS widgets, AND image schedules):
 *   1. Render each masjid's site in a real browser (Playwright), so widget
 *      JavaScript runs and the times actually appear on the page.
 *   2. Find the element on the page that actually holds the timetable, and
 *      capture the page's text plus a screenshot OF THAT ELEMENT.
 *   3. Ask Claude to read the times, treating the TEXT as the source of truth
 *      and the picture as a fallback for times drawn as an image.
 *   4. Validate, then merge into masjids.json. If a site fails or the result
 *      looks low-confidence, keep the previous value and flag it for review —
 *      never overwrite good data with garbage. Wrong times matter here.
 *
 * Why an element and not the whole page: a full-page screenshot of a masjid
 * homepage is around 1280x5000, and vision downscales the long edge to 2576,
 * which halves the width too — 20px times become 9px and unreadable. Cropping
 * to the timetable keeps it legible, and reading the DOM text first means the
 * picture rarely has to carry the answer at all.
 *
 * Run locally:  ANTHROPIC_API_KEY=... npx tsx scrape.ts
 * Runs daily via .github/workflows/daily-scrape.yml
 *
 * Model + SDK reference: https://docs.claude.com/en/api/overview
 */

import { chromium, type Browser, type Page } from "playwright";
import Anthropic from "@anthropic-ai/sdk";
import { readFile, writeFile } from "node:fs/promises";
import { basename } from "node:path";
import {
  PRAYERS,
  adhanMinutesFor,
  clockMinutes,
  isTime,
  jumuahIsPlausible,
  torontoToday,
  type IqamahRule,
  type Masjid,
} from "./scripts/prayer-invariant";

// Swap to "claude-haiku-4-5-20251001" to cut cost; confirm the current id at
// https://docs.claude.com/en/docs/about-claude/models
const MODEL = "claude-sonnet-5";
// Overridable so the crawl can be exercised against local fixtures without
// touching the real directory, the same way discover.ts and geocode.ts work.
const DATA_FILE = process.env.SCRAPE_DATA ?? "./src/data/masjids.json";
export const POLITE_DELAY_MS = 3000; // be kind to masjid servers between requests

const anthropic = new Anthropic(); // reads ANTHROPIC_API_KEY from env

const EXTRACTION_PROMPT = `You are reading a mosque (masjid) website to extract today's prayer times.

You are given the page's visible TEXT and a SCREENSHOT of the part of the page
that appears to hold the timetable.

The TEXT is your primary source. It is exactly what the page says, character for
character, and a rendered widget's output lands in it once the JavaScript has
run. Read the times out of the text whenever they are there.

Use the SCREENSHOT only for what the text cannot tell you: times drawn inside an
image, or a table whose column alignment is lost when the text is flattened. If
the screenshot is small, blurry, or shows something other than a timetable,
ignore it — it is a fallback, not a check on the text. Where the two disagree
and the text is unambiguous, the text wins.

Return ONLY a JSON object, no prose, no markdown fences, with this exact shape:
{
  "found": boolean,              // true only if you clearly see prayer times
  "confidence": number,          // 0-1, how sure you are
  "iqamah": {                    // congregation times, 24h "HH:mm". null if not shown.
    "fajr": "HH:mm" | null,
    "dhuhr": "HH:mm" | null,
    "asr": "HH:mm" | null,
    "maghrib": "HH:mm" | null,
    "isha": "HH:mm" | null
  },
  "jumuah": ["HH:mm", ...]        // every Friday khutbah time, may be empty
}
Rules:
- Iqamah = the congregation/jamaah time, NOT the athan/adhan/"begins" time. If both
  are shown, take the iqamah column.
- CONVERT TO 24-HOUR TIME. Masjid schedules usually omit am/pm. Use these facts:
  Fajr is before sunrise (03:00-07:00). Dhuhr, Asr, Maghrib and Isha are ALL in the
  afternoon or evening — every one of them is 12:00 or later in 24-hour time, and
  they run in ascending order. So a Dhuhr shown as "1:45" is 13:45, an Asr shown as
  "7:00" is 19:00, a Maghrib shown as "8:30" is 20:30, an Isha shown as "10:25" is
  22:25. Never return 01:45 for Dhuhr or 08:30 for Maghrib.
- Jummah/Friday khutbah is a midday prayer: always between 11:00 and 17:00 in
  24-hour time. A Jummah shown as "1:50" is 13:50, never 01:50.
- MANY MASJIDS HOLD MORE THAN ONE JUMMAH. Two, three, even four sittings are
  normal where space is tight. List EVERY one, in the order they happen. They
  are often labelled "1st Jummah"/"2nd Jummah", "First Shift"/"Second Shift",
  "Jummah 1"/"Jummah 2", or just given as several times in a row. Returning
  only the first when the page shows several is a mistake — someone who cannot
  make the early sitting needs the later one.
- Jummah is often NOT in the daily timetable. Look for it in its own box,
  banner, heading or sidebar elsewhere on the page, and include what you find
  there even if the daily table has no Friday column.
- If a sitting lists both a khutbah/bayan time and a salah/iqamah time, take
  the KHUTBAH time — that is when someone needs to be in the building.
- Do not return the same Jummah time twice, and do not pad the list out with
  weekday Dhuhr. If the page shows exactly one Jummah, return exactly one.
- If a time is genuinely not on the page, use null. Do not guess.
- If you cannot find prayer times at all, return found=false and all nulls.`;

/** Anchor text or href that suggests a page carries a prayer timetable. */
const TIMES_LINK =
  /prayer|salah|salaah|salat|namaz|iqamah|iqama|jamaah|timing|timetable|times|schedule/i;

/** At most this many pages per masjid, so discovery stays cheap and polite. */
export const MAX_PAGES_PER_MASJID = 3;

/**
 * Widget hosts that serve a masjid's timetable as static text.
 *
 * Masjids embed these as an iframe, and the times then exist only inside a
 * document a text scrape of the parent page never sees — which is why both
 * the Ontario and Texas audits found dozens of "no times found" entries that
 * do publish times. Each host below has a URL that returns the timetable
 * without any JavaScript, given the id or slug that is already sitting in the
 * iframe's src. Reading that is cheaper and more reliable than photographing
 * a widget and hoping it painted.
 *
 * `from` pulls the identifier out of an iframe src; `to` builds the static URL.
 */
export const WIDGET_FEEDS: { host: RegExp; from: RegExp; to: (id: string) => string }[] = [
  {
    host: /athanplus\.com/i,
    from: /masjid_id=([A-Za-z0-9]+)/,
    to: (id) => `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=${id}`,
  },
  {
    host: /masjidbox\.com/i,
    from: /masjidbox\.com\/(?:prayer-times|embed)\/([A-Za-z0-9._-]+)/,
    to: (id) => `https://masjidbox.com/prayer-times/${id}`,
  },
  {
    host: /themasjidapp\.(org|net)/i,
    from: /themasjidapp\.(?:org|net)\/([A-Za-z0-9._/-]+?)(?:\/prayers)?(?:[?#]|$)/,
    to: (id) => `https://themasjidapp.org/${id}/prayers`,
  },
  {
    host: /mohid\.co/i,
    from: /(us\.mohid\.co\/[A-Za-z0-9._/-]+)/,
    to: (p) => `https://${p.replace(/\/$/, "")}/masjid/widget/api/index/?m=prayertimings`,
  },
  {
    host: /prayertimedisplay\.com/i,
    from: /masjid=([A-Za-z0-9]+)/,
    to: (id) => `https://www.prayertimedisplay.com/ptdp/ldt.php?masjid=${id}`,
  },
];

/**
 * Mawaqit's HTML resists every JavaScript-free fetch, including its own
 * `/w/` widget path — but its REST API is open and returns today's times as
 * JSON. Belleville proved it still answers even when the mosque's display is
 * flagged Offline, so this is strictly better than rendering the page.
 */
export const MAWAQIT_SLUG = /mawaqit\.net\/[a-z]{2}\/(?:w\/)?([A-Za-z0-9._-]+)/i;

/** Paths a masjid's timetable commonly sits at when the homepage has none. */
export const TIMES_PATHS = [
  "/prayer-times/", "/prayer-timings/", "/prayertimes/", "/prayer-schedule/",
  "/prayers/", "/salah-times/", "/monthly-prayer-timings/", "/timetable/",
];

/** Words that only appear near a prayer timetable. */
const PRAYER_WORD =
  /\b(fajr|fajir|dhuhr|zuhr|duhur|dhuher|asr|maghrib|magrib|isha|esha|ishaa|jum[ua]{1,2}h?|iqamah?|jama'?ah)\b/gi;

/** "5:20", "5:20 AM", "13:45" — the shape of a time on a schedule. */
const TIME_TOKEN = /\b\d{1,2}\s*[:.]\s*\d{2}\s*(?:[ap]\.?m\.?)?/gi;

/** Signs the page is a bot wall rather than the masjid's own content. */
const CHALLENGE = /captcha|are you a robot|checking your browser|cf-browser-verification|access denied|attention required/i;

/** Below this the crop is a stray badge, not a timetable. */
const MIN_TIMES_IN_ELEMENT = 3;
const MIN_PRAYERS_IN_ELEMENT = 3;

interface Capture {
  screenshot: Buffer;
  text: string;
  /**
   * Static-text URLs for the widget hosts embedded on the page. A widget's
   * own host will serve its timetable as plain text at a predictable URL once
   * the masjid id or slug is pulled out of the iframe, so these are worth far
   * more than another screenshot of the same widget failing to render.
   */
  feedLinks: string[];
  /** Same-origin links whose text or href looks like a timetable page. */
  timesLinks: string[];
  /** How the picture was taken — reported so a bad read can be explained. */
  shot: "timetable element" | "viewport";
  /** Pixel size of the image actually sent, for the downscaling problem. */
  shotSize: { width: number; height: number };
  /** Distinct prayer names and time tokens visible in the page text. */
  signals: { prayers: number; times: number };
}

/** How many prayer names and clock times a blob of text contains. */
export function textSignals(text: string): { prayers: number; times: number } {
  const prayers = new Set(
    (text.match(PRAYER_WORD) ?? []).map((w) => w.toLowerCase()),
  );
  return { prayers: prayers.size, times: (text.match(TIME_TOKEN) ?? []).length };
}

/**
 * Whether the page text alone plausibly carries a timetable.
 *
 * Used to decide against wandering off to a "Prayer Times" subpage when the
 * homepage already has what we need — those subpages are usually month-long
 * grids, which are harder to read, not easier.
 */
export function hasTimetableText(text: string): boolean {
  const { prayers, times } = textSignals(text);
  return prayers >= 4 && times >= 5;
}

/** Floor: below this even a fast widget has not painted. */
export const SETTLE_MIN_MS = 2500;
/** Ceiling: past this a page is not slow, it has nothing to show. */
export const SETTLE_MAX_MS = 12000;
const SETTLE_POLL_MS = 750;

/**
 * Read every document on the page — the main one plus any iframe — as one blob.
 * A widget's times commonly live in a cross-origin frame that
 * page.innerText("body") cannot see; Frame.innerText() reads it anyway because
 * it works at the automation-protocol level rather than as JS inside the page.
 */
async function allFrameText(page: Page): Promise<string> {
  const frames = await Promise.all(
    page
      .frames()
      .filter((frame) => frame !== page.mainFrame())
      .map((frame) => frame.innerText("body").catch(() => "")),
  );
  const main = await page.innerText("body").catch(() => "");
  return [main, ...frames].filter(Boolean).join("\n\n");
}

/**
 * Wait for a timetable to actually appear, instead of assuming one fixed pause
 * is enough for every site.
 *
 * This used to be a flat five seconds. That silently lost real masjids: several
 * sites in the Ontario run reported "no times found" whose homepages do publish
 * their times — the widget simply had not painted yet when the screenshot was
 * taken, and we photographed an empty placeholder. Checked by hand afterwards,
 * the times were right there.
 *
 * So poll instead, and stop the moment the times are on screen. A fast site
 * still costs ~2.5s rather than a flat 5, which buys back most of what the
 * slower ceiling spends across a 160-site run. Reaching the ceiling is not
 * treated as failure: the capture proceeds and Claude still reads the
 * screenshot, since a page can render times as an image this text check cannot
 * see.
 */
async function settleForTimetable(page: Page): Promise<void> {
  await page.waitForTimeout(SETTLE_MIN_MS);

  const deadline = Date.now() + (SETTLE_MAX_MS - SETTLE_MIN_MS);
  while (Date.now() < deadline) {
    if (hasTimetableText(await allFrameText(page))) return;
    await page.waitForTimeout(SETTLE_POLL_MS);
  }
}

/**
 * Some homepages do carry their times, behind a control that is not a link:
 * a "Prayer Times" tab, an accordion header, a <button> that swaps a panel.
 * Collecting `a[href]` never sees those, and following a link goes to the
 * wrong page or nowhere, so the read came back empty from a page that was
 * showing the times one click away.
 *
 * Click the first thing that names itself after prayer times and re-check.
 * Deliberately conservative: only when nothing has rendered yet, only visible
 * controls, at most a couple of tries, and a click that navigates is fine
 * since everything downstream re-reads the page afterwards either way.
 */
async function revealByClick(page: Page): Promise<void> {
  const candidates = page
    .locator('button, summary, [role="button"], [role="tab"], a:not([href])')
    .filter({ hasText: TIMES_LINK });

  const count = await candidates.count().catch(() => 0);
  for (let i = 0; i < Math.min(count, 2); i++) {
    const control = candidates.nth(i);
    if (!(await control.isVisible().catch(() => false))) continue;

    // A control can be covered, disabled, or detach mid-click; none of that is
    // worth failing the capture over, since the page is still readable as-is.
    await control.click({ timeout: 3000 }).catch(() => {});
    await settleForTimetable(page);
    if (hasTimetableText(await allFrameText(page))) return;
  }
}

/**
 * Tag the smallest element that looks like a timetable, so it can be cropped to.
 *
 * Runs in the page. Scores every element on how many distinct prayer names and
 * clock times its own text contains, then keeps the *smallest* qualifying one —
 * the tightest box around the schedule rather than the whole section wrapping
 * it. Returns whether anything was found.
 */
const TAG_TIMETABLE = `(() => {
  const PRAYER = /\\b(fajr|fajir|dhuhr|zuhr|duhur|dhuher|asr|maghrib|magrib|isha|esha|ishaa|jum[ua]{1,2}h?|iqamah?)\\b/gi;
  const TIME = /\\b\\d{1,2}\\s*[:.]\\s*\\d{2}\\s*(?:[ap]\\.?m\\.?)?/gi;
  let best = null;
  for (const el of document.body.querySelectorAll("*")) {
    // textContent is the cheap prefilter; too much text means we have the whole
    // page again, which is the problem we are solving, and too little cannot
    // hold five prayers.
    const rough = el.textContent || "";
    if (rough.length < 20 || rough.length > 3000) continue;
    // innerText, not textContent, for the actual match: textContent runs
    // adjacent nodes together, so "FAJR" + "Athan:" becomes "FAJRAthan" and a
    // word-boundary match for "fajr" fails on the very markup we are hunting.
    const text = el.innerText || "";
    const prayers = new Set((text.match(PRAYER) || []).map((w) => w.toLowerCase()));
    const times = (text.match(TIME) || []).length;
    if (prayers.size < ${MIN_PRAYERS_IN_ELEMENT} || times < ${MIN_TIMES_IN_ELEMENT}) continue;
    const box = el.getBoundingClientRect();
    if (box.width < 100 || box.height < 40) continue;
    if (!best || text.length < best.len) best = { el, len: text.length };
  }
  if (!best) return false;
  best.el.setAttribute("data-masjid-times", "1");
  return true;
})()`;

export async function capturePage(
  browser: Browser,
  url: string,
): Promise<Capture | null> {
  const page = await browser.newPage({
    userAgent:
      "MasjidTimesBot/1.0 (personal prayer-time aggregator; contact: you@example.com)",
    // Fixed so a crop's scale is predictable rather than whatever the default is.
    viewport: { width: 1280, height: 900 },
  });
  try {
    // "networkidle" never settles on pages that poll or stream analytics, which
    // times the whole read out even though the times rendered long ago. Wait for
    // the DOM instead, then give widget JS a fixed window to paint.
    const response = await page.goto(url, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    // A block and a parse failure look identical downstream unless the status
    // is recorded here, so say exactly what the server sent.
    const status = response?.status() ?? 0;
    if (status >= 400) {
      const body = await response
        ?.text()
        .then((t) => t.replace(/\s+/g, " ").trim().slice(0, 160))
        .catch(() => "");
      console.warn(
        `  ✗ ${url} — HTTP ${status}${body ? ` · ${body}` : " · (no body)"}`,
      );
      return null;
    }

    await settleForTimetable(page);

    // Nothing rendered on its own — the times may be behind a tab or button
    // on this same page rather than on another page entirely.
    if (!hasTimetableText(await allFrameText(page))) {
      await revealByClick(page);
    }

    /**
     * A widget embedded as an iframe — Masjidal's is one, and it is a common
     * enough pattern that this was going to hit a Toronto masjid eventually
     * too — has its times sitting in a document `page.innerText("body")`
     * cannot see at all: that call only ever reads the main page. McKinney
     * Islamic Association's homepage genuinely has its times displayed, in
     * plain sight, and still read as "no times found" until this, because
     * the text extraction was only ever looking at one of the two documents
     * actually on the page.
     *
     * Playwright's own Frame.innerText() is not blocked by this the way an
     * in-page `iframe.contentDocument` reference from page.evaluate() would
     * be — it talks to the browser at the automation-protocol level, not as
     * JS running inside the page, so it reads a cross-origin frame the same
     * as same-origin one. A frame that errors (detached, still loading, an
     * ad slot that never settles) is skipped rather than failing the whole
     * capture over content that was never the times to begin with.
     */
    const text = (await allFrameText(page)).slice(0, 8000);

    if (CHALLENGE.test(text)) {
      console.warn(
        `  ✗ ${url} — HTTP ${status} but served a bot challenge · ${text.replace(/\s+/g, " ").slice(0, 160)}`,
      );
      return null;
    }

    // Crop to the timetable. A full-page shot of a tall homepage is downscaled
    // until the times are a few pixels tall — see the note at the top of this
    // file. Falling back to the viewport keeps the picture legible even when
    // no element matches; it is never the whole page.
    let shot: Capture["shot"] = "viewport";
    let screenshot: Buffer | null = null;

    if (await page.evaluate(TAG_TIMETABLE)) {
      const element = await page.$('[data-masjid-times="1"]');
      if (element) {
        screenshot = await element
          .screenshot()
          .catch(() => null); // zero-sized or detached — fall through
        if (screenshot) shot = "timetable element";
      }
    }
    screenshot ??= await page.screenshot();

    const shotSize = sizeOfPng(screenshot);

    // Widget iframes, and any link to a widget host. Both matter: some masjids
    // embed the widget, others just link to it.
    const embedded: string[] = await page.$$eval("iframe[src], a[href]", (els) =>
      els
        .map((e) => (e as HTMLIFrameElement).src || (e as HTMLAnchorElement).href || "")
        .filter((u) => u.startsWith("http")),
    );

    const feedLinks = [
      ...new Set(
        embedded.flatMap((src) => {
          for (const feed of WIDGET_FEEDS) {
            if (!feed.host.test(src)) continue;
            const m = feed.from.exec(src);
            if (m) return [feed.to(m[1])];
          }
          const mawaqit = MAWAQIT_SLUG.exec(src);
          if (mawaqit) return [`mawaqit:${mawaqit[1]}`];
          return [];
        }),
      ),
    ];

    const links: string[] = await page.$$eval("a[href]", (anchors) =>
      anchors
        .map(
          (a) =>
            `${(a.textContent ?? "").trim()}\u0000${(a as HTMLAnchorElement).href}`,
        )
        .filter((entry) => entry.split("\u0000")[1]?.startsWith("http")),
    );

    /**
     * The origin AFTER redirects, not the one we asked for. Scoring against
     * the requested origin is what made a cross-host redirect look like a
     * dead end: icoeuless.com serves a 302 to icoeuless.org, so every link on
     * the page it actually returned failed a `startsWith` test against
     * icoeuless.com and the crawl had nowhere left to go. Same for
     * hamiltonmosque.com to mahcanada.com and talimul.com to /TuiSite/.
     */
    const origin = new URL(page.url()).origin;
    const ranked = links
      .map((entry) => {
        const [label, href] = entry.split("\u0000");
        return { label, href };
      })
      .filter(
        (l) =>
          l.href !== url &&
          (TIMES_LINK.test(l.label) || TIMES_LINK.test(new URL(l.href).pathname)) &&
          // Same site, or a widget host — never an arbitrary third party. An
          // off-site "prayer times" link is usually an aggregator whose data
          // is not the masjid's own, which is exactly what must not be read.
          (l.href.startsWith(origin) || WIDGET_FEEDS.some((f) => f.host.test(l.href))),
      )
      .map((l) => l.href);

    return {
      screenshot,
      text,
      feedLinks,
      timesLinks: [...new Set(ranked)],
      shot,
      shotSize,
      signals: textSignals(text),
    };
  } catch (err) {
    console.warn(`  ✗ ${url} — ${(err as Error).message}`);
    return null;
  } finally {
    await page.close();
  }
}

/** PNG dimensions from the IHDR chunk — no image library needed. */
export function sizeOfPng(png: Buffer): { width: number; height: number } {
  if (png.length < 24) return { width: 0, height: 0 };
  return { width: png.readUInt32BE(16), height: png.readUInt32BE(20) };
}

export async function readTimes(capture: Capture): Promise<any | null> {
  const { screenshot, text } = capture;
  // The text leads; the picture is there for times drawn as an image.
  try {
    const msg = await anthropic.messages.create({
      model: MODEL,
      max_tokens: 1024,
      system: EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          // Text first, matching what the prompt says to rely on. Leading with
          // the image is what invited the model to read pixels over words.
          content: [
            {
              type: "text",
              text: `PAGE TEXT (primary source):\n${text}`,
            },
            {
              type: "image",
              source: {
                type: "base64",
                media_type: "image/png",
                data: screenshot.toString("base64"),
              },
            },
            {
              type: "text",
              text:
                `The image above is the ${capture.shot} ` +
                `(${capture.shotSize.width}x${capture.shotSize.height}px). ` +
                `Fall back to it only for times the page text does not contain.`,
            },
          ],
        },
      ],
    });

    const raw = msg.content.find((b) => b.type === "text")?.text ?? "";
    const json = raw.replace(/```json|```/g, "").trim();
    return JSON.parse(json);
  } catch (err) {
    const e = err as { status?: number; message: string };
    // An API failure and an unreadable page are different problems; the status
    // says which, so a 429 is never mistaken for a site with no times.
    console.warn(
      `  ✗ reading times${e.status ? ` — HTTP ${e.status}` : ""} — ${e.message}`,
    );
    return null;
  }
}

/**
 * A congregation cannot be called before the prayer time it belongs to has
 * begun, so an iqamah earlier than its own adhan is always a misread — most
 * often the model picked up a neighbouring column or yesterday's row. Drop the
 * offending prayer rather than the whole read; the previous value survives.
 */
/**
 * Two independent adhan-calculation runs do not have to agree to the minute —
 * angle-assumption and rounding differences between implementations are
 * normal. Madinah Masjid and Markham Masjid were both flagged here on
 * consecutive days for an Isha exactly one minute earlier than this app's
 * calculated adhan; a hand-verification of both sites on 2026-08-17 confirmed
 * their published Isha was correct as scraped. That was never a bad read, it
 * was this check being stricter than the astronomy underneath it actually is.
 * A few minutes of slack keeps rejecting the case this function exists for —
 * a time from the wrong column or the wrong day — without punishing a
 * masjid for a real iqamah that lands just before this app's own estimate.
 */
const ADHAN_ROUNDING_TOLERANCE_MINUTES = 3;

export function rejectImpossible(masjid: Masjid, iqamah: Record<string, string | null>) {
  const adhan = adhanMinutesFor(masjid);
  const rejected: string[] = [];

  for (const prayer of PRAYERS) {
    const scraped = iqamah[prayer];
    if (!scraped || !isTime(scraped)) continue;
    if (clockMinutes(scraped) < adhan[prayer] - ADHAN_ROUNDING_TOLERANCE_MINUTES) {
      rejected.push(`${prayer} ${scraped} < adhan`);
      iqamah[prayer] = null;
    }
  }

  return rejected;
}

export type Verdict =
  | { ok: true; missing: string[] }
  | { ok: false; reason: string };

/**
 * Whether a read is usable, and if not, precisely why.
 *
 * "Flagged for review" with no reason is what made the last run impossible to
 * debug — six masjids failed identically and the log could not distinguish a
 * blocked request from an unreadable screenshot from a scrambled table. Every
 * rejection here names itself.
 *
 * A read missing one or two prayers is still usable: the merge keeps the
 * previous value for the gaps, which beats discarding four good times because
 * a masjid does not publish the fifth. Those gaps are named and flagged, not
 * silently accepted. Structural nonsense — nothing found, malformed times, one
 * time repeated across every prayer, or an order that cannot happen — is
 * thrown out whole.
 */
export function checkResult(result: any): Verdict {
  if (!result) return { ok: false, reason: "reader returned nothing" };
  if (!result.found) return { ok: false, reason: "no times found on the page" };

  const confidence = result.confidence ?? 0;
  if (confidence < 0.5) {
    return { ok: false, reason: `low confidence (${confidence})` };
  }

  const iq = result.iqamah ?? {};
  const malformed = PRAYERS.filter((p) => iq[p] != null && !isTime(iq[p]));
  if (malformed.length) {
    return {
      ok: false,
      reason: `malformed ${malformed.map((p) => `${p}="${iq[p]}"`).join(", ")}`,
    };
  }

  const present = PRAYERS.filter((p) => iq[p] != null);
  const missing = PRAYERS.filter((p) => iq[p] == null);
  if (present.length < 3) {
    return {
      ok: false,
      reason: `only ${present.length} of 5 prayers found (missing ${missing.join(", ")})`,
    };
  }

  // One time copied into every slot is a classic misread of a merged cell.
  const distinct = new Set(present.map((p) => iq[p]));
  if (present.length >= 3 && distinct.size === 1) {
    return { ok: false, reason: `every prayer read as ${iq[present[0]]}` };
  }

  // Dhuhr through Isha run in order on any real timetable. Out of order means
  // a column was mixed up or an afternoon time was left as AM.
  const ordered = ["dhuhr", "asr", "maghrib", "isha"].filter(
    (p) => iq[p] != null,
  );
  for (let i = 1; i < ordered.length; i++) {
    const previous = clockMinutes(iq[ordered[i - 1]]);
    const current = clockMinutes(iq[ordered[i]]);
    if (current < previous) {
      return {
        ok: false,
        reason: `${ordered[i]} ${iq[ordered[i]]} is before ${ordered[i - 1]} ${iq[ordered[i - 1]]}`,
      };
    }
  }

  return { ok: true, missing };
}

/**
 * Read a masjid's times, hunting for the right page if the homepage has none.
 *
 * Start at the homepage, always: most masjids put today's times right there,
 * and it is the one URL we know exists. From there follow only links the page
 * actually offers — "View Full Prayer Times", "Prayer Schedule" and the like.
 *
 * Nothing here invents a URL. An earlier version tried conventional paths
 * (/prayer-times, /timetable) when a site offered no obvious link, which meant
 * masjids whose homepage read poorly were reported as a 404 on a page that had
 * never existed — Abu Huraira and Masjid Al-Jannah both failed that way,
 * hiding whatever the real problem was. A guessed path can only ever confirm
 * a guess; a link on the page is evidence.
 *
 * The winning URL is returned so it can be saved and tried again tomorrow —
 * after the homepage, since a saved subpage is usually a month-long grid that
 * reads worse than today's times on the front page.
 */
/**
 * ── Ad-Din fast path ────────────────────────────────────────────────────
 *
 * Nine of these masjids run on Ad-Din, whose widget fetches the day's times
 * from a JSON endpoint. Rather than photograph the widget and ask a vision
 * model to read the digits back, we load the page in the same real browser
 * and listen for the response the page is already receiving. The numbers then
 * come from the masjid's own data rather than from an image of it, so a "3"
 * can never come back as an "8".
 *
 * The browser is not incidental here. That endpoint sits behind Cloudflare and
 * wants an `Addin-Api-Key` header plus a `cf_clearance` cookie, neither of
 * which a bare fetch can obtain; the page's own JavaScript supplies both once
 * a real browser has been let through.
 *
 * Returns the same shape `readTimes` produces, so validation, the Maghrib
 * offset conversion and the Jumu'ah merge downstream are entirely unchanged —
 * this swaps out how the times are *read*, not what is done with them.
 */
const AD_DIN_ENDPOINT = "GetPrayerTimesOfDay";

export function mapAdDinResponse(raw: any): { iqamah: Record<string, string | null>; jumuah: string[] } | null {
  // Ad-Din wraps the payload inconsistently across deployments.
  const day = raw?.data ?? raw?.result ?? raw;
  if (!day || typeof day !== "object") return null;

  /**
   * Field names vary by deployment, so each prayer is looked up under every
   * spelling seen rather than one guessed key. A miss returns null and the
   * prayer is simply left to the previous value — the merge never writes a
   * null through.
   */
  const pick = (...names: string[]): string | null => {
    for (const name of names) {
      for (const key of Object.keys(day)) {
        if (key.toLowerCase() !== name.toLowerCase()) continue;
        const value = day[key];
        const time = normaliseAdDinTime(
          typeof value === "object" && value ? (value.iqamah ?? value.iqama ?? value.jamaat) : value,
        );
        if (time) return time;
      }
    }
    return null;
  };

  const iqamah = {
    fajr: pick("fajrIqamah", "fajrIqama", "fajrJamaat", "fajr"),
    dhuhr: pick("dhuhrIqamah", "zuhrIqamah", "duhrIqamah", "dhuhrIqama", "zuhrIqama", "dhuhr", "zuhr"),
    asr: pick("asrIqamah", "asrIqama", "asrJamaat", "asr"),
    maghrib: pick("maghribIqamah", "maghribIqama", "maghribJamaat", "maghrib"),
    isha: pick("ishaIqamah", "ishaIqama", "eshaIqamah", "ishaJamaat", "isha"),
  };

  return Object.values(iqamah).some((v) => v != null)
    ? // Jumu'ah lives on a different Ad-Din endpoint, so it is deliberately
      // left empty: mergeJumuah keeps whatever sittings are already on file
      // rather than this path erasing them.
      { iqamah, jumuah: [] }
    : null;
}

/** Ad-Din returns "17:45:00", "5:45 PM" or "05:45" depending on deployment. */
export function normaliseAdDinTime(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const text = value.trim();

  const twelve = /^(\d{1,2}):(\d{2})(?::\d{2})?\s*(AM|PM)$/i.exec(text);
  if (twelve) {
    let hours = Number(twelve[1]) % 12;
    if (twelve[3].toUpperCase() === "PM") hours += 12;
    return `${String(hours).padStart(2, "0")}:${twelve[2]}`;
  }

  const twentyFour = /^(\d{1,2}):(\d{2})(?::\d{2})?$/.exec(text);
  if (!twentyFour) return null;
  const hours = Number(twentyFour[1]);
  if (hours > 23) return null;
  return `${String(hours).padStart(2, "0")}:${twentyFour[2]}`;
}

async function readFromAdDin(
  browser: Browser,
  masjidId: number,
): Promise<{ iqamah: Record<string, string | null>; jumuah: string[] } | null> {
  const page = await browser.newPage({
    viewport: { width: 1280, height: 900 },
  });
  try {
    const waiting = page.waitForResponse(
      (res) =>
        res.url().includes(AD_DIN_ENDPOINT) &&
        res.url().includes(`masjidId=${masjidId}`),
      { timeout: 20000 },
    );

    await page.goto(`https://portal.ad-din.ca/public/mediumdisplay/${masjidId}`, {
      waitUntil: "domcontentloaded",
      timeout: 30000,
    });

    const response = await waiting;
    if (!response.ok()) {
      console.log(`  · Ad-Din ${masjidId} returned HTTP ${response.status()}`);
      return null;
    }

    const json = await response.json();
    // Logged once per masjid so the field mapping above can be checked against
    // what the endpoint actually sends, rather than assumed. Full response,
    // not a snippet — the first real run showed times nested under
    // prayerOfDay rather than the flat keys guessed here, and a 240-char
    // slice cut off before that nesting was visible.
    console.log(`  · Ad-Din ${masjidId} raw: ${JSON.stringify(json)}`);
    return mapAdDinResponse(json);
  } catch (error) {
    console.log(`  · Ad-Din ${masjidId} — ${(error as Error).message.split("\n")[0]}`);
    return null;
  } finally {
    await page.close();
  }
}


/**
 * Read today's times from Mawaqit's REST API.
 *
 * The audit found Islamic Society of Belleville publishing a Mawaqit display
 * flagged Offline while this endpoint still answered correctly, so the API is
 * not merely easier to read than the HTML — it is available when the HTML is
 * not. The response's `times` array is ordered
 * [Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]; Shuruq is sunrise, not a prayer,
 * and is dropped. Iqamah is returned as per-prayer offsets in minutes, which
 * is why they are added to the adhan rather than read as clock times.
 */
export function mapMawaqitMosque(m: any): { iqamah: Record<string, string | null>; jumuah: string[] } | null {
  const times: unknown = m?.times;
  if (!Array.isArray(times) || times.length < 6) return null;
  const [fajr, , dhuhr, asr, maghrib, isha] = times as string[];
  const adhan: Record<string, string | null> = { fajr, dhuhr, asr, maghrib, isha };

  const offsets: unknown = m?.iqamaCalendar ?? m?.iqama;
  const shift = Array.isArray(offsets) && offsets.length >= 5 ? offsets : null;
  const keys = ["fajr", "dhuhr", "asr", "maghrib", "isha"] as const;

  const iqamah: Record<string, string | null> = {};
  keys.forEach((k, i) => {
    const base = normaliseAdDinTime(adhan[k]);
    if (!base) { iqamah[k] = null; return; }
    const raw = shift ? Number(String(shift[i]).replace(/[^0-9-]/g, "")) : NaN;
    if (!Number.isFinite(raw)) { iqamah[k] = base; return; }
    const mins = Number(base.slice(0, 2)) * 60 + Number(base.slice(3, 5)) + raw;
    const wrapped = ((mins % 1440) + 1440) % 1440;
    iqamah[k] = `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
  });

  const jumuah = [m?.jumua, m?.jumua2, m?.jumua3]
    .map((j) => normaliseAdDinTime(j))
    .filter((j): j is string => Boolean(j));

  return { iqamah, jumuah };
}

async function readFromMawaqit(slug: string) {
  try {
    const res = await fetch(
      `https://mawaqit.net/api/2.0/mosque/search?word=${encodeURIComponent(slug)}`,
      { headers: { "User-Agent": "MasjidTimesBot/1.0" }, signal: AbortSignal.timeout(20000) },
    );
    if (!res.ok) {
      console.log(`  · Mawaqit ${slug} returned HTTP ${res.status}`);
      return null;
    }
    const list = await res.json();
    // Search is fuzzy, so take the mosque whose slug matches exactly rather
    // than the first hit — a near-name match is another mosque's times.
    const hit = (Array.isArray(list) ? list : []).find((m: any) => m?.slug === slug)
      ?? (Array.isArray(list) && list.length === 1 ? list[0] : null);
    if (!hit) {
      console.log(`  · Mawaqit ${slug} — no exact slug match in search results`);
      return null;
    }
    return mapMawaqitMosque(hit);
  } catch (error) {
    console.log(`  · Mawaqit ${slug} — ${(error as Error).message.split("\n")[0]}`);
    return null;
  }
}

async function findTimes(
  browser: Browser,
  masjid: Masjid,
): Promise<
  | { ok: true; result: any; url: string; missing: string[]; capture: Capture }
  | { ok: false; reason: string }
> {
  // Try the masjid's own data before photographing a rendering of it. A miss
  // falls through to the crawl below rather than failing the masjid, so a
  // wrong id or a changed endpoint costs a few seconds, not a day's times.
  // `adDinUnverified` means the id is a directory guess, not something anyone
  // checked. A wrong id does not error — it returns another masjid's times,
  // which is the worst outcome available here, so the guess is not acted on.
  if (masjid.platform === "ad-din" && masjid.adDinMasjidId && !masjid.adDinUnverified) {
    const direct = await readFromAdDin(browser, masjid.adDinMasjidId);
    if (direct) {
      const verdict = checkResult({ found: true, confidence: 1, ...direct });
      if (verdict.ok) {
        return {
          ok: true,
          result: { found: true, confidence: 1, ...direct },
          url: masjid.website || masjid.timesUrl!,
          missing: verdict.missing,
          capture: { shot: "Ad-Din API" } as unknown as Capture,
        };
      }
    }
  }

  const homepage = masjid.website || masjid.timesUrl!;
  const tried = new Set<string>();
  const queue: string[] = [homepage];
  // The most informative failure seen, so a masjid that fails everywhere still
  // reports why rather than "flagged for review".
  let firstReason = "site could not be opened";

  while (queue.length && tried.size < MAX_PAGES_PER_MASJID) {
    const url = queue.shift()!;
    if (tried.has(url)) continue;
    tried.add(url);

    const capture = await capturePage(browser, url);
    if (!capture) continue;

    const result = await readTimes(capture);
    const verdict = checkResult(result);

    if (verdict.ok) {
      return { ok: true, result, url, missing: verdict.missing, capture };
    }

    if (tried.size === 1) {
      firstReason = verdict.reason;

      /**
       * A widget host's own static feed, ahead of any other page. The times
       * are already on this page — inside an iframe a screenshot renders
       * badly and a text scrape cannot reach — so fetching the host directly
       * is not a fallback, it is the better read of the same data. Both
       * audits put this first among the pipeline fixes.
       */
      for (const feed of capture.feedLinks) {
        if (!feed.startsWith("mawaqit:")) continue;
        const direct = await readFromMawaqit(feed.slice("mawaqit:".length));
        if (!direct) continue;
        const v = checkResult({ found: true, confidence: 1, ...direct });
        if (v.ok) {
          return {
            ok: true,
            result: { found: true, confidence: 1, ...direct },
            url,
            missing: v.missing,
            capture: { ...capture, shot: "Mawaqit API" } as unknown as Capture,
          };
        }
      }
      const httpFeeds = capture.feedLinks.filter((f) => !f.startsWith("mawaqit:"));

      // The homepage plainly carries a timetable — the read failed for some
      // other reason, and a "Prayer Times" subpage is usually a month-long
      // grid that reads worse, not better. Report the real failure instead of
      // burning two more page loads to fail differently.
      if (hasTimetableText(capture.text)) {
        return {
          ok: false,
          reason:
            `${verdict.reason} (page text holds ${capture.signals.prayers} prayer names ` +
            `and ${capture.signals.times} times, shot ${capture.shot} ` +
            `${capture.shotSize.width}x${capture.shotSize.height})`,
        };
      }

      // The page where times were found last time, if it isn't where we just
      // looked. Not a guess — it earned its place by returning valid times on
      // an earlier run — so it goes ahead of anything found today.
      const remembered =
        masjid.timesUrl && masjid.timesUrl !== url ? [masjid.timesUrl] : [];

      /**
       * Guessed paths, last and only when the page offered nothing of its own.
       * A masjid that links its own timetable is always the better source; a
       * probe list exists for sites whose nav is JavaScript, where the link is
       * real but invisible to a scrape. Built on the post-redirect origin, so
       * a site that moved host is probed where it actually lives.
       */
      const probes =
        capture.timesLinks.length === 0 && httpFeeds.length === 0
          ? TIMES_PATHS.map((path) => new URL(path, url).href).filter((u) => !tried.has(u))
          : [];

      queue.push(...httpFeeds, ...remembered, ...capture.timesLinks, ...probes);
    }
    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  return { ok: false, reason: firstReason };
}

/**
 * Fold a read's Friday times into a masjid, one sitting at a time.
 *
 * A masjid may hold anywhere from one to four Jummah sittings, and the later
 * ones matter most — they exist for the people who cannot get away at 1pm. So
 * the read is treated as a set rather than a single value: duplicates dropped
 * (pages often print the same time in a banner and a table), order restored,
 * and each time judged on its own.
 *
 * When some sittings read badly, what happens next depends on what we already
 * have. Against existing Friday times, a partial read is refused outright:
 * overwriting three known sittings with the one that survived would quietly
 * delete two real congregations. With nothing on file, the survivors are
 * published — an incomplete list beats a blank — and the masjid is flagged
 * either way.
 */
export function mergeJumuah(
  masjid: Masjid,
  read: unknown,
): { rejected: string; missing: boolean; added: string } {
  const existing = masjid.jumuah?.length ?? 0;

  if (!Array.isArray(read)) {
    return { rejected: "", missing: existing === 0, added: "" };
  }

  const seen = new Set<string>();
  const usable: string[] = [];
  const bad: string[] = [];

  for (const entry of read) {
    const time = typeof entry === "string" ? entry.trim() : "";
    if (!jumuahIsPlausible(time)) {
      bad.push(typeof entry === "string" ? entry : JSON.stringify(entry));
      continue;
    }
    if (seen.has(time)) continue;
    seen.add(time);
    usable.push(time);
  }

  // Zero-padded "HH:mm" sorts lexicographically exactly as it does in time.
  usable.sort();

  const rejected = bad.length ? `jumu'ah ${bad.join("/")} implausible` : "";

  // A bad sitting alongside real ones we already trust: keep what we have.
  if (bad.length && existing > 0) {
    return { rejected, missing: false, added: "" };
  }

  if (usable.length) {
    const before = masjid.jumuah?.map((s) => s.khutbah).join("/") ?? "";
    masjid.jumuah = usable.map((khutbah) => ({ khutbah }));
    const after = usable.join("/");
    return {
      rejected,
      missing: false,
      // Only worth a line in the summary when the sittings actually changed.
      added: before === after ? "" : `${usable.length}: ${after}`,
    };
  }

  return { rejected, missing: existing === 0, added: "" };
}

async function main() {
  const masjids: Masjid[] = JSON.parse(await readFile(DATA_FILE, "utf8"));
  // Toronto's date, not the runner's UTC one — after 8pm they differ.
  const today = torontoToday();

  const browser = await chromium.launch();
  // masjid id -> why it needs review, so the summary is actionable.
  const reasons = new Map<string, string>();

  for (const m of masjids) {
    if (!m.website && !m.timesUrl) continue;

    /**
     * Some masjids are off-limits to the crawler and stay that way.
     *
     * Spiritual Society of Canada's robots.txt disallows automated access.
     * The scraper has been reading it daily regardless, which is not ours to
     * decide — a site saying no is a no, whatever a real browser is able to
     * get away with. Their times stay in the file and stay usable; they are
     * only ever updated by hand from here on.
     */
    if (m.manualOnly) {
      console.log(`Skipping ${m.name} — manual only (site disallows automated access)`);
      continue;
    }

    console.log(`Scraping ${m.name} …`);

    const found = await findTimes(browser, m);

    if (!found.ok) {
      // Keep whatever was there before; say exactly what went wrong.
      m.needsReview = true;
      reasons.set(m.id, found.reason);
      console.log(`  ⚠ kept previous data — ${found.reason}`);
      await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
      continue;
    }

    const { result, capture } = found;

    // Remember where the times actually were, so tomorrow can try there too.
    // When the homepage itself was the winner, drop any stale subpage: keeping
    // it would leave the file pointing at a page we no longer need.
    if (found.url === m.website) {
      delete m.timesUrl;
    } else if (found.url !== m.timesUrl) {
      m.timesUrl = found.url;
      console.log(`  → found times at ${found.url}`);
    }

    {
      const scraped: Record<string, string | null> = { ...result.iqamah };
      const rejected = rejectImpossible(m, scraped);

      const previous = m.iqamah ?? {};
      const merged: Record<string, IqamahRule | undefined> = {};
      let kept = 0;

      const adhan = adhanMinutesFor(m);

      for (const prayer of PRAYERS) {
        const time = scraped[prayer];
        if (time && isTime(time)) {
          // Maghrib follows sunset, so a clock time read today is wrong within
          // weeks. Store the gap the masjid keeps instead — it stays right all
          // year, which is what CLAUDE.md §6 means by Maghrib being an offset.
          const gap = clockMinutes(time) - adhan.maghrib;
          merged[prayer] =
            prayer === "maghrib" && gap >= 0 && gap <= 90
              ? { type: "offset", minutes: gap }
              : { type: "fixed", time };
        } else if (previous[prayer]) {
          // No usable read for this prayer — never write a null through.
          merged[prayer] = previous[prayer];
          kept++;
        }
      }

      m.iqamah = merged;

      // Friday is the one prayer a masjid may hold several times over, and the
      // later sittings are exactly what someone who can't leave work early
      // needs. So the sessions are treated as a set: deduplicated, put in
      // chronological order, and each judged on its own.
      const jumuah = mergeJumuah(m, result.jumuah);
      if (jumuah.rejected) rejected.push(jumuah.rejected);

      m.lastVerified = today;
      m.needsReview =
        rejected.length > 0 || found.missing.length > 0 || jumuah.missing;
      m.source = "scrape";

      const notes = [
        found.missing.length ? `not published: ${found.missing.join(", ")}` : "",
        rejected.length ? `rejected: ${rejected.join(", ")}` : "",
        jumuah.missing ? "no jumu'ah found" : "",
        jumuah.added ? `jumu'ah ${jumuah.added}` : "",
        kept ? `${kept} kept from previous` : "",
      ].filter(Boolean);

      if (notes.length) {
        reasons.set(m.id, notes.join("; "));
        console.log(
          `  ⚠ updated via ${capture.shot} — ${notes.join("; ")}`,
        );
      } else {
        console.log(`  ✓ updated via ${capture.shot}`);
      }
    }

    await new Promise((r) => setTimeout(r, POLITE_DELAY_MS));
  }

  await browser.close();
  await writeFile(DATA_FILE, JSON.stringify(masjids, null, 2) + "\n");

  const reviewed = masjids.filter((m) => m.needsReview);
  console.log(
    `\nDone. ${masjids.length - reviewed.length} updated, ${reviewed.length} need review.`,
  );
  for (const m of reviewed) {
    const why = reasons.get(m.id) ?? "no website on file";
    console.log(`  · ${m.name} — ${why}`);
    console.log(`      ${m.timesUrl ?? m.website ?? "(no URL)"}`);
  }
}

// Only run when invoked directly, so the helpers above stay importable in tests.
if (process.argv[1] && import.meta.url.endsWith(basename(process.argv[1]))) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
