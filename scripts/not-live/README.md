# Masjids not live — re-audit, second pass (2026-08-31)

Every entry in the original listing (kept at the bottom of this file) has now been
checked twice on 2026-08-31: a first pass that fetched each site, and a second pass that
re-tested every claim the first pass made and chased each failure to a widget host, a
redirect or a search. **The second pass overturned a large part of the first.**

The headline change is that most "no times found" entries do have times — behind a
JavaScript widget whose host serves static text at a predictable URL. Fetching
`masjidbox.com/prayer-times/<slug>`, `timing.athanplus.com/masjid/widgets/monthly?masjid_id=<id>`,
`themasjidapp.org/<slug>` or `us.mohid.co/<path>` directly resolved dozens of them.

| Outcome | 1st pass | 2nd pass | What changed |
| --- | ---: | ---: | --- |
| Ready to go live, real times read | 19 | **50+** | widget hosts resolved most of the "no times" group |
| Real site and times, one manual step | 4 | 1 | Kanata and Oshawa resolved; Al-Arqam still JS-only |
| Times read but impossible | 5 | 1 | only Bosnian CIC still unexplained |
| Times read but a prayer was blank | 3 | 3 | all three explained; 2 are correct by design |
| Website loads, no times found | 81 | ~20 | see §5 |
| Only a shared org homepage | 10 | 4 | Brantford merged, Aisha and Halton resolved |
| No website in OSM or Google | 56 | ~20 | 9 more sites found beyond the first pass's 16 |
| Not a mosque / out of scope | — | 8 | remove from the tracker |
| Tracker data is wrong | 7 | 7 | all diagnosed, see §8 |

Times are as published on each masjid's own site or feed on 2026-08-31, in 24h. Where a
source gives both, they read `adhan/iqamah`. Southern Ontario that day: sunrise ~06:45,
sunset ~20:00 EDT (Windsor and Chatham ~20:10, Kingston/Ottawa ~19:45).

---

## 0. Already shipped — and five rows in §1a that must not be

**Eleven masjids from the first pass are live. The app is at 145, not 134.** Shipped
2026-08-31 after each row was run through the app's own prayer maths — the rule
`scrape.ts` applies to a scraped read, that an iqamah cannot fall before its own adhan
(3 minutes of slack for rounding):

Al Huda Institute Canada · Islamic Centre of Southwest Ontario · Masjid Noor-ul-Haram ·
Masjid Al-Salaam (Kawartha) · Islamic Centre of Bowmanville · Ummah Nabawiah Masjid ·
Islamic Research Center of Canada · Muslim Society of Guelph · Masjid Al-Abrar · Masjid
Subhan at both Scarborough and Ajax. All carry `needsReview: true` and `source: manual`.

**Five rows still listed as ready in §1a below publish adhan times, not iqamah.** They
were rejected on validation and must not be shipped as they stand:

| Row in §1a | Fails because |
| --- | --- |
| Muslim Association of Tillsonburg | Dhuhr 12:30, Asr 15:15 and Isha 19:00 all precede their own adhan, and Isha lands before Maghrib |
| Jami' Masjid Zakariya | Fajr 04:30 is 24 min before Fajr adhan in Cornwall |
| London Muslim Mosque | Fajr 05:08 is 18 min before Fajr adhan |
| Islamic Society of York Region | Fajr 05:00 is 16 min before Fajr adhan |
| Erin Islamic Cultural Center | Isha 20:00 is 81 min before Isha adhan — impossible in Ontario in late August |

All five are single-column sites. A congregation is not called before the prayer has
begun, so a lone published column landing before the adhan **is** the adhan. §3 of this
pass clears Zakariya and Tillsonburg of being "impossible" — and that is correct, the
sites do publish those numbers. It is the *label* on the column that is wrong, not the
reading of it. Both facts hold at once, and only one of them decides whether a row can
go live.

Three more are held for want of an address: **Mevlana Masjid**, **Halton Islamic
Association** and **Dar Al-Hijrah Islamic Center** publish no postal address on their own
sites, and this pass does not add one. Name-based geocoding is not a fallback — it
returned Masjid Aisha for "Muslim Society of Guelph" and Muslim Association of Milton for
"Halton Islamic Association", both already in the app under their own entries.

**Islamic Centre of Northern Ontario** is held for a different reason: Isha 21:18 against
a computed adhan of 21:33, but the site's own adhan is 21:13 — a 20-minute
calculation-method disagreement at Sudbury's latitude, not a misread. It needs the right
method, not a discard.

Four of the eleven needed `calc.madhab` changed from hanafi to shafi, inferred the way
`fix-madhab.ts` does it.

---

## 1. Ready to go live — times read from the masjid's own source

### 1a. From the first pass (20 rows, 19 masjids)

**Eleven of these are live; five must not ship as they stand — see §0.**

- [Jami' Masjid Zakariya](https://cornwallmasjid.ca/) (Cornwall) — Fajr 04:30, Dhuhr 13:30, Asr 18:30, Maghrib sunset, Isha 23:15 — the original "impossible" flag was wrong; the masjid genuinely publishes 23:15
- [Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/) — Fajr 06:15, Dhuhr 12:30, Asr 15:15, Maghrib sunset, Isha 19:00 — Isha is fixed while Maghrib floats, so on long summer days Isha lands before Maghrib. Their scheduling, not a read error
- [Mevlana Masjid](https://a-than.info/vv.php?code=MEVLANA01) — Fajr 04:57/05:30, Dhuhr 13:23/13:45, Asr 17:05/17:45, Maghrib 20:03/20:05, Isha 21:25/21:45
- [Al Huda Institute Canada](https://alhudainstitute.ca/) — Fajr 06:00, Dhuhr 13:40, Asr 17:45, Maghrib adhan +5, Isha 21:45
- [Islamic Research Center of Canada](http://www.irccan.com/) — Fajr 05:45, Dhuhr 13:45, Asr 18:00, Maghrib after sunset, Isha 21:15
- [London Muslim Mosque](http://www.londonmosque.ca/) — Fajr 05:08, Dhuhr 13:30, Asr 17:20, Maghrib 20:25, Isha 21:44
- [Islamic Centre of Southwest Ontario](https://islamiccentre.ca/) — Fajr 05:26, Dhuhr 13:25, Asr 17:08, Maghrib 20:01, Isha 21:24
- [Masjid Noor-ul-Haram](https://wimcanada.com/) — Fajr 06:00, Dhuhr 13:45, Asr 18:30, Maghrib sunset, Isha 21:45
- [Erin Islamic Cultural Center](https://erinislamiccenter.ca/) — Fajr 05:30, Dhuhr 14:00, Asr 18:00, Maghrib sunset, Isha 20:00
- [Masjid Al-Salaam](https://www.kmrapeterborough.org/) (Kawartha) — Fajr 05:11/05:30, Dhuhr 13:14/13:30, Asr 16:57/17:30, Maghrib 19:54/19:59, Isha 21:17/21:30
- [Masjid — Muslim Society of Guelph](http://www.msofg.org/) — Fajr 05:09/06:15, Dhuhr 13:26/13:45, Asr 18:01/18:30, Maghrib 20:05/20:05, Isha 21:11/21:30
- [Islamic Centre of Bowmanville](https://icbmasjid.com/) — Fajr 05:13/06:00, Dhuhr 13:15/14:00, Asr 17:55/18:15, Maghrib 19:52/19:57, Isha 21:16/21:30
- [Masjid Al-Abrar](http://www.alabrar.ca/) — Fajr 05:45, Dhuhr 13:30, Asr 17:30, Maghrib sunset, Isha 21:30
- [Masjid Subhan Ajax](https://www.subhanislamicassociation.org/) — Ajax — Fajr 06:00, Dhuhr 14:00, Asr 18:15, Maghrib sunset, Isha 21:30
- [Masjid Subhan Ajax](https://www.subhanislamicassociation.org/) — Scarborough — Fajr 05:45, Dhuhr 14:00, Asr 18:45, Maghrib sunset, Isha 21:30
- [Islamic Centre of Northern Ontario](https://masjidbox.com/prayer-times/islamic-centre-of-northern-ontario) (ICONO Sudbury) — Fajr 05:14/05:45, Dhuhr 13:24/13:45, Asr 17:06/18:30, Maghrib 20:04/20:09, Isha 21:13/21:18
- [Halton Islamic Association](https://www.hia.live/) — Fajr 05:20, Dhuhr 13:20, Asr 17:02, Maghrib 19:58, Isha 21:14 — masjidhalton.com redirects here
- [Ummah Nabawiah Masjid](https://www.theunm.com/) — Fajr 05:45/06:00, Dhuhr 13:30/13:45, Asr 18:15/18:30, Maghrib sunset, Isha 21:20/21:30
- [Dar Al-Hijrah Islamic Center](https://darulhijra.org/) — Fajr 05:15, Dhuhr 13:40, Asr 17:30, Maghrib sunset, Isha 21:45
- [Islamic Society of York Region](https://isyr.org/) — Fajr 05:00, Dhuhr 14:00, Asr 17:30, Maghrib after sunset, Isha 22:00

### 1b. New in the second pass — resolved through a widget host or a redirect (30)

Each of these was labelled "no times found", "could not be opened" or "no website".
The URL given is the one that actually returns times.

- **ISNA Canada** (Islamic Centre of Canada, 2200 S Sheridan Way, **Mississauga** — not Toronto) — `https://masjidbox.com/prayer-times/isna-canada?date=2026-08-31` — Fajr 05:35/05:45, Dhuhr 13:30/13:40, Asr 18:05/18:15, Maghrib 19:58/20:03, Isha 21:20/21:30, Jumu'ah 13:00
- **Jami Mosque** (56 Boustead Ave, Toronto — a separate record, not a duplicate of ISNA Canada) — `https://masjidbox.com/prayer-times/isna-jami-mosque?date=2026-08-31` — Fajr 05:05/05:45, Dhuhr 13:30/13:45, Asr 17:15/17:30, Maghrib 19:58/20:05, Isha 21:15/21:30, Jumu'ah 13:30 & 14:15
- **Sayeda Khadija Centre** — `https://themasjidapp.org/sayedakhadijacentre` — adhan only, no iqamah published: Fajr 04:54, Dhuhr 13:21, Asr 17:03, Maghrib 20:01, Isha 21:45. The official site's Flutter embed serves no HTML
- **Jame Masjid / Islamic Propagation Centre** (5761 Coopers Ave, **Mississauga**) — `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=pQKMEGKB` — Fajr 05:18/05:45, Dhuhr 13:19/13:35, Asr 17:59/18:30, Maghrib 19:55/sunset, Isha 21:04/21:45
- **Hamilton Mountain Masjid** (hamiltonmosque.com 302s to mahcanada.com; 1545 Stone Church Rd E) — `https://masjidbox.com/prayer-times/muslim-association-of-hamilton?date=2026-08-31` — Fajr 05:22/05:45, Dhuhr 13:20/13:40, Asr 17:02/17:30, Maghrib 19:56/20:01, Isha 21:14/21:30
- **Umar Mosque** (734 Rennie St, Hamilton — same org as above, different building) — `https://masjidbox.com/prayer-times/mah-umar-mosque?date=2026-08-31` — Fajr 05:20/05:45, Dhuhr 13:19/13:35, Asr 17:00/17:40, Maghrib 19:55/20:00, Isha 21:18/21:45
- **Mount Pleasant Islamic Centre** (its own timetable names it **Masjid al-Salam**) — `https://www.prayertimedisplay.com/ptdp/ldt.php?masjid=MAS001` (static HTML) — Fajr 05:30/05:45, Dhuhr 13:20/13:45, Asr 17:03/17:30, Maghrib 19:58/20:03, Isha 21:22/21:45
- **Masjid ar-Rahmah / Assunnah Muslims Association** (1216 Hunt Club Rd, **Ottawa** — the tracker has this as Windsor; the 19:44 Maghrib proves Ottawa) — `https://app.mymasjid.ca/protected/public/timetable` — Fajr 04:56/05:26, Dhuhr 13:03/13:30, Asr 16:46/17:00, Maghrib 19:44/19:49, Isha 21:09/21:14, Jumu'ah 13:00
- **Noor-ul-Islam** (659 Lincoln Rd, Windsor) — `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=VL4WrjKx` — Fajr 05:21/05:50, Dhuhr 13:37/14:00, Asr 18:11/18:30, Maghrib 20:10/sunset, Isha 21:40/22:00, Jumu'ah 14:30
- **Islamic Society of Kingston** ("Islamic Centre of Kingston" is the building) — monthly PDFs at a stable path: `https://kingstonmuslims.ca/wp-content/uploads/2026/01/ISK-Prayer-Timings-August-2026.pdf` (all twelve 2026 months pre-published) — Fajr 05:05/05:45, Dhuhr 13:07/13:30, Asr 16:49/17:55, Maghrib 19:45/19:50, Isha 21:09/21:20
- **Islamic Society of Niagara Peninsula** (6768 Lyons Creek Rd, Niagara Falls) — `https://masjidbox.com/prayer-times/islamic-society-of-niagara-peninsula` — Fajr 04:58, Dhuhr 13:17, Asr 16:19, Maghrib 19:52, Isha 21:26. (Asr uses a Shafi'i-style calculation, hence earlier than neighbours)
- **Islamic Society of Vaughan** (islamicsocietyvaughan.com redirects to islamicsocietyvaughan.ca) — `https://themasjidapp.org/7680/prayers` — iqamah Fajr 05:35, Dhuhr 13:45, Asr 17:21, Maghrib 20:04, Isha 21:33. **Caveat:** the widget served a page dated Aug 29
- **Jamia Islamia Canada** (2380 Tedlo St, Mississauga) — `https://masjidbox.com/prayer-times/jamia-islamia-canada` — Fajr 04:58, Dhuhr 13:19, Asr 17:00, Maghrib 19:55, Isha 21:31. Also a yearly PDF at `jamiaislamia.org/images/prayertable.pdf`
- **Al-Nadwa Educational Islamic Centre** (2 Levendale Rd, Richmond Hill) — `https://masjidbox.com/prayer-times/al-nadwacentre` — Fajr 04:57, Dhuhr 13:18, Asr 16:59, Maghrib 19:55, Isha 21:31
- **Talimul Islam Masjid** (talimul.com redirects to /TuiSite/) — `http://talimul.com/TuiSite/prayer-services/` — plain HTML, dated Aug 31 2026: begin 05:18/13:19/17:58/19:56/21:20, iqamah 06:00/13:30/18:00/20:04/21:30
- **Owen Sound Muslim Association** (895 7th St E) — `https://masjidbox.com/prayer-times/owen-sound-muslim-association` — Fajr 05:20/06:05, Dhuhr 13:24/14:00, Asr 17:05/18:15, Maghrib 20:02/20:05, Isha 21:27/21:50, Jumu'ah 13:30/13:55
- **Meadowvale Islamic Centre** — **name correction: mici.org is Meadowvale Islamic Centre, not "Winston Churchill Mosque"** (6508 Winston Churchill Blvd is the address, not the name) — `https://themasjidapp.org/26/prayers` — iqamah Fajr 06:00, Dhuhr 13:45, Asr 18:30, Maghrib 20:06, Isha 21:30, Jumu'ah 13:30/14:15/15:00. Note mici.org/prayer-times/ returns HTTP 500
- **Masumeen Islamic Centre** (7580 Kennedy Rd, Brampton; own page `jaffari.org/venue/mic/`) — the jaffari.org widget genuinely fails, but the centre's own clock does not: `https://time.masumeen.org/` — Imsak 04:54, Fajr 04:59, Sunrise 06:42, Dhuhr 13:20, Sunset 19:56, Maghrib 20:13. Shia format, no separate Asr/Isha
- **Muslim Welfare Centre** (muslimwelfarecentre.com 302s to mwcanada.org) — the charity itself is not a masjid, but it runs a prayer space, **Musallah Al Abbas, 3490 Mavis Rd, Mississauga** — `https://mwcanada.org/prayer-times/` — Fajr 06:00, Dhuhr 14:00, Asr 18:15, Maghrib sunset, Isha 21:30, Jumu'ah 14:00 & 14:45 (changes Sep 6: Fajr 06:15, Asr 18:00, Isha 21:15). If the tracker has this at 100 McLevin Ave, Scarborough, it is mis-located — that address is offices and a food bank
- **Mosque Aisha Thorold** (70 St David St E, Thorold) — `https://masjidbox.com/prayer-times/mosque-aisha-1700257205934` — **flagged:** the feed publishes Fajr 06:15/06:20, Dhuhr 12:30/12:35, Asr 15:00/15:05, Maghrib 19:53/19:58, **Isha 18:30/18:35 — before Maghrib**. Ingest the URL, not the times
- **Muslim Association of Brantford** (192 Greenwich St) — `https://themasjidapp.org/brantford` — Fajr 05:20/06:00, Dhuhr 13:23/13:45, Asr 17:03/18:30, Maghrib 19:59/20:04, Isha 21:22/21:27, Jumu'ah 13:20 & 15:10
- **Islamic Centre of Brant** (143 King Edward St, **Paris ON** — a genuinely separate masjid, not the Brantford duplicate) — [icbrant.ca](https://icbrant.ca/), times at `https://themasjidapp.org/8088/prayers`, Jumu'ah 13:20
- **TROID / Masjid al-Furqān** (874-A Weston Rd, Toronto) — `https://masjidbox.com/prayer-times/troid` — Fajr 05:30, Dhuhr 13:30, Asr 17:20, Maghrib 19:59, Isha 21:30, Jumu'ah 13:30
- **Islamic Forum of Canada** (200 Advance Blvd, Brampton) — [islamicforumonline.com](https://islamicforumonline.com/) — `https://themasjidapp.org/en-us/islamic-forum-of-canada` — adhan 04:55/13:21/17:02/19:59/21:43 (no iqamah feed); site's own page gives Dhuhr 13:20/13:30 and Jumu'ah 13:00 & 14:30
- **Jamiat al-Ansar of Brampton** — **domain correction: jamiatulansar.ca is dead, the live site is [jamiatalansar.ca](https://jamiatalansar.ca/)** ("al", not "ul") — `https://masjidbox.com/prayer-times/jamiat-ul-ansar`. Address to resolve: the site says 1 Masjid Drive L6R 2Z4, Masjidway says 391 Great Lakes Dr L6R 2W7
- **Kanata Muslim Association** — **no browser render needed after all**; the times are in static HTML, published as adhan–iqamah ranges, which is what made them run together. Fajr 04:57 (+30), Dhuhr 13:04/13:30, Asr 16:47/17:45, Maghrib 19:43, Isha 21:10/21:20, Jumu'ah 13:00, 14:15, 16:15
- **Oshawa Mosque** — the homepage really is stuck on 2019, but a current feed exists: `https://masjidbox.com/prayer-times/islamic-centre-of-oshawa-1741794782213?date=2026-08-31` — Fajr 05:14/06:30, Dhuhr 13:16/13:30, Asr 16:57/18:00, Maghrib 19:53/19:20, Isha 21:17/21:00. **Their Maghrib and Isha iqamah fields are earlier than adhan** — a publisher-side quirk, reproduced as-is
- **Hamza Mosque / Parkdale Islamic Education Centre** (1287 Queen St W) — [hamzamasjid.com](https://www.hamzamasjid.com/) — `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=PAPwepLJ` — Fajr 05:17/05:45, Dhuhr 13:18/13:45, Asr 17:00/17:45, Maghrib 19:58/sunset, Isha 21:18/21:30
- **Darul Uloom Canada** (51 Prince St N, **Chatham**) — `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=VKpeDBLP` — adhan Fajr 05:13, Dhuhr 13:29, Asr 18:08, Maghrib 20:04, Isha 21:26. Iqamah is published only on change-dates
- **Sarnia Muslim Association** — **the tracker's URL is a third-party directory page; the real org is [sarniamuslim.com](https://sarniamuslim.com/)** — `https://timing.athanplus.com/masjid/widgets/monthly?theme=1&masjid_id=DAgvk6L0` — adhan 05:30/13:30/18:09/20:09/21:28, iqamah 05:30/14:00/19:00/sunset/22:50, Jumu'ah 13:45
- **Islamic Society of Belleville** — the Mawaqit *display* is flagged Offline, but the **Mawaqit REST API still serves the data**: `https://mawaqit.net/api/2.0/mosque/search?word=Belleville` — Fajr 05:07, Dhuhr 13:10, Asr 16:53, Maghrib 19:47, Isha 21:12; iqamah 05:30, 13:45, 17:30, Maghrib +5, 21:30, Jumu'ah 13:30
- **Usman Ghousi Masjid** (75 Kirkdene Dr, Scarborough) — [usmanghousimasjid.com](https://usmanghousimasjid.com/) — hand-maintained, latest posted iqamah (Aug 27): Fajr 06:00, Dhuhr 13:45, Asr 18:45, Maghrib sunset, Isha 21:45. No Aug 31 row
- **Afghan-Canadian Islamic Community** (22 Hobson Ave, North York) — [afghancanada.com](https://www.afghancanada.com/) — partial: Fajr 04:57, Dhuhr 13:19, Maghrib 20:12; monthly page at `/monthly-prayer-time`
- **al-Hussain Foundation Centre** — `https://www.alhussainfoundation.ca/prayer-time/august/` (PDF at `/wp-content/uploads/PrayerTime_August.pdf`) — Fajr 05:09, Zuhr 13:18, Maghrib 20:11. **Shia centre — no Asr/Isha columns by design**, not a scrape failure
- **Richmond Hill Muslim Association** — `https://rhmacanada.com/prayers` — a fixed year-round schedule, not a daily table: Zuhr 13:30, Asr 17:30, Maghrib after sunset; **no Fajr, no Isha published**. Jumu'ah 13:30/14:00 and 14:30/14:35

## 2. Real site and real times, one manual step first (1, was 4)

- [Al-Arqam Islamic Centre](http://www.alarqam.ca/) (1709 Harmony Rd N, Oshawa) — the domain returns head-only, and its times live on `https://portal.ad-din.ca/public/mediumdisplay/151`, which is also JS-only with no static fallback. Needs a rendered browser or the Ad-Din API
- ~~Kanata Muslim Association~~ — resolved, §1b
- ~~Oshawa Mosque~~ — resolved, §1b
- ~~Al Mahdi Islamic Community Centre~~ — explained, §4

## 3. Times read but impossible (1 still open, was 5)

- [Bosnian Canadian Islamic Centre](https://bkic.ca/) — **still flagged, but the diagnosis has changed.** The published set is adhan 03:58 / 13:26 / 17:31 / 21:06 / 22:54 and iqamah 05:00 / 13:36 / 17:41 / 21:16 / 22:45, Jumu'ah 13:20. The first pass called it "~1h early"; it is not a uniform offset — Maghrib 21:06 is an hour *late* against a London ON sunset of ~20:04 while Fajr is 1.5h early. That pattern is a **frozen summer-solstice schedule** (late June), and Dhuhr only looks right because Dhuhr barely moves. Iqamah Isha also precedes adhan Isha. Contact the masjid; do not publish
- ~~Jami' Masjid Zakariya~~, ~~Muslim Association of Tillsonburg~~, ~~Mevlana Masjid~~ — all three resolved into §1a. Read correctly all along
- [Zawiya Fellowship — Annoor Jami Mosque](https://zawiyafellowship.com/prayers-schedule/) — **not impossible, just not published.** The site only ever gives Zuhr 13:30 and Jumu'ah khutba 13:30, plus "Majlis and Zikr between Maghrib and Isha" with no times. There is no Fajr/Asr/Maghrib/Isha anywhere to confirm or refute the original 04:36. (The nav link `/prayer-schedule/` 404s; the real path is `/prayers-schedule/`.) Move to §5

## 4. Times read but a prayer was blank (3) — all explained

- [Imam Mahdi Islamic Centre](https://imammahdi.ca/) — **correct as-is.** The site states it publishes only Fajr, Dhuhr and Maghrib; sunrise, sunset and midnight are reference times, not prayers. Method: Institute of Geophysics, University of Tehran. Its `/prayer.html` computes client-side, so today's values need a render
- [Al Zahra Shia Association of Waterloo Region](https://www.alzahra.ca/) — **correct as-is.** Fajr 05:02, Dhuhr 13:23, Maghrib 20:15. There is no Asr or Isha *column* on the page at all
- [Islamic Centre of Cambridge](http://iccambridge.com/) — **first-pass claim refuted. The widget is not frozen.** It shows August 31, 2026 (18 Rabi al-Awwal 1448): Fajr 05:21/05:45, Dhuhr 13:22/13:45, Asr 17:04/18:30, Maghrib 20:00/20:03, Isha 21:23/21:45. "Juma Khutbah 13:30 and 14:45" is a **separate row**, not something occupying the Dhuhr slot — the blank Dhuhr was a parsing error on our side. **This one can go live**
- [Al Mahdi Islamic Community Centre](https://almahdicentre.org/) — confirmed: Imsak 05:06, Fajr 05:26, Sunrise 06:48, Dhuhr 13:25, Sunset 20:02, Maghrib 20:17. Asr and Isha appear nowhere — expected for a Shia centre combining prayers

## 5. Website loads, no times found (~20 remain, was 81)

Beyond the 30 resolved in §1b, these are the ones where the site is genuinely live and
still yields nothing.

**Mawaqit-hosted, JS-only (4).** Mawaqit's HTML pages resist every JS-free fetch, including
the `/w/` widget path. **But its REST API is open and returns static JSON** —
`https://mawaqit.net/api/2.0/mosque/search?word=<term>` gives `site`, `slug`,
`localisation` and a `times` array `[Fajr, Shuruq, Dhuhr, Asr, Maghrib, Isha]` for today.
That is the fix for this whole group.

- **Masjid an-Noor, St. Catharines** — slug `noor-st-catharines`
- **Islam Care Centre, Ottawa** (Knox Presbyterian basement, 120 Lisgar St; Jumu'ah 12:30 & 13:15) — slug `islam-care-center-ottawa-k2p-0k1-canada`
- **Darul-Uloom Ottawa** — slug `darul-uloom-ottawa-k1c-1g6-canada`
- **SNMC / South Nepean Muslim Community** — slug `south-nepean-muslim-community-snmc-ottawa-k2j-4g3-canada`. **Warning:** `snmc.ca/prayer/` is a stale-data trap — its iqama table still covers 1 Sep – 5 Oct **2017** and looks plausible. Schedule change effective Fri 4 Sep 2026: 1st Jum'a 13:00, 2nd 14:15

**Other widget hosts, not readable (2).**

- **Mississauga Muslim Community Center** — `mosqueassistantonline.com/Widget/DailyPrayerCalendar?account=402510`, robots-blocked
- **Islamic Community of West Niagara** (4287 William St, Beamsville) — `masjidbox.com/prayer-times/icwn` renders empty on every variant while other MasjidBox slugs render fine, so the feed itself looks unpopulated. A second domain, westniagaraislam.ca, was unreachable

**Genuinely publish nothing daily (7).**

- **Sudbury Mosque** (Islamic Association of Sudbury, 755 Churchill Ave) — Jumu'ah khutba 12:30 only
- **Imam Ali (AS) Masjid** (1606 Walkley Rd, Ottawa) — states that Zuhr, Asr, Maghrib and Isha congregations are held, with no times, and no Fajr congregation. Shia; will not fit a 5-slot schema
- **Albanian Muslim Society of Toronto** — daily times exist only inside downloadable 2026 PDF calendars; Jumu'ah 12:30–13:00, Mar 15 – Nov 8
- **Cornwall Islamic Centre** — `/prayer-times/` is a JS-only Elementor shell with no widget host behind it. (Do not confuse with cornwallislamiccentre**.org**, a different mosque in the UK)
- **Whitby Muslim Society** — **by design:** the site states "NO Daily Salahs". Jumu'ah only, 13:45, 201 Centre St S. Mark as "no daily prayers held", not a scrape failure
- **Peterborough Lakefield Mosque** (brands itself Jamia Masjid Ali Ul Murtaza; Selwyn/Lakefield, not Peterborough proper) — Jumu'ah 13:40 only, plus Maghrib and Isha Thursday–Sunday. A part-time facility
- **Port Hope Muslim Community** — no prayer-times page; only a stale "Jumah Salah, June 5 2026, 1:35 pm" event
- **Islamic Association of Sault Ste. Marie** (2 Towers St) — Jumu'ah only: khutbah 14:00, salat 14:30
- **Uyghur Mosque** — no times, no widget. **City correction: the mosque moved to 2299 Troy Rd, Troy ON (Flamborough) in Sept 2021.** It is not in Toronto, and MuslimLink's Mississauga address is also stale
- **Al-Taqwa Mosque, London** — altaqwamosque.com is a **fundraising site for a mosque not yet built**. The operating prayer space is Al-Taqwa Academy, [altaqwa.ca](https://altaqwa.ca/), 1837 Churchill Ave: five daily prayers on site, **iqama = adhan + 15 min**, Jumu'ah 13:30. Swap the URL and record the rule. **Do not link `masjidbox.com/prayer-times/al-taqwa` — that is a different Al-Taqwa, in Helsinki**
- **St. Thomas Islamic Centre** — 403s to fetchers, confirmed. No MasjidBox/AthanPlus/Mawaqit id found, and the Prayers Connect mirror 503s. Still needs a hand check
- **Masjid Huzaifah** (18 Progress Ave, Scarborough) — **first-pass claim refuted: there is no Mawaqit slug.** The site pulls from its own `dashboard.masjidhuzaifah.com/MainWebsiteTable.html`, JS-populated. Its themasjidapp listing is stale at Aug 28 and marked Unclaimed
- **Zainabiya Community Centre** — **URL correction: `jaffari.org/zic/` is wrong, the page is `jaffari.org/zcc/`.** In Barrie/Thornton, renting the former Countryside United Church; no street address published. The widget's "Prayer times are unavailable for this location" is a genuine upstream failure at jaffari.org, which also affects `/resources/salaat-timings/`

**Not a duplicate after all.**

- **Al-Rashid Islamic Institute** (18345 County Rd 2, South Glengarry/Cornwall) is a **separate institution** from Jami' Masjid Zakariya (333 Second St E, Cornwall), ~10 km apart. Same Deobandi orbit, but no published parent/child relationship on either site. Keep both entries. alrashid.ca is a JS-only shell; `alrashid.ca/contact-us.php` works

## 6. Only a shared organisation homepage (4 remain, was 10)

- **Faizan-E-Madinah Hamilton** and **Madina Masjid Ottawa (Dawat-e-Islami)** — confirmed: dawateislamicanada.net has no per-branch pages and no times anywhere. Branches appear only as lines on `/contact-us`: **Faizan-E-Madina Hamilton, 1202 Dunsmure Rd, Hamilton L8H 1L4** and **Faizan-E-Madina Islamic Center, 415 McArthur Ave, Ottawa K1K 1G5** — those addresses are the one new datum
- **Baitun Nusrat Mosque** (815 Upper Sherman Ave, Hamilton) — absent from the ahmadiyya.ca directory. Note the directory's other Hamilton entry, Baitun Nur at 2301 King St E, is a **different mosque**
- **Baitur-Rasheed Mosque** (70 Charterhouse Cres, London) — absent from the directory; existence confirmed via Doors Open Ontario. No standalone site
- ~~Baitul Quddus Mosque~~ — **resolved: a branch page does exist, slugged by city.** `https://ahmadiyya.ca/mosque/st-catharines/` — 1421 Gregory Rd, St. Catharines L2R 6P9. No times on it
- ~~Halton Islamic Association~~ — resolved, §1a
- ~~Mosque Aisha Thorold~~ — resolved, §1b (and it was mis-filed here: it always had its own single-mosque site)
- ~~Brantford Mosque~~ / ~~Islamic Centre of Brantford~~ — **one masjid, merge them.** Both URLs are the Muslim Association of Brantford, 192 Greenwich St. **North End Centre** (627 Park Rd N, Unit 8) is a real separate location under the same org, with a separately published **Jumu'ah 13:55** but no daily table of its own

### The Ahmadiyya cluster — one bad URL path, nine entries

**Every `ahmadiyya.ca/mosques/<slug>` URL in the tracker is a 404. The live path is
`ahmadiyya.ca/mosque/<slug>/`** (singular), and the directory is at
`https://ahmadiyya.ca/mosque/` — 26 branches, 15 in Ontario. Corrected URLs:

| Entry | Working URL | Address |
| --- | --- | --- |
| Baitul Ahad | `/mosque/baitul-ahad/` | 546 Beaverbrook Ave, London N6H 2M6 |
| Baitul Islam (national HQ) | `/mosque/baitul-islam-mosque/` | 10610 Jane St, Maple L6A 3A2 |
| Masjid Baitun Nasir | `/mosque/masjid-baitun-nasir/` | 341 Balmoral Ave, Cornwall K6H 3G6 |
| Baitun Nur | `/mosque/baitun-nur-mosque/` | 2301 King St E, Hamilton L8K 1X6 |
| Masjid Mubarak | `/mosque/masjid-mubarak/` | **10545 Hurontario St, Brampton L6Z 2V9** |
| Baitul Karim | `/mosque/baitul-karim/` | 5 Elliott St, Cambridge N1R 2J3 |
| Baitul Mahdi | `/mosque/baitul-mahdi/` | 3505 Salem Rd, Pickering L0H 1J0 |
| Maryam Mosque | `/mosque/maryam-mosque/` | 110 Line 7 South, Oro-Medonte L0L 2X0 |
| Baitul Ehsan | `/mosque/baitul-ehsan/` | **1957 Head Ave, Windsor N8W 1V7** — the tracker's "Ehsaan" spelling is the whole reason it 404'd |
| Baitul Hamd | `/mosque/baitul-hamd/` | 1194 Matheson Blvd E, Mississauga L4W 1R2 |
| Baitun Naseer | `/mosque/baitun-naseer/` | 2620 Market St, Cumberland K4C 1A3 |
| Hadiqa Ahmad | `/mosque/hadiqa-ahmad/` | 3999 10th Side Rd, Bradford L3Z 2A5 |

Two cautions. **Masjid Mubarak's page footer carries the Maple HQ address** — a naive scrape
picks up the wrong one; the directory entry says Brampton. And **Baitul Khabir is not in the
directory under any name**: it is the Ahmadiyya mosque on Elizabeth St, Bradford West
Gwillimbury, which is a *different site* from Hadiqa Ahmad at 3999 10th Side Rd in the same
town — do not merge them.

**No Ahmadiyya branch page publishes prayer times, anywhere.** The org publishes times
**by city, not by mosque**, at `https://ahmadiyya.ca/prayer-times` — astronomical times with
no iqamah and no Jumu'ah. Its default view currently renders **October 2025**, so anything
scraped from it without explicit year and month will be silently stale. The realistic
outcome for this whole cluster is address-and-URL correctness, not times.

## 7. No website found in OSM or Google (~20 remain, was 56)

**25 of the 56 have a findable website** — the first pass found 16, the second pass found
9 more that the first had written off. Those with quotable times are in §1b (Ummah
Nabawiah, Dar Al-Hijrah, Islamic Society of York Region, Usman Ghousi, Hamza Mosque,
Afghan-Canadian, Kanata, Oshawa, Al-Arqam) or listed by URL here.

**Found in the second pass, no readable times yet (8):**

- **Rhoda Masjid and Institute** — [rhodainstitute.org](https://rhodainstitute.org) (robots.txt disallows all paths)
- **Islamic Shia Ithna Asheri Association of Ottawa** — [isiaottawa.com](https://www.isiaottawa.com/), 3856 Old Richmond Rd, Nepean K2H 5C4. Publishes an annual schedule, no daily widget
- **Hawkesbury Islamic Cultural Centre** — [hicc-ccih.org](https://hicc-ccih.org/); Mawaqit mosque id 39560, slug `hawkesbury-islamic-community-centre-hawkesbury-k6a-1b2-canada`. **Address correction: 388 Main St E, not 651**
- **Musalla As-Sahaba** — operator is **Dār as-Ṣaḥāba Association**, [dar-as-sahaba.com](https://dar-as-sahaba.com/), 2835 Dumaurier Ave, Ottawa K2B 7W3. JS-only shell
- **Istiqlal Mosque** — **Istiqlal Islamic Centre of Toronto**, [istiqlal.ca](https://www.istiqlal.ca/), 14369 Trafalgar Rd N, Ballinafad (Halton Hills). Has an empty "Prayer Times" section
- **Jannatul Ferdous Mosque** — [jannatulferdous.ca](https://jannatulferdous.ca/), unit #11, 1701 Martin Grove Rd. Own widget shows "[Loading]"; Jumu'ah 13:00 and 14:00
- **MAC Qurtuba Islamic Centre** — no standalone domain, but a real parent-org page: `https://chapters.macnet.ca/ottawa/qurtuba-islamic-centre/`. **Address: 1085 Grenon Ave, Ottawa K2B 8L7**
- **MUSALLAH QUMSA** — [qumsa.ca/prayer](https://qumsa.ca/prayer). Congregational times are posted as a monthly **image**, so nothing machine-readable. Main musalla is **JDUC Room 348**, plus rooms in Mitchell Hall, Goodes, Stauffer, Medicine and Law

**Confirmed no dedicated website (7):**

- **Bab ul Ilm – Bani Hashim Society** (Mississauga) — Facebook/YouTube and an al-islam.org org page only
- **Albatool Fatima Association** (2575 Bond St, Ottawa; MuslimLink spells it **Al-Batool**)
- **Al-Hikmah Centre Inc** — aggregator listing only (`masjidway.com/masjid/12713/prayer`)
- **Al-Fatema Islamic Center** (Guelph) — Facebook only
- **Muslim Youth Association of London** — aggregator only (`masjidway.com/masjid/4272-...`)
- **Baitul Haleem Ahmadiyya Mosque** (Brantford) — absent from the ahmadiyya.ca directory too
- **Al-Huda Islamic Centre, Toronto** — **not a duplicate of Al Huda Institute Canada.** This is **Al-Huda Muslim Society, 975 Kennedy Rd, Scarborough M1S 3N7**. The real duplicate pair is elsewhere: Al Huda Institute Canada (alhudainstitute.ca) is legally *"Al-Huda Islamic Centre of Canada", 5671 McAdam Rd, Mississauga* — those two are one entity

**Not re-checked — the search quota ran out (12).** These were checked once in the first
pass and marked "no website"; the second pass could not independently confirm that, so
treat the label as unverified rather than settled:

Ahlul-Bayt Mosque (Windsor) · Masjid Daru-Al-Ullum (16 Orfus Rd) · Alexandria Islamic
Centre · Islamic Centre of Port Hope · Timmins Masjid & Community Centre · Jamaat of
Ontario · Stratford Mosque · Naqshbandi Sufi Toronto · Canadian Islamic Civic Academy ·
Baitul Jannah Islamic Center · Al-Moustafa Islamic Centre (Hamilton) · Baitul Aman
Masjid. Two partial results survive: **almoustafa.ca returns NXDOMAIN** — genuinely gone,
not misconfigured; and **Baitul Aman Masjid** has a live current site,
[danforthcommunitycenter.org](https://danforthcommunitycenter.org/) (3114 Danforth Ave,
Scarborough, "always open for five daily prayers"), replacing the dead torontomuslims.com
listing — its body is JS-rendered, so no times yet.

**8 Ismaili jamatkhanas — not scrapeable by design.** Meadowvale, the generic "Ismaili
Jamatkhana" entry, Ismaili Centre Toronto, Ismaili Jamat Khana (Conroy Rd), Don Mills,
Brampton, Hamilton, Kingston — plus **Ismaili Jamatkhana Scarborough**, whose tracker URL
(`ismaili.net/heritage/node/21420`) is a third-party heritage archive stub, not an
official site, and **Kitchener HQ Jamatkhana**, whose URL `the.ismaili` is a global portal
SPA (the jamatkhana is at 299 Lawrence Ave, Kitchener N2M 5B6). None publish a public
five-prayer timetable; treat the whole cluster as out of scope rather than broken.

## 8. Not a mosque — remove from the tracker (3 confirmed, 1 refuted)

- **Muslim Social Services Waterloo Region** — confirmed a counselling and social-services charity. **Remove**
- **MRCSSI** — confirmed a family-violence prevention and research charity. **Remove**
- **Cornwall Islamic Foundation** — confirmed a registered private online school, Grades 1–8. **Remove**
- **Muslim Wellness Network** — **refuted. Keep it.** Its own FAQ says "Yes all daily prayers will be offered" and gives a weekly Jumu'ah at 14:30 or 13:30 depending on DST, at 990 Gainsborough Rd, London. Its `/prayer-times` page 404s — flag as "times page broken", not "not a mosque"
- **The Clear Islam Information Center** — real site found, [windsor.theclearislam.org](https://windsor.theclearislam.org/), 471 Pelissier St, Windsor (replacing the Google Calendar link the tracker holds). It presents itself as a dawah and education hub, not a prayer space — **strong candidate for removal on the same grounds**

## 9. Tracker data is wrong (7) — fix the entry, not the website

- **Mosque Lake** (North Frontenac) — confirmed a **lake** near Ompah, with a boat launch and cottage rentals. Not a mosque. **Delete**
- **Faith Mosque — "182"** — confirmed **Fatih Mosque, 182 Rhodes Ave, Toronto M4L 3A1**, run by the United Canadian Muslim Association. No own website found. Fix the name and address
- **House of the Commandments** — confirmed **House Of The Commandments – Masjid Ul Islam, 100 King St, Trenton (Quinte West) K8V 3W2**. Directories list `itfc3.godaddysites.com` as its site, but robots.txt blocks it, so treat that URL as unconfirmed
- **The Reign of Islamic Da'Wah** — confirmed **TROID**, and it does publish times. Resolved into §1b
- **Islamic Forum of Canada** — confirmed a real Brampton masjid with a site. Resolved into §1b
- **(unnamed)**, **Mosque**, **Masjid Mosque** — three entries with no usable name or address. Trace back to the source record or remove

---

## What to fix in the pipeline

The audit's own numbers moved most because of scraper behaviour, not because masjids
changed anything. In rough order of value:

1. **Follow widgets to their host.** MasjidBox, AthanPlus, TheMasjidApp, MOHID,
   PrayerTimeDisplay and Ad-Din all serve static text at a predictable URL once you pull the
   `masjid_id` or slug out of the page's iframe. This one change accounts for most of the
   30 entries in §1b.
2. **Use the Mawaqit REST API**, `mawaqit.net/api/2.0/mosque/search?word=<term>`, not the
   Mawaqit HTML. It returns today's six times as JSON and works even when the mosque's
   display is flagged Offline (Belleville proved that).
3. **Follow cross-host redirects.** hamiltonmosque.com → mahcanada.com,
   islamicsocietyvaughan.com → .ca, talimul.com → /TuiSite/, muslimwelfarecentre.com →
   mwcanada.org were all scored as failures.
4. **Probe more paths than `/`.** `/prayer-times/`, `/prayers/`, `/prayer-timings/`,
   `/prayer-schedule/`, `/monthly-prayer-times/` — and note that the wrong spelling 404s, so
   try several.
5. **Distinguish "no times" from "no daily prayers".** Whitby, Peterborough Lakefield, Port
   Hope and Sault Ste. Marie hold Jumu'ah only. That is a fact about the masjid, not a
   failure to record.
6. **Stop forcing Shia centres into five slots.** Imam Mahdi, Al Zahra, Al Mahdi, Masumeen
   and al-Hussain all combine prayers by design. Every one currently reads as "missing a
   prayer".
7. **Detect frozen sources.** Oshawa (2019), SNMC (2017), Ebu Bekir (2019) and Bosnian CIC
   (a solstice schedule) all serve plausible-looking numbers that are years old. A date
   assertion on the page would catch all four.

And two entries whose "dead" label was wrong: **Ebu Bekir Islamic Centre** loads fine
(238 Parkdale Ave N, Hamilton) — its *schedule* is stale, headed "Starting Saturday,
August 10, **2019**" — and **jiccwindsor.org** failed DNS on repeated attempts here but is
still indexed and listed as the Jafri Islamic Centre's active site; re-test it from
another network before deleting the entry.

---

*Audited 2026-08-31 in two passes. Every quoted time was read from the masjid's own site or
its own widget feed that day and should be re-checked before long-term reliance — several
sources in this list were independently found to carry stale or internally inconsistent
data. The 12 entries in §7 marked "not re-checked" ran into an exhausted search quota and
are the one open gap.*

---

> **Everything below is the original pre-audit listing.** The 2026-08-31 audit above
> re-checked it entry by entry and supersedes it wherever the two disagree. It is kept
> because the audit refers back to this per-entry detail without repeating it.

# Masjids found but not live (155)

The app currently shows **134**. These are the rest, grouped by what is
actually blocking each one. The groups need different work, so they are kept apart.

| Blocked by | Count | What would unblock it |
| --- | ---: | --- |
| Times read but impossible | 5 | Check the site yourself and send the real times |
| Times read but a prayer was blank | 3 | Same — one missing prayer each |
| Website loads, no times found | 81 | Re-run the scraper, or find their times page by hand |
| Only a shared org homepage | 10 | Find that branch's own page |
| No website in OSM or Google | 56 | Search for one by name — several of these DO have sites |

---

## 1. Times read but impossible (5) — cheapest to fix

We got times, but they cannot be right. Open the site, and if you can see the real
times, send them over and these go live immediately.

- [Jami' Masjid Zakariya](https://cornwallmasjid.ca/) — Fajr 04:30 and Isha 23:15 both fall outside any Ontario schedule — verify
- [Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/) — Isha 19:00 falls before Maghrib (~20:05 in Tillsonburg) and Asr 15:15 is hours early — the whole row is misread, not just one cell. Verify against the masjid.
- [Bosnian Canadian Islamic Centre](https://bkic.ca/) — Maghrib 21:06 / Fajr 03:58 / Isha 22:54 look like Bosnian local time, not Ontario — verify
- [Mevlana Masjid](https://a-than.info/vv.php?code=MEVLANA01) — Maghrib 19:09 is ~55 min before sunset in Toronto — verify against the masjid
- [Zawiya Fellowship - Annoor Jami Mosque](https://zawiyafellowship.com/) — Fajr 04:36 is ~1h earlier than neighbouring masjids — verify

## 2. Times read but a prayer was blank (3)

Everything read except one or two prayers. Note the Shia centres are legitimately
combining prayers, so a blank there may be correct rather than a bad read.

- [Imam Mahdi Islamic Centre](https://imammahdi.ca/) — no asr, isha
- [Al Zahra Shia Association of Waterloo Region](https://www.alzahra.ca/) — no asr, isha
- [Islamic Centre of Cambridge](http://iccambridge.com/) — no dhuhr

## 3. Website loads but no times found (81)

The realistic target. Some are transient; some genuinely publish nothing online.

- [Isna Canada](https://www.isnacanada.com/) — no times found on the page
- [Sayeda Khadija Centre](https://www.sayedakhadijacentre.com/) — no times found on the page
- [Al Huda Institute Canada](https://alhudainstitute.ca/) — site could not be opened
- [Jame Masjid](https://ipcontario.com/) — no times found on the page
- [Jami Mosque](http://www.isnacanada.com/our-spaces/jami-masjid/)
- [Islamic Research Center of Canada Inc.](http://www.irccan.com/)
- [Ismaili Jamatkhana Scarborough](https://ismaili.net/heritage/node/21420) — no times found on the page
- [Masjid Huzaifah](https://www.masjidhuzaifah.com/) — no times found on the page (page text holds 7 prayer names and 7 times)
- [Hamilton Mountain Masjid](https://hamiltonmosque.com/) — no times found on the page
- [London Muslim Mosque](http://www.londonmosque.ca/)
- [Islamic Centre of Southwest Ontario](https://islamiccentre.ca/) — no times found on the page
- [Baitul Ahad Mosque](https://www.ahmadiyya.ca/mosques/baitul-ahad) — site could not be opened
- [Jamiat-Ul-Ansar of Brampton](http://www.jamiatulansar.ca/) — site could not be opened
- [Baitul Islam Mosque](https://www.ahmadiyya.ca/) — site could not be opened
- [Masumeen Islamic Centre](https://jaffari.org/) — low confidence (0.3)
- [Islamic Society of Belleville](http://bellevillemasjid.ca/)
- [Sudbury Mosque](http://www.iasudbury.com/)
- [Abu Thar al-Gofary Mosque, Ottawa](https://www.facebook.com/AbuTharAlGhafariMosque/)
- [Mount Pleasant Islamic Center](https://www.mpicbrampton.com/) — site could not be opened
- [Umar Mosque](https://www.mahcanada.com/mosques/umar) — no times found on the page
- [SNMC Center & Masjid](https://www.snmc.ca/) — site could not be opened
- [Masjid Noor-ul-Haram](https://wimcanada.com/) — no times found on the page
- [Masjid ar-Rahmah](https://www.mymasjid.ca) — no times found on the page
- [Iman Ali (As) Masjid](https://imamalimasjid.ca/)
- [Noor-ul-Islam](https://noorulislam.ca/)
- [Baitul Ehsaan Mosque](https://www.ahmadiyya.ca/mosques/baitul-ehsaan) — site could not be opened
- [Islamic Centre of Kingston](http://www.kingstonmuslims.ca/)
- [Winston Churchill Mosque](https://mici.org/)
- [Baitun Nasir Mosque](https://www.ahmadiyya.ca/mosques/masjid-baitun-nasir) — site could not be opened
- [Baitun Nur Mosque](https://www.ahmadiyya.ca/mosques/baitun-nur-mosque) — site could not be opened
- [Masjid Al-Salaam](https://www.kmrapeterborough.org/)
- [Mubarak Mosque](https://www.ahmadiyya.ca/mosques/masjid-mubarak) — site could not be opened
- [Baitul Karim Mosque](https://www.ahmadiyya.ca/mosques/baitul-karim) — site could not be opened
- [Baitul Mahdi Mosque](https://www.ahmadiyya.ca/mosques/baitul-mahdi) — site could not be opened
- [Mary Mosque (Maryam Mosque)](https://www.ahmadiyya.ca/mosques/maryam-mosque) — site could not be opened
- [Baitul Khabir](http://www.ahmadiyya.ca/)
- [Owen Sound Muslim Association](https://osmuslim.ca/) — no times found on the page
- [Erin Islamic Cultural Center](https://erinislamiccenter.ca/) — site could not be opened
- [Muslim Welfare Center (Masjid and Food Bank)](https://www.muslimwelfarecentre.com/) — no times found on the page
- [Masjid an-Noor](https://islamicsocietyofstcatharines.ca/)
- [Baitul Aman Masjid](http://www.torontomuslims.com/listing/baitul-aman-mosque-danforth-community-center/) — no times found on the page
- [Islam Care Centre](http://islamcare.ca/)
- [Albanian Mosque - Albanian Muslim Society of Toronto](https://www.albmuslim.ca/) — site could not be opened
- [Islamic Society of Niagara Peninsula](https://isnp.ca/) — no times found on the page
- [Darul-Uloom](http://www.darululoomottawa.org/)
- [al-Hussain Foundation Centre](https://www.alhussainfoundation.ca/)
- [Islamic Society of Vaughan](http://www.islamicsocietyvaughan.com) — no times found on the page
- [Cornwall Masjid](https://cornwallislamiccentre.ca/) — site could not be opened
- [Jamia Islamia Canada](http://www.jamiaislamia.org/) — no times found on the page
- [Mississauga Muslim Community Center](https://mmcc-canada.org/) — site could not be opened
- [Richmond Hill Muslim Association](http://rhmacanada.com/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Al-Nadwa Educational Islamic Centre](https://alnadwacentre.ca/) — site could not be opened
- [Talimul Islam Masjid](https://talimul.com/) — no times found on the page
- [WHITBY MUSLIM SOCIETY (Masjid)](https://whitbymuslims.ca/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Masjid Subhan Ajax](https://www.subhanislamicassociation.org/) — site could not be opened
- [Islamic Centre of Bowmanville](https://icbmasjid.com/) — site could not be opened
- [Mohawk Mashjid/Mosque (Room A006c)](https://www.facebook.com/MHAWK.ISA/) — no times found on the page
- [Ebu Bekir Islamic Centre](http://www.ebu-bekir.com) — site could not be opened
- [Islamic Community of West Niagara](http://www.icwn.ca/) — site could not be opened
- [Masjid - Muslim Society of Guelph](http://www.msofg.org/) — site could not be opened
- [Kitchener Headquarters Jamatkhana - Ismaili Community Centre](https://the.ismaili/) — no times found on the page
- [Muslim Social Services Waterloo Region](http://msswr.org/) — no times found on the page
- [Muslim Wellness Network](https://www.muslimwellness.ca/) — no times found on the page
- [Al Mahdi Islamic Community Centre](https://almahdicentre.org/) — low confidence (0.4)
- [Al-Taqwa Mosque](https://altaqwamosque.com/) — no times found on the page
- [St. Thomas Islamic Centre](https://stislamiccentre.com/) — site could not be opened
- [Muslim Resource Centre for Social Support & Integration (MRCSSI)](https://mrcssi.com/) — no times found on the page
- [The Clear Islam Information Center](https://calendar.google.com/calendar/u/0/appointments/schedules/AcZssZ0z4t60o92hvea5hLZI3nZvR_nmE2GOQM9KPaDn-AlVXlHgjsTbX03JQX9X_8M99zffqbwZsfzA?pli=1) — site could not be opened
- [Imam Hussain Foundation](http://facebook.com/ihfwindsor) — no times found on the page
- [Jafri Islamic Centre of Canada (Shia Mosque)](https://jiccwindsor.org/) — site could not be opened
- [Darul Uloom Canada](http://www.ducanada.org/) — no times found on the page
- [Sarnia Masjid](http://www.bangladesh2000.com/bdcom/islam/dir/masjid_directory_ontario.html) — no times found on the page
- [Uyghur Mosque](http://www.uyghurmosque.com/) — no times found on the page
- [Zainabiya Community Centre](https://jaffari.org/zic/) — reader returned nothing (page text holds 4 prayer names and 12 times)
- [Masjid Al-Abrar](http://www.alabrar.ca/) — site could not be opened
- [Al-Rashid Islamic Institute](http://www.alrashid.ca/) — no times found on the page
- [Cornwall Islamic Foundation](http://cornwallislamicfoundation.ca/) — no times found on the page
- [Peterborough Lakefield Mosque Masjid (Ahle Sunnah Wal Jamaah)](https://peterboroughmosque.ca/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Port Hope Muslim Community (Masjid/Mosque)](http://porthopemuslim.ca/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Islamic Centre of Northern Ontario](http://www.iconosudbury.com/) — site could not be opened
- [Islamic Association of Sault Ste. Marie](http://www.iassm.ca/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)

## 4. Only a shared organisation homepage (10)

Their listed site is a national homepage shared by many branches, so scraping it
would give every branch the same times. Each needs its own page found first.

- [Halton Islamic Association (HIA) - Masjid](http://www.masjidhalton.com/)
- [Faizan-E-Madinah Hamilton Masjid & islamic centre](http://www.dawateislamicanada.net/)
- [Baitun Nusrat Mosque](http://ahmadiyya.ca/)
- [Mosque Aisha Thorold](https://www.mosqueaisha.ca/)
- [Baitul Quddus Mosque](http://www.ahmadiyya.ca/)
- [Baitur-Rasheed Mosque](https://ahmadiyya.ca/)
- [Brantford Mosque](http://www.brantfordmosque.ca/)
- [Islamic Centre of Brantford](https://brantfordmosque.ca/)
- [North End Centre (a project of MAB)](https://brantfordmosque.ca/)
- [Madina Masjid Ottawa (Dawat-e-Islami)](http://www.dawateislamicanada.net/)

## 5. No website found in OpenStreetMap or Google (56)

**This does not mean the masjid has no website.** It means neither OpenStreetMap
nor Google Places listed one, and nothing here ever searched for it — so some of
these are findable in one search. Masjid Omar Bin Khatab sat in this list with a
working site because its Google record matched an OSM record and was discarded;
that particular bug is fixed, but the rest still need a real search step.

- **Bab ul Ilm - Bani Hashim Society**
- **Ummah Nabawiah Masjid** — 2074 Kipling Avenue
- **Meadowvale Ismaili Centre** — 7037 Financial Drive Mississauga L5N 7H5
- **Baitul Hamd Mosque** — 1194 Matheson Boulevard East Mississauga Ontario L4W 1Y2
- **(unnamed)**
- **Dar Al-Hijrah Islamic Center** — 2050 Kipling Avenue Etobicoke
- **Islamic Society of York Region**
- **Ismaili Jamatkhana**
- **Usman Gousi Mosque** — 75 Kirkdene Drive Toronto
- **Dawoodi Bohra Al Masjid Al Saifee Anjuman-e-Burhani**
- **Ismaili Centre Toronto** — 49 Wynford Drive North York M3C 1K1
- **Albatool Fatima Association** — 2575 Bond Street
- **Rhoda Masjid and Institute** — 2871 St. Joseph Boulevard
- **Ismaili Jamat Khana** — 3225 Conroy Road
- **Islamic Shia Ithna Asheri Asociation of Ottawa** — 3856 Old Richmond Road
- **Kanata Muslim Association** — 351 Sandhill Road
- **House of the Commandments**
- **Baitun Naseer Mosque** — 2620 Market Street Cumberland Ontario K4C 1A3
- **Oshawa Mosque**
- **Hawkesbury Mosque** — 651 Main Street East Hawkesbury K6A 1B3
- **Stratford Mosque** — 97 Woods Street Stratford
- **Musalla As-Sahaba** — 2835 Dumaurier Avenue
- **Al-Huda Islamic Centre** — Toronto
- **Faith Mosque** — 182
- **Istiqlal Mosque** — 14369 Trafalgar Road Ballinafad Ontario N0B 1H0
- **Hadiqa Ahmad** — 3999 10th Sideroad Bradford Ontario L3Z 2A5
- **Masjid Mosque**
- **Don Mills Jamatkhana** — 80 Overlea Boulevard East York M4H 1C5
- **Islamic Forum of Canada**
- **Al-Hikmah Centre Inc** — 36 Colville Road North York
- **Jannatul Ferdous Mosque** — 1701 Martin Grove Road Etobicoke M9V 4N4
- **The Reign of Islamic Da'Wah**
- **Hamza Mosque** — 1287 Queen Street West M6K 1M2
- **Afghan-Canadian Islamic Community** — 22 Hobson Avenue North York M4A 1Y2
- **Baitul Jannah Islamic Center**
- **Naqshbandi Sufi Toronto** — 129 East Drive
- **MAC Qurtuba Islamic Centre**
- **Canadian Islamic Civic Academy**
- **Mosque**
- **Masjid Daru-Al-Ullum Education Community center [Car Wash Building]** — 16 Orfus Rd Unit 204, North York, ON M6A 2T5, Canada
- **Jamaat of Ontario** — 110 Fairbank Ave, York, ON M6E 3Z1, Canada
- **Brampton Jamatkhana** — 525 N Park Dr, Brampton, ON L6S 5X4, Canada
- **Al-Arqam Islamic Centre - Friday Location** — 1626 Simcoe St N, Oshawa, ON L1G 4X9, Canada
- **Ismaili Community Centre And Jamatkhana - Hamilton** — 61 Harlowe Rd, Hamilton, ON L8W 3R5, Canada
- **Al - Moustafa Islamic Centre** — 545 Main St E, Hamilton, ON L8M 1H9, Canada
- **Al-Fatema Islamic Center** — 70 Stevenson St S, Guelph, ON N1E 5N4, Canada
- **Muslim Youth Association Of London** — 889 Wellingsboro Rd, London, ON N6E 1N3, Canada
- **Ahlul-Bayt Mosque** — 1065 Wyandotte St E, Windsor, ON N9A 3K3, Canada
- **Baitul Haleem Ahmadiyya Mosque** — 150 Colborne St W, Brantford, ON N3T 1L2, Canada
- **Friday Mosque - CFB Borden Multifaith Facility** — 499 Dieppe Rd, Borden, ON L0M 1C0, Canada
- **Alexandria Islamic Centre** — 431 Main St S Unit D, Alexandria, ON K0C 1A0, Canada
- **MUSALLAH QUMSA** — John Deutsch University Centre 87 Union Street West #232, 2nd Floor, Room 232, Kingston, ON K1M 1R9, Canada
- **Ismaili Jamatkhana Kingston** — 105 Sutherland Dr Unit 7, Kingston, ON K7K 5V6, Canada
- **Mosque Lake** — Mosque Lake, North Frontenac, ON K0H 2J0, Canada
- **Islamic centre of Port Hope** — 9182 Northumberland County Rd 28, Port Hope, ON K9A 4K1, Canada
- **Timmins Masjid & Community Centre** — 36 Pine St S, Timmins, ON P4N 2J8, Canada
