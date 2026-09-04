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

## 0. Full scrape after the Google cross-reference (2026-09-04)

The audit below was written against 26 reachable sites. The Google Places pass, once
its importer bug was fixed (it wrote every website it found onto a copy and threw the
copy away), turned 73 unreachable OSM masjids into 26 and added 108 masjids OSM never
had. The scraper then ran over everything reachable.

| | Count |
| --- | ---: |
| Texas masjids known | 207 |
| With a website, scraped | 181 |
| **Times read** | **119** |
| Failed | 62 |
| — site could not be opened | 39 |
| — loads, no timetable found | 19 |
| — timetable read but empty | 4 |
| No website anywhere | 26 |

Times are 24h as published on 2026-09-04, a Friday. Two patterns in the reads are not
errors and should not be "fixed":

- **20 rows have no Maghrib.** Their sites publish it as "at sunset" or "+5 min",
  a rule rather than a time. The scraper leaves it blank instead of inventing one; the
  app's data model stores exactly that rule as an offset.
- **9 rows have no Dhuhr.** Today is Friday and those pages show Jumu'ah in
  Dhuhr's slot. Their weekday Dhuhr needs a non-Friday read.

**Do not publish these 5 — the Maghrib cannot be right.** Texas sunset on
2026-09-04 is roughly 19:30–20:10; a uniform hour's shift is a timezone or a stale page,
not a schedule:

- Islamic Society of Denton — Maghrib 18:29
- City of Knowledge — Maghrib 21:04
- Kingwood Islamic Center (Kingwood Mosque) — Maghrib 20:42
- Mercy Community Center - Mosque — Maghrib 18:41
- Muslim Association of West Texas — Maghrib 21:06

### Read in this run (119)

- [(unnamed) node/11201021741](http://icwbluemosque.org/) — Fajr 05:45, Dhuhr 14:00, Asr 18:00, Maghrib 20:30, Isha 21:45 — Jumu'ah 13:30
- [(unnamed) way/1369802877](http://icjarrell.org/) — Fajr 06:26, Dhuhr —, Asr 17:30, Maghrib 20:00, Isha 21:17 — Jumu'ah 14:00
- [(unnamed) way/265482606](http://icelpaso.org/#) — Fajr 05:50, Dhuhr 13:30, Asr 17:00, Maghrib 19:35, Isha 20:40 — Jumu'ah 13:30
- [(unnamed) way/383025450](http://icptx.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:30, Maghrib 19:56, Isha 21:30 — Jumu'ah 14:15, 15:30
- [(unnamed) way/460792404](http://www.allenmasjid.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib —, Isha 21:15 — Jumu'ah 14:00, 15:30
- [(unnamed) way/655037002](https://alsalammasjid.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:05, Maghrib 19:46, Isha 21:00 — Jumu'ah 13:35, 14:35, 15:15
- [(unnamed) way/995953052](http://www.icltx.com/) — Fajr 06:20, Dhuhr 14:00, Asr 18:45, Maghrib 19:50, Isha 21:00 — Jumu'ah 13:45
- [AL NOOR MOSQUE](https://www.alnoormasjid.org/) — Fajr 06:10, Dhuhr 14:00, Asr 18:20, Maghrib 19:45, Isha 21:20 — Jumu'ah 14:00, 15:00
- [AZAD MASJID](https://i-cwf.org/) — Fajr 05:53, Dhuhr 13:18, Asr 17:51, Maghrib 19:38, Isha 20:44 — Jumu'ah 13:45
- [Abu Hanifa Mosque](https://masjidabuhanifahiat.org/) — Fajr 05:30, Dhuhr 13:45, Asr 18:30, Maghrib —, Isha 22:10 — Jumu'ah 14:00
- [Al-Ansar Society](http://alansarsociety.org/new/) — Fajr 06:35, Dhuhr 14:00, Asr 18:00, Maghrib 19:58, Isha 21:10 — Jumu'ah 13:45, 14:45
- [Al-Ghadeer](https://www.alghadeer.org/) — Fajr 05:48, Dhuhr 13:20, Asr 17:53, Maghrib 19:55, Isha —
- [Al-Noor Mosque (MCC)](https://alnoormcc.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib 19:54, Isha 21:15 — Jumu'ah 13:45
- [Alkhair Islamic Society of RGV](https://us.mohid.co/tx/txrgn/alkhair) — Fajr 07:00, Dhuhr 14:00, Asr 17:30, Maghrib 19:54, Isha 21:15
- [Barkaat-Ul-Quran](http://www.barkaatulquran.org/) — Fajr 05:32, Dhuhr 13:27, Asr 18:00, Maghrib 19:52, Isha 21:11 — Jumu'ah 13:35
- [Bayt Al-Karim Islamic Center](https://www.dncfw.org/) — Fajr 06:30, Dhuhr 13:45, Asr 18:30, Maghrib —, Isha 21:15 — Jumu'ah 13:30
- [City of Knowledge](https://cfkdfw.org/) — Fajr 06:49, Dhuhr 14:26, Asr 18:02, Maghrib 21:04, Isha 21:53 — Jumu'ah 13:26
- [Clear Lake Islamic Center - Masjid](http://www.themasjid.org/) — Fajr 06:15, Dhuhr 13:45, Asr 17:15, Maghrib —, Isha 21:15 — Jumu'ah 13:30, 14:45
- [Cypress Islamic Center](https://cypressislamiccenter.org) — Fajr 06:15, Dhuhr 13:30, Asr 18:15, Maghrib 19:45, Isha 21:00 — Jumu'ah 13:40, 15:20
- [Dallas Masjid of al-Islam](http://www.masjidalislam.org/) — Fajr 06:15, Dhuhr 13:45, Asr 17:30, Maghrib 19:58, Isha 21:45 — Jumu'ah 13:45
- [Dar Alhuda Inc مسجد](https://www.daralhudamasjid.com/) — Fajr 06:26, Dhuhr 14:00, Asr 17:22, Maghrib 19:59, Isha 21:15 — Jumu'ah 13:30
- [Dar El Salaam Islamic Center](http://www.darelsalam.org/) — Fajr 06:15, Dhuhr —, Asr 17:30, Maghrib 19:55, Isha 21:30 — Jumu'ah 14:00
- [Dar El-Eman Islamic Center (DEIC)](http://www.dareleman.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:59, Isha 21:10 — Jumu'ah 13:30, 14:30
- [DeSoto House of Peace](https://salamdesoto.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:53, Isha 21:15 — Jumu'ah 13:30
- [East Plano Islamic Center](https://www.epicmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:45, 15:15
- [East Texas Islamic Association - Commerce Mosque](http://commercemosque.weebly.com/contact-us.html) — Fajr 05:41, Dhuhr 13:34, Asr 17:10, Maghrib 19:58, Isha 21:28
- [East Texas Islamic Society](https://tylermuslim.com/) — Fajr 05:47, Dhuhr 13:22, Asr 16:58, Maghrib 19:47, Isha 20:56 — Jumu'ah 13:45
- [Elfarouq Mosque](http://www.elfarouq.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:15, Maghrib —, Isha 21:00 — Jumu'ah 13:30, 14:30
- [Georgetown Islamic Center (GIC)](https://www.gicmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:30, Maghrib 19:55, Isha 21:30 — Jumu'ah 14:30, 15:30
- [Grand Prairie Masjid](http://grandprairiemasjid.org/) — Fajr 06:15, Dhuhr —, Asr 17:30, Maghrib 20:00, Isha 21:30 — Jumu'ah 13:30
- [HART Islamic Community Center](https://hart.community/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib —, Isha 21:15
- [Haj Nabih Masjid](https://hajnabihmasjid.com/) — Fajr 05:53, Dhuhr —, Asr 17:53, Maghrib 19:41, Isha 20:48 — Jumu'ah 12:25
- [Hawa Masjid](https://hawa-masjid.lovable.app/) — Fajr 05:30, Dhuhr 14:00, Asr 17:45, Maghrib 20:20, Isha 21:45 — Jumu'ah 14:00
- [IALFM Mosque](http://ialfm.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:30, Maghrib 19:55, Isha 21:15
- [IALFM Mosque](http://ialfm.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:30, Maghrib 19:55, Isha 21:15
- [ICC - Islamic Center of Coppell](https://iccmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:54, Isha 21:30 — Jumu'ah 14:30, 16:30
- [ISAT Center Masjid](https://www.centermasjid.com/) — Fajr 06:21, Dhuhr 14:15, Asr 17:30, Maghrib 19:59, Isha 21:15 — Jumu'ah 13:40
- [ISGH Masjid At-Taqwa](https://masjidattaqwa.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:43, Isha 21:00 — Jumu'ah 13:35, 14:40, 15:40
- [ISGH Masjid Hamza - Mission Bend Islamic Center](http://isghmasjidhamza.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:48, Isha 21:00 — Jumu'ah 13:30, 14:50
- [ISGH Masjid Savoy Wilcrest](http://www.savoymusallah.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib —, Isha 21:15 — Jumu'ah 13:40, 14:40
- [Islamic Academy of San Antonio](https://icsaonline.org/) — Fajr 06:30, Dhuhr 14:10, Asr 17:30, Maghrib 20:03, Isha 21:15 — Jumu'ah 12:30, 14:00
- [Islamic Association of Carrollton (IAC)](http://www.masjidal-rahman.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib —, Isha 21:15 — Jumu'ah 13:30
- [Islamic Association of Collin County (Plano Mosque)](http://www.planomasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:45, 15:00
- [Islamic Association of Tarrant County](https://iatcmasjid.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:15, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:25
- [Islamic Association-Mesquite](https://www.islamicassociationofmesquite.com/) — Fajr 05:55, Dhuhr 13:26, Asr 17:01, Maghrib 19:48, Isha 20:57 — Jumu'ah 12:45, 13:45, 15:00
- [Islamic Center Of Lake Travis](https://www.iclaketravis.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:40, Maghrib 19:52, Isha 21:30 — Jumu'ah 13:35
- [Islamic Center of Amarillo](http://amarillomosque.org/) — Fajr 06:20, Dhuhr 13:58, Asr 17:33, Maghrib 20:21, Isha 21:32 — Jumu'ah 14:15
- [Islamic Center of Aubrey](https://www.aubreymasjid.org/) — Fajr 06:30, Dhuhr 14:00, Asr 18:30, Maghrib 19:54, Isha 21:15 — Jumu'ah 13:50, 14:45
- [Islamic Center of Brushy Creek](https://icbrushycreek.org/) — Fajr 06:30, Dhuhr 14:00, Asr 18:15, Maghrib 19:56, Isha 21:15 — Jumu'ah 12:00, 13:00, 14:00, 15:00
- [Islamic Center of Conroe ICC (Masjid Bilal)](https://iccconroe.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:25, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:55
- [Islamic Center of Euless](https://icoeuless.com/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:59, Isha 21:30 — Jumu'ah 13:30, 15:00
- [Islamic Center of Galveston - Masjid](https://www.galvestonislamiccenter.org/) — Fajr 06:00, Dhuhr 13:30, Asr 17:00, Maghrib —, Isha 21:00 — Jumu'ah 13:30
- [Islamic Center of Greater Austin](https://austinmosque.org/) — Fajr 06:04, Dhuhr 13:31, Asr 17:04, Maghrib 19:51, Isha 20:58
- [Islamic Center of Harlingen](https://sites.google.com/view/islamiccenterofharlingen/home) — Fajr 06:00, Dhuhr 14:00, Asr 17:30, Maghrib —, Isha 21:35
- [Islamic Center of Hays County (Masjid Bilal)](https://masjidbilaltx.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 20:01, Isha 21:15 — Jumu'ah 14:10
- [Islamic Center of Hewitt / Al- Hidaya Mosque](https://www.islamiccenterofhewitt.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:15, Maghrib 19:54, Isha 21:30 — Jumu'ah 14:00
- [Islamic Center of Lake Worth](http://www.icolakeworth.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:30, Maghrib 20:15, Isha 21:30 — Jumu'ah 14:00
- [Islamic Center of Laredo مسجد](http://islamiccenteroflaredo.org/) — Fajr 06:33, Dhuhr 13:57, Asr 17:24, Maghrib 20:00, Isha 21:15 — Jumu'ah 13:50
- [Islamic Center of Round Rock](https://roundrockmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:40, Maghrib 19:55, Isha 21:30 — Jumu'ah 13:40, 14:30
- [Islamic Center of Rowlett](https://icrmasjid.org/) — Fajr 06:30, Dhuhr 14:00, Asr 18:15, Maghrib 20:01, Isha 21:15 — Jumu'ah 13:35
- [Islamic Center of Southlake](http://southlakemasjid.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:15, Maghrib 19:55, Isha 21:15 — Jumu'ah 14:00, 15:00
- [Islamic Center of Victoria مسجد](http://www.victoriaislamiccenter.com/) — Fajr 06:15, Dhuhr 14:00, Asr 17:15, Maghrib —, Isha 21:30 — Jumu'ah 13:30
- [Islamic Education Center](https://www.iec-houston.org/) — Fajr 05:41, Dhuhr 13:21, Asr 17:53, Maghrib 19:58, Isha 20:43
- [Islamic Society Of Mesquite](https://islamicsocietyofmesquite.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib 20:00, Isha 21:30 — Jumu'ah 14:15
- [Islamic Society Of South Texas](https://isstonline.wixsite.com/isstmcallen) — Fajr 06:20, Dhuhr 13:45, Asr 17:30, Maghrib —, Isha 21:30 — Jumu'ah 13:45
- [Islamic Society of Brownsville](https://islamicsocietyofbrownsville.org/) — Fajr 06:30, Dhuhr 14:30, Asr 18:00, Maghrib —, Isha 21:30 — Jumu'ah 14:00
- [Islamic Society of Denton](https://www.dentonmosque.com/) — Fajr 06:00, Dhuhr 13:00, Asr 16:15, Maghrib 18:29, Isha 19:45
- [Islamic center of Wylie, Masjid](http://icwtx.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:15, Maghrib 19:57, Isha 21:30 — Jumu'ah 13:45
- [Keller Islamic Center (KIC)](http://www.kellerislamiccenter.org/) — Fajr 06:30, Dhuhr 13:45, Asr 18:15, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:35
- [Kingwood Islamic Center (Kingwood Mosque)](https://kingwoodislamiccenter.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 20:42, Isha 21:00 — Jumu'ah 13:30, 14:40
- [Klein Islamic Center - Masjid](http://kleinislamiccenter.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:00, Maghrib 19:47, Isha 21:00 — Jumu'ah 13:30, 14:30
- [MAS Katy Center (Masjid Al-Rahman)](https://www.maskaty.org/) — Fajr 06:30, Dhuhr 13:35, Asr 17:15, Maghrib 19:47, Isha 21:00 — Jumu'ah 13:30, 15:30
- [MOMIN of Texas](http://www.momin.org/) — Fajr 05:49, Dhuhr 13:26, Asr 13:26, Maghrib 20:03, Isha 20:03 — Jumu'ah 12:15
- [Madinah Masjid of Carrollton](https://madinahmasjid.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib 19:52, Isha 21:30 — Jumu'ah 14:00, 14:30
- [Makkah Masjid (Garland Mosque)](https://makkahmasjid.net/) — Fajr 06:30, Dhuhr 14:00, Asr 18:30, Maghrib 19:48, Isha 21:30 — Jumu'ah 14:10, 14:40
- [Mansfield Islamic Center](http://mansfieldmasjid.org/) — Fajr 06:15, Dhuhr 14:15, Asr 17:30, Maghrib 19:59, Isha 21:15 — Jumu'ah 13:30, 14:30
- [Masjid](https://masjid.mcisonline.net/) — Fajr 06:15, Dhuhr 14:00, Asr 17:15, Maghrib 19:52, Isha 21:15 — Jumu'ah 13:30
- [Masjid Abu Huraira](http://woodlandsislamiccenter.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:00, Maghrib 19:46, Isha 21:00 — Jumu'ah 14:00
- [Masjid Al Huda](https://alhudamcc.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:30, Maghrib 19:55, Isha 21:30 — Jumu'ah 14:15
- [Masjid Al Karim](https://masjidalkarim.net/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:45, Isha 21:00 — Jumu'ah 13:30, 14:30
- [Masjid Al-Hedayah](https://alhedayahacademy.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:59, Isha 21:30 — Jumu'ah 13:25, 14:25
- [Masjid Al-Sahaabah Watauga Center](https://wataugamasjid.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:15, Maghrib —, Isha 21:15 — Jumu'ah 13:30, 14:45
- [Masjid Aqsa](https://www.aqsamasjidkaty.com/) — Fajr 06:20, Dhuhr 14:00, Asr 18:00, Maghrib 19:48, Isha 21:15 — Jumu'ah 13:30, 14:45, 15:45
- [Masjid Arafat](http://duusa.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 19:44, Isha 21:15 — Jumu'ah 13:30, 15:00
- [Masjid E Zohra](http://masjidzohra.org/) — Fajr 06:15, Dhuhr —, Asr 18:00, Maghrib 19:46, Isha 21:30 — Jumu'ah 14:00
- [Masjid Faruq of Grand Prairie TX](http://www.faruqmasjid.org/) — Fajr 05:56, Dhuhr 13:27, Asr 17:02, Maghrib 19:49, Isha 20:58 — Jumu'ah 13:45
- [Masjid Ibrahim](https://www.masjidibrahim.org/) — Fajr 06:25, Dhuhr 14:00, Asr 17:30, Maghrib 19:57, Isha 21:10 — Jumu'ah 13:10
- [Masjid Ibrahim](https://masjidibrahimtx.org/) — Fajr 06:20, Dhuhr 14:00, Asr 18:05, Maghrib 19:47, Isha 21:00 — Jumu'ah 13:30, 14:30
- [Masjid Isa Ibn Maryam (Bammel Musallah)](https://www.islamtx.com/) — Fajr 06:15, Dhuhr 13:40, Asr 18:00, Maghrib 19:41, Isha 21:15 — Jumu'ah 13:30, 14:30
- [Masjid Istiqlal Houston](http://www.istiqlalhouston.org/) — Fajr 06:15, Dhuhr 13:45, Asr 17:15, Maghrib 19:47, Isha 21:00
- [Masjid Khulafa’a Rashideen](https://masjidkr.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib —, Isha 21:15 — Jumu'ah 13:40
- [Masjid Salahadeen](http://www.masjidsalahadeen.org/) — Fajr 06:15, Dhuhr —, Asr 18:00, Maghrib 19:53, Isha 21:30 — Jumu'ah 13:45, 14:45
- [Masjid Yaseen](http://masjidyaseen.org/) — Fajr 06:15, Dhuhr 13:45, Asr 18:15, Maghrib 19:51, Isha 21:30 — Jumu'ah 13:30, 15:00
- [Masjid al-ahad](http://masjidahad.org/) — Fajr 05:45, Dhuhr 13:45, Asr 18:15, Maghrib 20:12, Isha 21:20 — Jumu'ah 13:05, 14:30, 15:30
- [Masjid-e-Sajideen](https://www.masjidesajideen.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:56, Isha 21:15 — Jumu'ah 13:45, 14:15, 15:15
- [Masjidu Ttaqwa Mosque](https://www.icgk.org/) — Fajr 06:20, Dhuhr 14:00, Asr 17:30, Maghrib 20:05, Isha 21:30 — Jumu'ah 13:30, 14:30
- [Masjidul Mu'meneen](http://www.masjidulmumineen.org/) — Fajr 06:00, Dhuhr 14:00, Asr 17:30, Maghrib —, Isha 21:30 — Jumu'ah 13:30
- [Mercy Community Center - Mosque](https://mercycc.org/) — Fajr 06:13, Dhuhr 14:00, Asr 17:15, Maghrib 18:41, Isha 21:00 — Jumu'ah 13:30, 14:30, 15:15
- [Minhaj ul Quran International](http://us.mohid.co/tx/dallas/jmcc) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib —, Isha 21:20
- [Muslim Association of West Texas](http://muslim-of-west-texas.poi.place/) — Fajr 06:04, Dhuhr 14:10, Asr 17:56, Maghrib 21:06, Isha 22:30
- [Muslim Center of San Antonio](https://mcsamasjid.com/) — Fajr 06:20, Dhuhr 14:00, Asr 17:30, Maghrib 20:04, Isha 21:15 — Jumu'ah 13:30
- [Muslim Children Education & Civic Center](https://www.mcecc.com/) — Fajr 06:30, Dhuhr 14:00, Asr 18:00, Maghrib 19:58, Isha 21:15 — Jumu'ah 13:00, 14:00
- [Noori Mosque](https://noorimasjid.net/) — Fajr 06:30, Dhuhr 14:00, Asr 18:30, Maghrib 19:51, Isha 21:30 — Jumu'ah 14:00, 15:00
- [North Austin Muslim Community Center](https://www.namcc.org/) — Fajr 06:30, Dhuhr 14:00, Asr 17:30, Maghrib 19:56, Isha 21:15 — Jumu'ah 12:15, 13:30, 14:30
- [Pearland Islamic Center (PIC) - ISGH](https://picisgh.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:30, Maghrib 19:50, Isha 21:15 — Jumu'ah 13:30, 14:30
- [Princeton Islamic Center](http://www.picmasjid.org/) — Fajr 06:20, Dhuhr 14:00, Asr 18:15, Maghrib 19:53, Isha 21:10 — Jumu'ah 13:40, 14:30
- [Rahmania Center](https://rahmaniacenter.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:50, Maghrib —, Isha 21:25 — Jumu'ah 13:35
- [Richmond Islamic Community Center](https://richmondmasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:15, Maghrib 19:43, Isha 21:00 — Jumu'ah 13:45, 14:45, 15:30
- [Sachse Muslim Society](https://sachsemasjid.org/) — Fajr 06:15, Dhuhr 14:00, Asr 18:00, Maghrib 19:54, Isha 21:15 — Jumu'ah 13:30, 14:20, 15:15
- [Shadow Creek Muslim Community Center](https://thesmcc.org/) — Fajr 06:15, Dhuhr —, Asr 17:15, Maghrib 19:50, Isha 21:15 — Jumu'ah 13:30, 14:30
- [Shepard Airforce Base Mosque (edited by Ebrahim Chowdhury)](https://i-cwf.org/) — Fajr 05:53, Dhuhr 13:18, Asr 17:51, Maghrib 19:38, Isha 20:44 — Jumu'ah 13:45
- [Tajweed Institute Masjid](http://tajweedusa.org/) — Fajr 06:15, Dhuhr 14:00, Asr 17:15, Maghrib —, Isha 21:15 — Jumu'ah 13:30
- [Tyler Islamic Center](https://tylerislamiccenter.org/) — Fajr 06:00, Dhuhr —, Asr 18:15, Maghrib 20:05, Isha 21:45 — Jumu'ah 13:45
- [Unity Islamic Center - Mansfield Masjid Official](https://www.unityislamiccenter.org/) — Fajr 06:30, Dhuhr —, Asr 17:30, Maghrib 20:00, Isha 21:15 — Jumu'ah 13:45, 14:30
- [Valley Ranch Islamic Center](https://vric.org) — Fajr 06:15, Dhuhr 13:45, Asr 17:30, Maghrib 19:54, Isha 21:15 — Jumu'ah 13:45, 15:00, 16:00
- [WIC Masjid](https://woodlandsislamiccenter.com/) — Fajr 06:15, Dhuhr 13:45, Asr 18:00, Maghrib 19:46, Isha 21:00 — Jumu'ah 14:00
- [WKIC - Masjid Al Firdous](http://wkic.org/) — Fajr 06:15, Dhuhr 15:15, Asr —, Maghrib 19:48, Isha 21:15
- [Zainabia-SA Islamic Education Center](http://www.zainabiasa.org/) — Fajr 05:17, Dhuhr 13:35, Asr 16:30, Maghrib 20:32, Isha 21:15
- [Zia ul Quran Masjid](http://www.ziaulquranmasjid.com/) — Fajr 06:15, Dhuhr 14:00, Asr 18:30, Maghrib —, Isha 21:30 — Jumu'ah 14:00

### Still failing

- [(unnamed) way/1247561146](http://www.dawateislamiusa.com/) — no times found on the page
- [(unnamed) way/1323719988](http://www.maryammasjid.org/contact/) — site could not be opened
- [(unnamed) way/1348862217](https://rosenbergcommunitycenter.org) — site could not be opened
- [(unnamed) way/1385972314](https://mustafaislamiccenter.org/) — no times found on the page
- [(unnamed) way/1418381673](https://friscomasjid.org/) — site could not be opened
- [(unnamed) way/465539048](https://lubbockmuslims.org/) — site could not be opened
- [Adam Masjid](http://adammasjid.org/) — no times found on the page
- [Al Ansaar Masjid - An ISGH Masjid](http://alansaarmasjid.org/) — site could not be opened
- [Al-Rahma Mosque](https://masjidrahma.com/) — site could not be opened
- [At-Tawhid Mosque](https://www.tawhidhouston.com/) — no times found on the page (page text holds 7 prayer names and 8 times, shot viewport 1280
- [Bait-ul-Ikram Mosque](https://islamindallas.org/) — no times found on the page
- [Bait-ul-Qayyum Mosque](https://islaminfortworth.org/) — site could not be opened
- [Baitul Muqeet Mosque - Ahmadiyya Muslim Community](http://islaminaustin.org/) — site could not be opened
- [Baitus Samee Mosque](http://www.alislam.org/) — no times found on the page
- [Bilal Ibn Rabah of San Antonio (MBIR)](https://www.mbirsa.org/) — no times found on the page
- [Burmese Muslim Community of Amarillo (BMCAMA)](https://bmcama.org/) — site could not be opened
- [Dar El-Quran](http://www.linktr.ee/darelquran) — no times found on the page
- [Dawoodi Bohra Community - Anjuman-e-Najmi, Dallas Inc.](https://usa.thedawoodibohras.com/) — site could not be opened
- [Dawoodi Bohra Markaz Anjuman-e-Burhani (Austin)](https://usa.thedawoodibohras.com/communities/austin/) — site could not be opened
- [Houston Masjid of Al-Islam](http://www.masjidwdmohammed.org/) — no times found on the page
- [Houston's Blue Mosque](https://theislamicinstitute.net) — site could not be opened
- [Ibrahim Islamic Center & Mosque](http://www.ibrahimcenter.org/) — no times found on the page
- [Imam Ali Islamic center](https://www.facebook.com/imamalicenterintexas/) — no times found on the page
- [Islamic Association of North Texas (IANT Masjid)](https://www.iant.com/) — site could not be opened
- [Islamic Center of Irving](https://irvingmasjid.org/) — site could not be opened
- [Islamic Center of Lubbock](https://lubbockmuslims.org/) — site could not be opened
- [Islamic Center of Quad Cities](http://icqcmasjid.org/) — site could not be opened
- [Islamic Center of South Dallas](https://www.facebook.com/profile.php?id=793627857328461) — no times found on the page
- [Islamic Community of Bryan](https://icbcs.org/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Islamic Da'wah Center](https://www.islamicdawahcenter.org/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Islamic Society of Central Texas](https://isctmasjid.org/) — site could not be opened
- [Islamic Society of Greater Houston](https://isgh.org/) — site could not be opened
- [Islamic Society of Kingsville (ISK)](https://iskmasjidomar.org/) — site could not be opened
- [Islamic Society of Southern Texas](https://isstcc.org/) — site could not be opened
- [Islamic Society of Triplex – Beaumont Mosque](https://istweb.org/) — site could not be opened
- [Ismaili Center Houston](https://ismailicenter.org/) — no times found on the page
- [Ismaili Jamatkhana](http://the.ismaili/) — no times found on the page
- [Ismaili Jamatkhana - San Antonio](https://the.ismaili/) — no times found on the page
- [Jamia Masjid](https://jamiamasjid.us/) — site could not be opened
- [MAS Islamic Center Of Dallas](http://www.masdfw.org/) — site could not be opened
- [Madrasah Islamiah Masjid Noor](https://mislamiah.com) — site could not be opened
- [Masjid Al Jamia Mesquite](https://masjidaljamiamesquite.com/) — site could not be opened
- [Masjid Al Quran](https://www.facebook.com/MasjidAlQuranDallasTx/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)
- [Masjid Al-Ikhlas](https://alikhlasmasjid.com/) — site could not be opened
- [Masjid Al-Mustafa](https://www.bearcreekic.org/) — site could not be opened
- [Masjid As Sabireen](http://brandlaneic.com/) — site could not be opened
- [Masjid Beit El-Maqdes](https://beitelmaqdes.org/) — site could not be opened
- [Masjid E Mohammedi](https://www.houstonjamaat.com/) — no times found on the page
- [Masjid Fatima tuz Zahra](https://www.minhaj.org/english/Overseas/tid/34296/USA-Timings-of-Eid-ul-Adha-Prayers-in-Texas.html) — no times found on the page
- [Masjid Ghous-E-Azam](https://www.facebook.com/Masjid.GhouseAzam) — no times found on the page
- [Masjid Texarkana](https://texarkanamuslimcommunity.org/) — site could not be opened
- [McKinney Islamic Center](http://www.mckinneymasjid.org/) — site could not be opened
- [Mesquite Islamic Center (MIC Mosque)](http://www.micmasjid.com/) — site could not be opened
- [Muhammad Mosque](http://www.noidallas48.org/) — no times found on the page
- [Muhammad Mosque #52](http://www.noifortworth.org/) — site could not be opened
- [Muhammad Mosque No.45](https://www.noihouston.org/) — site could not be opened
- [Northside Islamic Center of San Antonio](https://www.nicsatx.org/) — site could not be opened
- [Nour Al-Quran Society](https://www.nouralquran.org/) — site could not be opened
- [Nueces Mosque](http://nuecesmosque.com/) — site could not be opened
- [Quad City Islamic Center of North Austin Leander](http://www.qcicmasjid.org/) — site could not be opened
- [Rahmani Masjid and Learning Center](https://www.rahmanimasjid.com/) — site could not be opened
- [San Marcos Masjid](http://sanmarcosmasjid.org/) — only 0 of 5 prayers found (missing fajr, dhuhr, asr, maghrib, isha)

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
