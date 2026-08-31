# Texas mosques — first scrape (2026-08-31)

A first read of Texas mosques from two OpenStreetMap exports, run through the same
capture/extract/validate pipeline the Toronto scrape uses. This is a report, not a
data source: nothing here touches `src/data/masjids.json`, and Texas is not part of
the app's Toronto-scoped model (CLAUDE.md §3). Whether it ever becomes a second city
is an open question (§16), not one this file decides.

**The number that matters: 17 of 99 mosques produced usable times.** Not because the
scraper is weak, but because 73 of the 99 have no website recorded in OSM at all —
there is nothing to open. Only 26 could even be attempted.

| Outcome | Count | What would change it |
| --- | ---: | --- |
| Times read | 17 | Nothing — these are usable now |
| Site blocks automated reading | 5 | Read by hand, or find their widget's API |
| Site is down or gone | 2 | Find a current address for the masjid |
| Site loads, no times found | 2 | Check whether they publish a schedule at all |
| No website in OSM | 47 | Discovery pass — search by name and address |
| No name in OSM either | 21 | Trace back to the OSM record, or drop |
| Ismaili jamatkhanas | 5 | Nothing — not scrapeable by design |
| **Total** | **99** | |

Times are 24h, as published on each site on 2026-08-31.

---

## 1. Times read (17) — usable now

Read directly off each site. Four have a prayer missing and one looks wrong; both
are called out in §2 and §3 rather than buried in this list.

- [Al-Ghadeer](https://www.alghadeer.org/) — Fajr 05:46, Dhuhr 13:22, Asr 17:56, Maghrib 20:00, Isha —
- [City of Knowledge](https://cfkdfw.org/) — Fajr 06:46, Dhuhr 14:28, Asr 18:05, Maghrib 21:09, Isha 21:59 — Jumu'ah 13:26
- [Cypress Islamic Center](https://cypressislamiccenter.org) — Fajr 06:15, Dhuhr 13:30, Asr 18:15, Maghrib 19:49, Isha 21:15 — Jumu'ah 13:40, 15:20
- [DeSoto House of Peace](https://salamdesoto.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:58, Isha 21:45 — Jumu'ah 13:30
- [HART Islamic Community Center](https://hart.community/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib —, Isha 21:15
- [ISGH Masjid At-Taqwa](https://masjidattaqwa.com/) — Fajr 06:00, Dhuhr 14:00, Asr 18:00, Maghrib 19:48, Isha 21:30 — Jumu'ah 13:35, 14:40, 15:40
- [Islamic Center of Brushy Creek](https://icbrushycreek.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 20:01, Isha 21:30 — Jumu'ah 12:00, 13:00, 14:00, 15:00
- [Islamic Center of Euless](https://icoeuless.com/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 20:04, Isha 21:30 — Jumu'ah 13:30, 15:00
- [Islamic Center of Greater Austin](https://austinmosque.org/) — Fajr 06:01, Dhuhr 13:32, Asr 17:06, Maghrib 19:55, Isha 21:03
- [Islamic Center of Round Rock](https://roundrockmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:40, Maghrib 20:00, Isha 21:30 — Jumu'ah 13:40, 14:30
- [Islamic Society Of South Texas](https://isstonline.wixsite.com/isstmcallen) — Fajr 06:20, Dhuhr 13:45, Asr 17:30, Maghrib —, Isha 21:30 — Jumu'ah 13:45
- [Madinah Masjid of Carrollton](https://madinahmasjid.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib 19:58, Isha 21:30 — Jumu'ah 14:00, 14:30
- [Masjid Ibrahim](https://www.masjidibrahim.org/) — Fajr 06:20, Dhuhr 14:00, Asr 17:30, Maghrib 20:02, Isha 21:20 — Jumu'ah 13:10
- [Masjid Khulafa’a Rashideen](https://masjidkr.org/) — Fajr 05:45, Dhuhr 14:00, Asr 18:30, Maghrib —, Isha 21:45 — Jumu'ah 13:40
- [Muslim Children Education & Civic Center](https://www.mcecc.com/) — Fajr 06:30, Dhuhr 14:00, Asr 18:00, Maghrib 20:02, Isha 21:30 — Jumu'ah 13:00, 14:00
- [North Austin Muslim Community Center](https://www.namcc.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:30, Maghrib 20:00, Isha 21:15 — Jumu'ah 12:15, 13:30, 14:30
- [Valley Ranch Islamic Center](https://vric.org) — Fajr 06:15, Dhuhr 13:45, Asr 17:30, Maghrib 19:59, Isha 21:15 — Jumu'ah 13:45, 15:00, 16:00

## 2. Read, but a prayer was blank (4)

Counted as read above — the rest of the row is good. Worth a look before anyone
relies on the missing prayer.

- [Islamic Society Of South Texas](https://isstonline.wixsite.com/isstmcallen) — no maghrib
- [Al-Ghadeer](https://www.alghadeer.org/) — no isha
- [Masjid Khulafa’a Rashideen](https://masjidkr.org/) — no maghrib
- [HART Islamic Community Center](https://hart.community/) — no maghrib

## 3. Read, but the times look wrong (1)

- [City of Knowledge](https://cfkdfw.org/) — Maghrib 21:09 in Carrollton, where sunset on 2026-08-31 is about 20:00. Every prayer in the row runs roughly an hour late, which is the signature of a timezone or a misread rather than a real schedule. Do not publish without checking with the masjid

## 4. Site blocks automated reading (5)

These sites are up and a person can read them fine — they serve a bot challenge or a
403 to an automated browser. The same pattern St. Thomas Islamic Centre hit in the
Ontario audit. Not a scraper bug and not fixable by retrying.

- [Bait-ul-Qayyum Mosque](https://islaminfortworth.org/) — served a challenge page or 403 instead of content
- [Islamic Society of Greater Houston](https://isgh.org/) — served a challenge page or 403 instead of content
- [Islamic Society of Triplex – Beaumont Mosque](https://istweb.org/) — served a challenge page or 403 instead of content
- [Houston's Blue Mosque](https://theislamicinstitute.net) — served a challenge page or 403 instead of content
- [(unnamed) way/1348862217](https://rosenbergcommunitycenter.org) — served a challenge page or 403 instead of content

## 5. Site is down or gone (2)

- [Madrasah Islamiah Masjid Noor](https://mislamiah.com) — `ERR_CONNECTION_RESET`, the server refused the connection. OSM also records a `service_times:url` pointing at a PDF on the same dead domain
- [Jamia Masjid](https://jamiamasjid.us/) — `ERR_NAME_NOT_RESOLVED`, the domain no longer exists

## 6. Site loads, no times found (2)

- [Bait-ul-Ikram Mosque](https://islamindallas.org/) — an Ahmadiyya community site covering several mosques; no per-location daily timetable
- [Islamic Society of Denton](https://www.dentonmosque.com/) — page opened and read, 0 of 5 prayers present

## 7. No website in OpenStreetMap (47)

The largest group by far, and the one with the most upside. "No website in OSM" does
not mean no website exists — the Ontario audit found sites for 16 of 56 entries in
this same state by plain search. Run `scripts/discover.ts` (Nominatim) or
`scripts/discover-google-places.ts` against these before assuming anything.

- **Alkhair Islamic Society of RGV** — 1910 West Elsham Avenue, Edinburg, Texas, 78577
- **Allahs House of Islam**
- **Baitul Muqeet Mosque - Ahmadiyya Muslim Community** — 800 Deep Wood Drive, Round Rock, TX, 78681
- **Baitus Samee Mosque** — 1333 Spears Road, Houston, TX, 77067
- **Bayt Al-Karim Islamic Center** — 4512 Columbus Trace
- **Dallas Masjid of al-Islam**
- **Dar El Salaam Islamic Center**
- **Dar-Un-Noor**
- **East Plano Islamic Center**
- **East Texas Islamic Society**
- **Elfarouq Mosque**
- **HEB Masjid** — 901 Clinic Drive, Euless, TX, 76039
- **IALFM Mosque** — Peters Colony Road, Flower Mound, TX, 75022
- **IALFM Mosque**
- **Islamic Academy of San Antonio** — 8638 Fairhaven Street, San Antonio
- **Islamic Center of Amarillo**
- **Islamic Center of Lubbock** — 3419 La Salle Avenue, Lubbock, TX, 79407
- **Islamic Community of Bryan** — 417 Stasney Street, College Station, TX, 77840
- **Islamic Da'wah Center** — 201 Travis Street, Houston, TX
- **Islamic Society of Greater Houston**
- **Islamic Society of Greater Houston**
- **Islamic Society of Greater Houston**
- **Islamic Society of Southern Texas** — 7341 McArdle Road, Corpus Christi, TX, 78412
- **Islamic center of Wylie, Masjid** — 3390 Lakeway Drive, St Paul, TX, 75098
- **Kalkan Masjid Houston** — 2600 Lazy Hollow Drive, Houston, TX, 77063
- **MOMIN of Texas** — 2945 Frankford Road, Dallas, TX, 75287
- **Makkah Masjid of Greater Houston**
- **Maryam Islamic Center** — 504 Sartartia Road, Sugar Land, TX, 77479
- **Masjid**
- **Masjid Al-Mustafa**
- **Masjid Al-Sahaabah Watauga Center** — 6005 Chapman Road, Watauga, TX, 76148
- **Masjid Arafat**
- **Masjid As Sabireen** — 610 Brand Lane, Stafford, TX
- **Masjid Ayesha** — 4502 Watts Plantation Road, Missouri City, TX, 77459
- **Masjid Darul-Uloom Texas**
- **Masjid E Mohammedi**
- **Masjid Istiqlal Houston**
- **Masjid Salah Ad-Deen** — 5645 Hillcroft Avenue, Houston, TX, 77036
- **Masjid al-ahad**
- **Masjidu Ttaqwa Mosque** — 5600 South Fort Hood Street, 76549
- **Masjidul Mu'meneen**
- **McKinney Islamic Center**
- **Minhaj ul Quran International**
- **New Islamic Generation Foundation**
- **Nueces Mosque** — 1908 Nueces Street, Austin, TX
- **San Marcos Masjid** — 434 North Comanche Street, San Marcos, TX, 78666
- **Xhamia Shqiptare DFW**

## 8. No name in OpenStreetMap either (21)

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

## 9. Ismaili jamatkhanas (5) — not scrapeable by design

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

*Scraped 2026-08-31 from each masjid's own website, one Claude read per page. Times
were correct as published that day and should be re-checked before any long-term
reliance — several sites in this list carry stale or inconsistent data on their own end.*
