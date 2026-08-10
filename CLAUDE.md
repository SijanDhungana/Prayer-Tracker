# CLAUDE.md — Toronto Masjid Prayer-Time Finder

> **How to use this doc:** This is the complete build spec. Point Claude Code at it and
> build in the milestone order in §12 — one milestone at a time, not all at once.
> Three companion files ship with it: `scrape.ts`, `daily-scrape.yml`, `masjids.seed.json`.

---

## 1. The problem

A Muslim in Toronto wants to catch a congregation (jamaah) prayer that fits their schedule.
Today they check five different masjid websites by hand to compare times. This app does that
comparison for them: pick a prayer, see nearby masjids' times sorted and filtered, done.

## 2. The core concept (read first — it shapes everything)

There are **two kinds of prayer time**:

- **Adhan time** — astronomically calculated (Fajr, Sunrise, Dhuhr, Asr, Maghrib, Isha).
  Roughly identical across the city. **Computed in the browser** with the `adhan` library.
  No API, no backend.
- **Iqamah time** — the actual congregation time each masjid sets by hand. Varies masjid to
  masjid by 15–45 min. **This is the whole point of the app.** No public API exists, so we
  collect it ourselves (see §10, scraping) and store it in `masjids.json`.

Everything downstream — sorting, "which masjid can I still make," Jummah comparison — runs on
the iqamah data.

## 3. Scope

**In scope (v1):**
- ~10–15 Toronto masjids, their iqamah + Jummah times kept fresh automatically.
- Client-side adhan calculation; iqamah from stored data.
- Three views: "Next up," "Compare a prayer," "Jummah."
- Distance from a reference point, with no forced location sharing.
- Trust signals: a "last verified" date and links to each masjid's own site.
- A daily scraper (GitHub Action) that refreshes the times hands-off.

**Not in scope (v1):** accounts/auth, cities beyond Toronto, notifications, a live server or
database. Everything is a static site + a scheduled job that commits a JSON file.

## 4. Tech stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS. Static, deploys free to
  Vercel/Netlify/GitHub Pages.
- **Prayer calc:** [`adhan`](https://www.npmjs.com/package/adhan) (browser, no network).
- **Scraper:** Node + TypeScript, [`playwright`](https://playwright.dev) for rendering,
  [`@anthropic-ai/sdk`](https://docs.claude.com/en/api/overview) for reading times from
  screenshots, [`tsx`](https://www.npmjs.com/package/tsx) to run the TS directly.
- **Automation:** GitHub Actions (daily cron). No server anywhere.

## 5. Repo structure

```
masjid-times/
├─ CLAUDE.md                     ← this file
├─ package.json
├─ scrape.ts                     ← daily scraper (provided)
├─ .github/workflows/
│  └─ daily-scrape.yml           ← runs the scraper daily (provided)
└─ src/
   ├─ data/masjids.json          ← seed from masjids.seed.json, then auto-updated
   ├─ lib/
   │  ├─ prayer.ts               ← adhan calc + iqamah resolver
   │  └─ distance.ts             ← haversine
   ├─ components/
   └─ views/
      ├─ NextUp.tsx
      ├─ ComparePrayer.tsx
      └─ Jummah.tsx
```

## 6. Data model — `src/data/masjids.json`

An array of:

```jsonc
{
  "id": "madinah-masjid",
  "name": "Madinah Masjid",
  "address": "65 Thorncliffe Park Dr, East York, ON",
  "lat": 43.7048,
  "lng": -79.3488,
  "website": "https://madinahmasjid.ca",
  // baseline for computing adhan times AND resolving any "offset" iqamah rules;
  // match the method the masjid itself uses.
  "calc": { "method": "NorthAmerica", "madhab": "hanafi" },
  "iqamah": {
    "fajr":    { "type": "fixed",  "time": "05:00" },   // 24h HH:mm
    "dhuhr":   { "type": "fixed",  "time": "13:45" },
    "asr":     { "type": "fixed",  "time": "19:00" },
    "maghrib": { "type": "offset", "minutes": 5 },       // 5 min after maghrib adhan
    "isha":    { "type": "fixed",  "time": "22:40" }
  },
  "jumuah": [{ "khutbah": "13:30" }, { "khutbah": "14:30" }],
  "lastVerified": "2026-08-10",  // ISO date, set by the scraper
  "needsReview": false,          // scraper sets true when a read fails/looks off
  "source": "scrape"             // "seed" | "scrape" | "manual"
}
```

- An iqamah entry is `{ "type": "fixed", "time": "HH:mm" }` **or** `{ "type": "offset", "minutes": N }`.
- Maghrib is almost always an offset (a few min after adhan); the rest are usually fixed.
- `method` maps to `adhan`'s `CalculationMethod` (`NorthAmerica`, `MuslimWorldLeague`, …).
  `madhab` is `"hanafi"` or `"shafi"` and only changes Asr.

Start from `masjids.seed.json` (6 real Toronto masjids; **iqamah values are placeholders to
verify**). The scraper fills in real times after the first run.

## 7. Prayer-time calculation — `src/lib/prayer.ts`

```ts
import { Coordinates, CalculationMethod, PrayerTimes, Madhab } from "adhan";

export function adhanTimes(masjid, date = new Date()) {
  const coords = new Coordinates(masjid.lat, masjid.lng);
  const params = CalculationMethod[masjid.calc.method]();
  params.madhab = masjid.calc.madhab === "shafi" ? Madhab.Shafi : Madhab.Hanafi;
  const t = new PrayerTimes(coords, date, params);
  return { fajr: t.fajr, dhuhr: t.dhuhr, asr: t.asr, maghrib: t.maghrib, isha: t.isha };
}

// Resolve an iqamah rule (fixed clock time or offset from adhan) to a Date.
export function iqamahTime(rule, adhan /* Date for that prayer */, date = new Date()) {
  if (!rule) return null;
  if (rule.type === "offset") return new Date(adhan.getTime() + rule.minutes * 60000);
  const [h, m] = rule.time.split(":").map(Number);
  const d = new Date(date);
  d.setHours(h, m, 0, 0);
  return d;
}
```

## 8. Views + acceptance criteria

**8a. Next up (home).** Given now + the reference point, show the upcoming iqamah for the
current/next prayer, one row per masjid, sorted soonest first: name, iqamah time, "in X min,"
distance. Header shows which prayer we're in/heading toward and its adhan time.
*Accept:* at 8:15 PM I can see which nearby masjids still have an Isha iqamah I can make.

**8b. Compare a prayer.** Pick a prayer (Fajr…Isha). List every masjid's iqamah for it.
Sort earliest↔latest. Filter: "iqamah after HH:mm" and "within N km."
*Accept:* I can find "the latest Isha within 5 km" or "the earliest Fajr in Scarborough" fast.

**8c. Jummah.** Table of all masjids' Friday khutbah times (multiple sessions shown separately),
sortable by time, filterable by distance.

**8d. Masjid detail.** Full day's adhan + iqamah, address (Google Maps link), website link,
and the `lastVerified` date.

## 9. Location handling (no forced sharing)

Default reference point = downtown Toronto (`43.6532, -79.3832`). Distance via haversine.
Let the user change it three ways, lowest-effort first:
1. **Neighborhood preset dropdown** (Downtown, Scarborough, North York, Etobicoke, Mississauga),
   each a hardcoded lat/lng. Default.
2. **"Use my location" button** — one `navigator.geolocation.getCurrentPosition` call, fires
   only on click, app works fully without it.
3. (Later) address → geocode.

## 10. Data pipeline — the scraper (`scrape.ts`, provided)

Masjids don't put times in plain HTML — most embed a **widget** (Masjidal, Masjidbox, Mawaqit,
The Masjid App…) that loads times via JavaScript, and some post an **image/PDF** schedule. So
parsing raw HTML fails. Instead, for each masjid the scraper:

1. Opens the site in a real browser (Playwright) so widget JS runs and times appear.
2. Takes a full-page **screenshot** + grabs the visible text.
3. Sends both to **Claude**, which reads the adhan/iqamah/Jummah times into strict JSON —
   this works for widgets, plain tables, and image schedules alike (Claude *sees* the shot).
4. Validates the result and merges into `masjids.json`. **If a read fails or looks
   low-confidence, it keeps the previous value and sets `needsReview: true`** — good data is
   never overwritten with a bad read.

Full code is in `scrape.ts`. Cost is ~one Claude call per masjid per day (pennies for ~15).
Use Sonnet for accuracy or Haiku to save money; confirm the current model id at
https://docs.claude.com/en/docs/about-claude/models .

`package.json` needs:

```json
{
  "devDependencies": {
    "playwright": "^1.48.0",
    "tsx": "^4.19.0",
    "@anthropic-ai/sdk": "^0.30.0"
  },
  "dependencies": { "adhan": "^4.4.3" }
}
```

## 11. Daily automation (`.github/workflows/daily-scrape.yml`, provided)

A GitHub Action runs the scraper once a day on GitHub's servers (free for public repos) and
commits the refreshed `masjids.json`. The frontend redeploys from that commit. No server, no
laptop, nothing daily for you. The only credential it needs is an `ANTHROPIC_API_KEY` repo
secret. Full workflow is in `daily-scrape.yml`.

## 12. Build milestones (do in order)

1. Scaffold Vite + React + TS + Tailwind. Load `masjids.json` (start = seed). List masjid
   names + addresses.
2. Add `adhan`; build `src/lib/prayer.ts`; show today's adhan times per masjid.
3. Add the iqamah resolver (fixed vs offset); show iqamah on the detail view.
4. Build **Compare a prayer** (sort + after-time filter).
5. Add reference point (presets + optional geolocation) + haversine; add distance filter.
6. Build **Next up** home view.
7. Build **Jummah** view.
8. Add trust UI (`lastVerified`, stale flag > ~45 days, disclaimer, source links). Polish,
   empty states, mobile-first layout.
9. Add `scrape.ts` + the GitHub Action. Do one manual run; verify `masjids.json` updates.
10. Deploy to Vercel/Netlify.

## 13. One-time setup for the automation (after the app exists)

1. Push the project to a GitHub repo (include `scrape.ts` and `.github/workflows/daily-scrape.yml`).
2. Ensure `package.json` has the scraper deps + a committed `package-lock.json`.
3. Add repo secret `ANTHROPIC_API_KEY` (Settings → Secrets and variables → Actions).
4. Actions tab → Run workflow once by hand → confirm `masjids.json` updates.
5. Done — it runs daily on its own. Occasionally check any `needsReview` masjids by hand.

## 14. Accuracy & safety (matters — this is a worship app)

- Show `lastVerified` wherever times appear; visually flag anything older than ~45 days.
- Link every masjid to its official site as the source of truth.
- Disclaimer: adhan times are calculated; iqamah times are community-collected — confirm with
  the masjid. Wrong times could make someone miss a prayer, so fail safe (keep last-known-good).

## 15. Design direction

Mobile-first — people check this on their phone in a hurry. Fast to scan, big readable times,
minimal taps to the answer. Clean and calm, not cluttered.

## 16. Nice-to-haves (v2+)

- Google Places API auto-discovery so new masjids appear on their own.
- Favourite masjids (localStorage).
- "Report a wrong time" button feeding corrections.
- Generalize beyond Toronto (data model already supports it — add masjids + a city switcher).
- Optional prayer reminders.
