# Texas mosques — scrape + verification (2026-08-31)

A first read of Texas mosques from two OpenStreetMap exports, run through the same
capture/extract/validate pipeline the Toronto scrape uses, **and then re-checked entry
by entry against each site on the same day**. This is a report, not a data source:
nothing here touches `src/data/masjids.json`, and Texas is not part of the app's
Toronto-scoped model (CLAUDE.md §3). Whether it ever becomes a second city is an open
question (§16), not one this file decides.

**What the verification changed:**

- **The "site blocks automated reading" category is wrong in all 5 cases.** None of the
  five 403s reproduced. The real causes were homepage-only scraping, no timetable
  published at all, and a JS-only SPA.
- **1 of the 2 "dead" sites is alive**, and the other has a live parent-org site.
- **34 of the 47 "no website in OSM" entries do have a findable website**, and 24 of
  those publish readable times. This was the single largest gain.
- **2 of the 17 "times read" rows must be withdrawn** — City of Knowledge is a
  geolocation artifact and HART's site serves no content at all.
- Only **8 of the 17** original rows reproduce exactly against their source.

| Outcome | Was | Now | Note |
| --- | ---: | ---: | --- |
| Times verified against the source today | 17 | 8 | exact match, adhan or iqamah column |
| Times read but a field is wrong | — | 2 | Brushy Creek (Jumu'ah), MCECC (Maghrib + Jumu'ah) |
| Times on the page but not machine-readable | — | 5 | JS widget or stale page |
| Rows to withdraw — not sourced from the masjid | — | 2 | City of Knowledge, HART |
| Site blocks automated reading | 5 | **0** | all five claims refuted |
| Site is down or gone | 2 | 1 | only jamiamasjid.us is actually dead |
| Site loads, no times found | 2 | 2 | one now has a working feed |
| No website in OSM | 47 | **13** | 34 sites found by search |
| No name in OSM either | 21 | 21 | unchanged — nothing to search for |
| Ismaili jamatkhanas | 5 | 5 | unchanged — not scrapeable by design |

Times are 24h, as published on each site on 2026-08-31. Where a site gives both, they
read `adhan/iqamah`. Central Texas sunset on 2026-08-31 is ~19:45–20:10; ~20:25 in the
Panhandle and West Texas.

---

## 1. Verified — the source reproduces the row exactly (8)

Re-fetched and matched field by field. These are usable now.

- [Cypress Islamic Center](https://cypressislamiccenter.org) — Fajr 05:52/06:15, Dhuhr 13:23/13:30, Asr 16:57/18:15, Maghrib 19:46/19:49, Isha 20:54/21:15 — Jumu'ah 13:40, 15:20
- [DeSoto House of Peace](https://salamdesoto.org/) — Fajr 05:52/06:15, Dhuhr 13:28/14:00, Asr 17:04/17:30, Maghrib 19:53/19:58, Isha 21:03/21:45 — Jumu'ah khutbah 13:30
- [Islamic Center of Euless](https://icoeuless.org/euless/Mobile) — Fajr 05:52/06:15, Dhuhr 13:29/14:00, Asr 17:06/17:30, Maghrib 19:54/20:04, Isha 21:04/21:30 — Jumu'ah 13:30, 15:00 — **URL fixed:** icoeuless.com 302s to icoeuless.org, and the root serves no times; the timetable is at `/euless/Mobile`
- [Islamic Center of Greater Austin](https://austinmosque.org/prayer-timings/) — Fajr 06:01, Dhuhr 13:32, Asr 17:06, Maghrib 19:55, Isha 21:03 — **these are IslamicFinder calculated adhan times, not masjid-set iqamah**; the mosque's own congregation times are not published as static text
- [Islamic Society Of South Texas](https://isstonline.wixsite.com/isstmcallen/athan-timings) — Fajr 06:20, Dhuhr 13:45, Asr 17:30, Maghrib sunset (no numeric value), Isha 21:30 — Jumu'ah 13:45 — the blank Maghrib is correct; the page publishes the word "SUNSET". **Caveat:** the table is undated and sits beside a "2021 Yearly Time Table" — a fixed year-round schedule, not a daily one
- [Masjid Ibrahim](https://www.masjidibrahim.org/) — Fajr 06:00/06:20, Dhuhr 13:32/14:00, Asr 17:06/17:30, Maghrib 19:55/20:02, Isha 21:03/21:20 — Jumu'ah khutbah 13:10 — page is dated August 31, 2026. Cleanest source in the set
- [Masjid Khulafa'a Rashideen](https://masjidkr.org/prayer-times/) — Fajr 05:29/05:45, Dhuhr 13:30/14:00, Asr 17:05/18:30, Maghrib —/"5 min after Sunset", Isha 21:28/21:45 — Jumu'ah adhan 13:30, khutbah 13:40, iqamah 14:10. Blank Maghrib is correct: the masjid publishes a rule, not a time. **Caveat:** the adhan column is stale (sunrise 06:41 is a late-June value; Aug 31 is ~07:05) — the iqamah column the scrape used is a fixed schedule and still valid
- [North Austin Muslim Community Center](https://www.namcc.org/) — Fajr 06:01/06:30, Dhuhr 13:32/14:00, Asr 17:06/17:30, Maghrib 19:55/20:00, Isha 21:03/21:15 — Jumu'ah 12:15, 13:30, 14:30 — page dated 31 Aug, all values exact

## 2. Read, but a field is wrong (2)

- [Islamic Center of Brushy Creek](https://icbrushycreek.org/) — the five daily iqamah times all match (Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 20:01, Isha 21:30). **Jumu'ah is wrong:** the site publishes 12:20, 13:20, 14:20, 15:20 — twenty past, not on the hour
- [Muslim Children Education & Civic Center](https://www.mcecc.com/) — homepage times are a JS widget; the masjid's own [August 2026 PDF](https://www.mcecc.com/s/AUG-2026-Prayer-Schedule-MCECC.pdf) is the readable source. Fajr, Dhuhr and Asr match. **Maghrib matches neither column** — claimed 20:02 vs adhan 19:58 / iqamah 20:03. **Isha 21:30 unconfirmed** (adhan is 21:04). **Jumu'ah incomplete** — the masjid runs 13:00, 13:30, 14:00, 14:30; the row records only two

## 3. Times exist on the page but are not machine-readable (5)

Not scraper failures to retry — these need a rendered browser or the widget's own API.

- [Al-Ghadeer](https://alghadeer.org/namaz-timings/) — client-side table, "Loading…" placeholders only. **Also a structural problem:** the site's headings are Fajr / Sunrise / Zuhrain / Asr / Sunset / Maghribain — a Shia centre combining prayers, so a separate Asr with a blank Isha will never be right. Do not force it into a 5-slot schema
- [ISGH Masjid At-Taqwa](https://masjidattaqwa.com/prayers) — "Loading timings…" / "Loading yearly iqamah schedule…". Adhan is Muslim World League for Sugar Land, iqamah set by the masjid. The claimed Maghrib 19:48 is consistent with local sunset, so the row is plausible but unsourced
- [Islamic Center of Round Rock](https://roundrockmasjid.org/) — the site itself is **stale**: the homepage is headed "Today · July 6, 2026" and `/prayer-times/` shows a June 22–28 week. Claimed Dhuhr 14:00, Asr 18:40 and Jumu'ah 13:40/14:30 do appear there; claimed Fajr 06:15, Maghrib 20:00 and Isha 21:30 appear nowhere on the site. Blocked until the masjid refreshes the page
- [Madinah Masjid of Carrollton](https://madinahmasjid.com/prayer-timings/) — MyRawdah JS widget (`live-app.myrawdah.com/templates?...&template=prayer-13`); zero times in the HTML. `/prayer-times/` 404s. Every claimed value is unsourced
- [Valley Ranch Islamic Center](https://vric.org/prayertimes/) — MasjidApps iframe (`portal.masjidapps.com/public/readOnlySalahTimes?id=MQ2&...`), JS-only. `/prayer-times/` 404s; the real path is `/prayertimes/`

## 4. Withdraw these rows (2)

- [City of Knowledge](https://cfkdfw.org/) — **the site has no prayer-times page at all.** `/prayer-times/`, `/prayer-timings/` and `/sitemap.xml` all 404 and the nav has no salah link; the only times element is a footer widget reading "Detecting your location…". Claimed Maghrib 21:09 against a DFW sunset of ~19:54 is a uniform ~+1h shift across the whole row — a visitor-geolocation/timezone artifact, not CFK data. Delete the row
- [HART Islamic Community Center](https://hart.community/) — the domain returns **only a title/viewport shell**; `/prayer-times/`, `/prayer`, `/about`, `/event-calendar` and `/sitemap.xml` all return the same empty document. There is no content to have read. The row's round-number iqamah values with a blank Maghrib are what a scraper produces from nothing. Delete the row

## 5. "Site blocks automated reading" — all 5 claims refuted (0 remain)

Every one of these was re-fetched successfully. None served a challenge page or a 403.

- [Bait-ul-Qayyum Mosque](https://islaminfortworth.org/prayertimes/) — **loads fine; times found.** Fajr 06:00, Dhuhr 14:00, Asr 18:00, Maghrib 20:20, Isha 21:05, Jumu'ah 13:45. The scraper read only `/`, which has no times. 2801 Miller Ave, Fort Worth
- [Islamic Society of Greater Houston](https://isgh.org/prayer-schedule-august/) — **loads fine; times found.** Aug 31 adhan (ISNA, org-wide across all 22 centers): Fajr 05:53, Dhuhr 13:23, Asr 16:56, Maghrib 19:45, Isha 20:53. `/prayer-times/` 404s; the pattern is `isgh.org/prayer-schedule-<month>/`. **No per-branch iqamah anywhere on the site** — see §8
- [Islamic Society of Triplex – Beaumont Mosque](https://istweb.org/) — **loads fine; times on the homepage.** Fajr 05:39/06:20, Dhuhr 13:20/13:30, Asr 16:55/18:20, Maghrib 19:52, Isha 21:00/21:15, Jumu'ah 13:30
- [Houston's Blue Mosque](https://theislamicinstitute.net) — **loads fine, but publishes no timetable at all** (`/prayer-times/` 404s). Reclassify to §7, not a bot-block. 9301 W Bellfort Ave, Houston
- [(unnamed) way/1348862217](https://rosenbergcommunitycenter.org) — **loads fine; a client-side JS app.** Only `<head>` metadata is served, so a text scraper sees nothing. Real routes are `/aboutus`, `/projects`, `/donate`, all equally empty. The domain belongs to **Rosenberg Community Center**, a masjid in Rosenberg, TX with its own iOS/Android app. **Do not merge it with Rosenberg Masjid & Islamic Center** (rosenbergmasjid.com, 3125 Hwy 90 Alt) — neither org's site references the other, and the OSM way could not be read to confirm which one it tags

## 6. Site is down or gone (1, was 2)

- [Jamia Masjid](https://jamiamasjid.us/) — **dead confirmed**, `ERR_NAME_NOT_RESOLVED`, domain no longer exists. The masjid is alive: **Southeast Texas Islamic Society – Jamia Masjid**, 2394 W Lucas Dr, Beaumont TX 77706. No replacement domain; its active channel is [Facebook](https://www.facebook.com/JamiaSETX). No Mawaqit/MasjidBox/AthanPlus feed exists — times are not machine-retrievable for this one
- ~~Madrasah Islamiah Masjid Noor~~ — **claim refuted.** [mislamiah.com](https://mislamiah.com) loads; there was no connection reset. The org's timetable lives on its main site, **[madrasahislamiah.org](https://madrasahislamiah.org/)** — fixed schedule effective 1 Jun 2026: Fajr 05:30, Zuhr 14:00, Asr 18:30, Maghrib at sunset, Isha 22:00, Jumu'ah 14:05 and 15:00. 6665 Bintliff Dr, Houston. Moves to §1-eligible once the fixed schedule is accepted as a source

## 7. Site loads, no times found (2)

- [Bait-ul-Ikram Mosque](https://islamindallas.org/) — **confirmed.** Ahmadiyya Muslim Community Dallas chapter site; there is no timetable of any kind, not merely no per-location one. Mosque is at 1850 Hedgcoxe Rd, Allen TX
- ~~[Islamic Society of Denton](https://www.dentonmosque.com/)~~ — **resolved.** dentonmosque.com **302-redirects** to dentonmasjid.com (the canonical domain) and the scraper did not follow it; the redirect target then embeds a 403-to-fetchers widget. Times are published via AthanPlus and are readable at
  `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=O8L7ppA5`
  Aug 31 adhan: Fajr 05:52, Dhuhr 13:29, Asr 17:06, Maghrib 19:55, Isha 21:05. Iqamah: Fajr 06:15, Dhuhr 13:45, Asr 17:30, Maghrib at sunset, Isha 21:15. Jumu'ah 13:45, 14:45. (A MasjidBox mirror exists but its iqamah column disagrees and renders Jumu'ah as "1:45 AM" — treat AthanPlus as authoritative.) 1105 Greenlee St, Denton

## 8. "No website in OSM" (13 remain, was 47)

**34 of the 47 were found by a plain name-and-address search**, and 24 of those publish
readable times. "No website in OSM" never meant no website exists — it meant nobody had
searched. `scripts/discover.ts` and `scripts/discover-google-places.ts` were never run
against this list.

### 8a. Found, with readable times (24)

- **Alkhair Islamic Society of RGV** (Edinburg) — no own domain; MOHID: `https://us.mohid.co/tx/txrgn/alkhair` — Fajr 07:00, Dhuhr 14:00, Asr 17:30, Maghrib 19:58, Isha 21:15
- **Bayt Al-Karim Islamic Center** — [dncfw.org](https://dncfw.org/) (trades as Dar Un Noor Fort Worth), 4500 Columbus Trail — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib sunset+5, Isha 21:30
- **Dallas Masjid of al-Islam** — [masjidalislam.org](https://masjidalislam.org/); times via `https://us.mohid.co/tx/dallas/dallasmasjidofalisla/masjid/widget/api/index/?m=prayertimings` — Fajr 05:15, Dhuhr 13:30, Asr 17:15, Maghrib sunset+5, Isha 20:15. Currently rebuilding
- **Dar El Salaam Islamic Center** (Arlington) — [darelsalam.org](https://www.darelsalam.org/); `https://masjidbox.com/prayer-times/darelsalam` — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 20:00, Isha 21:30
- **East Plano Islamic Center** — [epicmasjid.org](https://epicmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 20:03, Isha 21:30
- **East Texas Islamic Society** (Tyler) — [tylermuslim.com](https://www.tylermuslim.com/) (robots-blocked); MOHID: `https://us.mohid.co/tx/txrgn/etis` — Fajr 06:45, Dhuhr 13:45, Asr 17:30, Maghrib 19:30, Isha 21:00 (its adhan column looks stale; use iqamah)
- **Elfarouq Mosque** (Houston) — [elfarouq.org](https://elfarouq.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:15, Maghrib sunset, Isha 21:30 (standing schedule, not date-specific)
- **Islamic Center of Amarillo** — [amarillomosque.org](https://amarillomosque.org/) — Fajr 06:16, Dhuhr 13:59, Asr 17:36, Maghrib 20:27, Isha 21:38 (Panhandle sunset is ~20:25, so this is correct, not late)
- **Islamic Community of Bryan–College Station** — [icbcs.org](https://www.icbcs.org/); AthanPlus `masjid_id=wAaqPxA1` — Fajr 06:20, Dhuhr 14:00, Asr 17:30, Maghrib sunset, Isha 21:30
- **Islamic Society of Southern Texas** (Corpus Christi, Masjid AbulQasim) — [isstcc.org](https://isstcc.org/) — Fajr 06:20, Dhuhr 14:00, Asr 17:30, Maghrib 20:01, Isha 21:30
- **Islamic Center of Wylie** — [icwtx.org/monthly-prayer-timings/](https://icwtx.org/monthly-prayer-timings/) (`/prayer-timings/` 404s) — Fajr 06:00, Dhuhr 13:45, Asr 18:15, Maghrib 20:16, Isha 21:45
- **Kalkan Masjid Houston** — [kalkalmasjid.wordpress.com](https://kalkalmasjid.wordpress.com/) — Fajr 06:45, Dhuhr 14:00, Asr 16:45, Maghrib sunset+10, Isha 20:15
- **Maryam Islamic Center** (Sugar Land) — [maryammasjid.org](https://www.maryammasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:30, Maghrib sunset, Isha 21:30
- **Masjid Al-Sahaabah Watauga** — [wataugamasjid.com](https://wataugamasjid.com/); MOHID `https://us.mohid.co/tx/fortworth/iaftsahaba` — Fajr 06:00, Dhuhr 13:45, Asr 18:00, Maghrib sunset+5, Isha 21:30
- **Masjid Arafat** (Sugar Land) — [duusa.org/masjid/](https://duusa.org/masjid/) (Dar ul Uloom USA; no separate masjid domain) — Fajr 06:00, Zuhr 13:00, Asr 16:15, Maghrib sunset, Isha 20:00
- **Masjid As Sabireen / Brand Lane Islamic Center** (Stafford) — [brandlaneic.com](https://www.brandlaneic.com/) — Fajr 06:05, Zuhr 14:00, Asr 18:15, Maghrib 19:47, Isha 21:30
- **Masjid Darul-Uloom Texas** (Sugar Land) — [dutx.org](https://dutx.org/); MOHID `https://us.mohid.co/tx/houston/dutx` — Fajr 06:00, Dhuhr 14:00, Asr 16:15, Maghrib sunset, Isha 19:30
- **Masjid al-Ahad** (Katy) — [masjidahad.org](https://masjidahad.org) — Fajr 05:45, Zuhr 13:45, Asr 18:15, Maghrib 20:12, Isha 21:20 (static seasonal table)
- **Masjidul Mu'meneen** (Houston) — [masjidulmumineen.org](https://www.masjidulmumineen.org) — Fajr 06:00, Zuhr 14:00, Asr 17:30, Maghrib sunset, Isha 21:30, Jumu'ah 13:30
- **McKinney Islamic Center** — [mckinneymasjid.org](https://mckinneymasjid.org); AthanPlus `masjid_id=wLVzDqLJ`, also mirrored at `us.mohid.co/tx/dallas/mia`
- **Minhaj ul Quran International** (Carrollton) — minhajdallas.org has a TLS hostname mismatch; times readable at `https://us.mohid.co/tx/dallas/jmcc` — Fajr 06:00, Zuhr 13:30, Asr 18:00, Maghrib sunset+2, Isha 21:30
- **Nueces Mosque** (Austin) — [nuecesmosque.com](https://www.nuecesmosque.com) — Fajr 06:39, Dhuhr 14:00, Asr 17:30, Maghrib 19:11, Isha 20:15. **Flag:** Maghrib 19:11 is ~45 min before Austin sunset — verify with the masjid before publishing
- **Islamic Da'wah Center** (201 Travis St, Houston) — [islamicdawahcenter.org](https://islamicdawahcenter.org/) — **partial only:** Dhuhr 13:45 and Asr 17:15 (Mon–Thu) plus Jumu'ah 13:30. No Fajr/Maghrib/Isha published
- **MOMIN of Texas** (Dallas) — [momin.org](https://momin.org/) — **partial, Shia format:** Fajr 05:46, Zohrain 13:27, Maghrib 20:08. No 5-slot iqamah table

### 8b. Found, but no readable times (10)

- **Dar-Un-Noor** — [darunnoortx.org](https://darunnoortx.org/) (Sugar Land). No timetable found. **Name collision:** "Dar Un Noor" is also Bayt Al-Karim in Fort Worth (dncfw.org) — confirm which OSM record this is
- **HEB Masjid** (Euless) — [hebmasjid.in](https://www.hebmasjid.in/); times on `https://masjidzone.com/hebic/mobile`, which returns only the MasjidZone shell to a fetcher
- **IALFM Mosque** (Flower Mound) — [ialfm.org](https://www.ialfm.org/), robots-blocked. Has a prayer-times PDF and a Friday-prayers page. **Note: this is listed twice in OSM** (once with the Peters Colony Rd address, once bare) — dedupe
- **Islamic Center of Lubbock** — [lubbockmuslims.org](https://lubbockmuslims.org/) (operates as Islamic Center of the South Plains, same address). Jumu'ah only: khutbah 14:15/salah 14:45 and 15:15/15:45. Daily times come from an embedded IslamicFinder calculation, not a masjid iqamah schedule
- **Masjid Al-Mustafa** (Bear Creek IC, Houston) — [bearcreekic.org](https://bearcreekic.org/) exists but has an **expired TLS certificate**, so nothing is fetchable. Worth retrying
- **Masjid Istiqlal Houston** — [istiqlalhouston.org](https://www.istiqlalhouston.org/); schedule at `app.istiqlalhouston.org/prayer-schedule`, client-side only
- **Masjidu Ttaqwa Mosque** (Killeen) — [icgk.org](https://icgk.org). **Name correction:** this is the **Islamic Community of Greater Killeen**; the OSM name appears to be a mislabel of the same building. Times load from OurMasajid via JS
- **San Marcos Masjid** — sanmarcosmasjid.org is HTTP-only/TLS-broken and would not fetch; cited by the Texas State MSA. Facebook and masjidway listings exist
- **Xhamia Shqiptare DFW** (Bedford) — [xs-dfw.com](https://www.xs-dfw.com) — has a 5-prayer table but **every field renders "00:00"**. Site-side bug; Facebook is active
- **Baitul Muqeet Mosque** (Ahmadiyya, Round Rock) and **Baitus Samee Mosque** (Ahmadiyya, Houston) — no chapter domain; Ahmadiyya USA chapter pages exist under `ahmadiyya.us` but are robots-blocked. As in the Ontario audit, Ahmadiyya branch pages carry no prayer times

### 8c. Genuinely no website found (7)

Searched by name and address; only Facebook, directory listings or nothing at all.

- **Allahs House of Islam** — 4752 Nome St, Dallas. Directory listings only
- **Islamic Academy of San Antonio** — 8638 Fairhaven St. Facebook only; it is a school
- **Makkah Masjid of Greater Houston** — 3505 S Dairy Ashford Rd. Not listed on isgh.org either
- **Masjid E Mohammedi** — 17730 Coventry Park Dr, Houston. Dawoodi Bohra (Anjuman-e-Shujaee); would not publish a 5-prayer iqamah table
- **Masjid Salah Ad-Deen** — 5645 Hillcroft Ave, Houston. Run by AICP Texas; a Linktree gives only "Friday prayer 2pm"
- **New Islamic Generation Foundation** — nothing found under this name in Texas. Possibly defunct or renamed
- **Masjid Ayesha** — an ISGH branch with no site of its own. **Address correction:** ISGH lists it as **Masjid Ayesha (Sienna), 4502 Watts Plantation Dr., Missouri City, TX 77545** — "Dr." not "Rd.", ZIP 77545 not 77459. Jumu'ah 13:30–14:00

### 8d. Not identifiable (3 + 1)

- **Islamic Society of Greater Houston** × 3 — three unnamed OSM entries carrying the org name. ISGH publishes **no per-branch times**: `isgh.org/prayer-schedule-<month>/` is one ISNA-calculated table for all 22 centers with no center selector and no iqamah. To resolve these, match each OSM node to a branch that has its own site — Masjid Bilal (masjidbilalnz.org), Masjid Al-Salam (alsalammasjid.org), Cypress IC, Masjid al-Ansaar (alansaarmasjid.org), Masjid Al-Sahabah (masjidalsahabah.com), Masjid Al-Mustafa (bearcreekic.org), Masjid Aqsa (aqsamasjidkaty.com), Brand Lane IC, Pearland IC (picisgh.org), Eastside/River Oaks (houstonmosque.org), Masjid Maryam (maryammasjid.org), Masjid At-Taqwa, Masjid Hamza (isghmasjidhamza.org). The branches with no site of their own are Spring Branch, Al-Mursaleen, Medical Center Musalla, Riverstone, Masjid Ayesha, Masjid Abu-Bakr, Northshore, Baytown, Alvin, Riverstone Ranch, Wilcrest/Savoy and Harvest Green Aliana
- **"Masjid"** — a bare OSM name with no address. Nothing to search for

## 9. No name in OpenStreetMap either (21) — unchanged

Tagged only as a building or a place of worship, with no name and often no address.
There is nothing to search for. Each needs tracing back to its OSM record, or dropping.

- `node/11201021741`
- `node/12767846634`
- `way/1225215246`
- `way/1247561146`
- `way/1323719988`
- `way/1369802877` — 9401 Farm-to-Market Road 1105, Jarrell, TX, 76537
- `way/1385972314`
- `way/1409484222`
- `way/1418381673`
- `way/1469011389` — 16500 Boss Gaston Road, Sugar Land, TX, 77498
- `way/1486693879`
- `way/1499350183`
- `way/265482606`
- `way/303684340` — 8455 Stonebrook Parkway, Frisco, TX, 75034
- `way/383025450`
- `way/460792404` — 909 Allen Central Drive
- `way/465539048`
- `way/655037002`
- `way/924165262`
- `way/943436105`
- `way/995953052` — 119 Amy Street, Longview, TX, 75605

## 10. Ismaili jamatkhanas (5) — not scrapeable by design

Excluded from the scrape rather than failed against. The 2026-08-31 Ontario audit
established that jamatkhanas generally do not publish a public Fajr/Dhuhr/Asr/
Maghrib/Isha timetable — timing reaches registered Jamati members through internal
channels. Treat as a closed group, not a gap to keep chasing.

- **Ismaili Center Houston** — 2323 Allen Parkway Frontage Road, Houston, TX, 77019
- **Ismaili Jamatkhana** — 1590 Arrington Road, College Station, TX, 77845
- **Ismaili Jamatkhana** — 6704 Alma Drive, Plano, TX, 75023
- **Ismaili Jamatkhana** — 2401 South Lakeline Boulevard, Cedar Park, TX, 78613
- **Ismaili Jamatkhana and Center - Harvest Green** — 9550 Harlem Road, Richmond, TX, 77407

---

## What this says about the pipeline

Four failure modes account for nearly every wrong label in the original report, and all
four are fixable in the scraper rather than by hand:

1. **It reads only `/`.** Bait-ul-Qayyum, ISGH and Denton all publish times one click in.
   A `/prayer-times/`, `/prayertimes/`, `/prayer-timings/`, `/prayer-schedule/`,
   `/prayers/` probe list would have caught them — note that Brushy Creek, VRIC and
   Wylie each use a *different* one of those spellings, and the wrong one 404s.
2. **It does not follow cross-host redirects.** icoeuless.com → icoeuless.org and
   dentonmosque.com → dentonmasjid.com were both scored as failures.
3. **It cannot see widget content, and reports that as "no times".** MyRawdah, MasjidApps,
   MOHID, AthanPlus, MasjidBox, MasjidZone, IslamicFinder and OurMasajid all appeared here.
   AthanPlus, MasjidBox and MOHID serve static text at a predictable URL once you have the
   masjid id from the page's iframe — that is the single highest-value fix.
4. **A 403 was assumed rather than observed.** All five bot-block claims were wrong.

Two data-quality points that are not the scraper's fault and cannot be fixed by
re-running it: several Texas sites are **frozen on old schedules** (Round Rock on July 6,
Masjid KR's adhan column on late June, ISST on a 2021 table), and Shia centres
(Al-Ghadeer, MOMIN) legitimately publish combined prayers — forcing them into five slots
produces a false "missing prayer" every time.

---

*Verified 2026-08-31, one live fetch per site plus a name-and-address search for every
entry that had no URL. Times were correct as published that day and should be re-checked
before any long-term reliance — several sites in this list carry stale or inconsistent
data on their own end.*
