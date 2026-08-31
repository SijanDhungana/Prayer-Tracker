# Masjids not live — re-audit (2026-08-31)

Every entry in the original listing below was re-checked by hand on 2026-08-31, each
site fetched live and several opened in a real browser where the fetcher hit a
bot-block or a JS-only widget. **19 masjids can go live now** with times read off
their own sites. The rest are grouped by what is still blocking each one.

| Outcome | Count | What to do |
| --- | ---: | --- |
| Ready to go live, real times read | 19 | Convert to `masjids.json` and ship |
| Real site and real times, one manual step first | 4 | One specific fix each |
| Times read but impossible | 5 | 3 resolved, 2 still need the masjid |
| Times read but a prayer was blank | 3 | All 3 explained — 2 are correct as-is |
| Website loads, no times found | 81 | 12 resolved, 5 dead, 4 not masjids, ~57 unchanged |
| Only a shared org homepage | 10 | 1 resolved, 2 look like one masjid |
| No website in OSM or Google | 56 | 16 have a site after all, ~24 genuinely none |
| Tracker data is wrong | 7 | Fix or delete the entry itself |

Times are as published on each masjid's own site on 2026-08-31, in 24h. Where a site
gives both, they read `adhan/iqamah`.

---

## 1. Ready to go live (19) — do these first

**Outcome: 11 of these shipped, 8 did not. Read §9 before using this list.** Five rows
below turned out to publish adhan times, not iqamah, and would have put prayers in the
app up to 24 minutes early. The list is left unedited so the claim and the result can be
compared.

Read directly off each site on 2026-08-31. Note this is 19 masjids across 20 rows —
Masjid Subhan Ajax runs two locations and is listed once per location.

- [Jami' Masjid Zakariya](https://cornwallmasjid.ca/) (Cornwall) — Fajr 04:30, Dhuhr 13:30, Asr 18:30, Maghrib sunset, Isha 23:15
- [Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/) — Fajr 06:15, Dhuhr 12:30, Asr 15:15, Maghrib sunset, Isha 19:00
- [Mevlana Masjid](https://a-than.info/vv.php?code=MEVLANA01) — Fajr 04:57/05:30, Dhuhr 13:23/13:45, Asr 17:05/17:45, Maghrib 20:03/20:05, Isha 21:25/21:45
- [Al Huda Institute Canada](https://alhudainstitute.ca/) — Fajr 06:00, Dhuhr 13:40, Asr 17:45, Maghrib adhan +5, Isha 21:45
- [Islamic Research Center of Canada](http://www.irccan.com/) — Fajr 05:45, Dhuhr 13:45, Asr 18:00, Maghrib after sunset, Isha 21:15
- [London Muslim Mosque](http://www.londonmosque.ca/) — Fajr 05:08, Dhuhr 13:30, Asr 17:20, Maghrib 20:25, Isha 21:44
- [Islamic Centre of Southwest Ontario](https://islamiccentre.ca/) — Fajr 05:26, Dhuhr 13:25, Asr 17:08, Maghrib 20:01, Isha 21:24
- [Masjid Noor-ul-Haram](https://wimcanada.com/) — Fajr 06:00, Dhuhr 13:45, Asr 18:30, Maghrib sunset, Isha 21:45
- [Erin Islamic Cultural Center](https://erinislamiccenter.ca/) — Fajr 05:30, Dhuhr 14:00, Asr 18:00, Maghrib sunset, Isha 20:00
- [Masjid Al-Salaam](https://www.kmrapeterborough.org/) (Kawartha, Peterborough) — Fajr 05:11/05:30, Dhuhr 13:14/13:30, Asr 16:57/17:30, Maghrib 19:54/19:59, Isha 21:17/21:30
- [Masjid — Muslim Society of Guelph](http://www.msofg.org/) — Fajr 05:09/06:15, Dhuhr 13:26/13:45, Asr 18:01/18:30, Maghrib 20:05/20:05, Isha 21:11/21:30
- [Islamic Centre of Bowmanville](https://icbmasjid.com/) — Fajr 05:13/06:00, Dhuhr 13:15/14:00, Asr 17:55/18:15, Maghrib 19:52/19:57, Isha 21:16/21:30
- [Masjid Al-Abrar](http://www.alabrar.ca/) — Fajr 05:45, Dhuhr 13:30, Asr 17:30, Maghrib sunset, Isha 21:30
- [Masjid Subhan Ajax](https://www.subhanislamicassociation.org/) — Ajax location — Fajr 06:00, Dhuhr 14:00, Asr 18:15, Maghrib sunset, Isha 21:30
- [Masjid Subhan Ajax](https://www.subhanislamicassociation.org/) — Scarborough location — Fajr 05:45, Dhuhr 14:00, Asr 18:45, Maghrib sunset, Isha 21:30
- [Islamic Centre of Northern Ontario](https://masjidbox.com/prayer-times/islamic-centre-of-northern-ontario) (ICONO Sudbury) — Fajr 05:14/05:45, Dhuhr 13:24/13:45, Asr 17:06/18:30, Maghrib 20:04/20:09, Isha 21:13/21:18 — times live on masjidbox, linked from iconosudbury.com
- [Halton Islamic Association](https://www.hia.live/) — Fajr 05:20, Dhuhr 13:20, Asr 17:02, Maghrib 19:58, Isha 21:14 — masjidhalton.com just redirects here
- [Ummah Nabawiah Masjid](https://www.theunm.com/) — Fajr 05:45/06:00, Dhuhr 13:30/13:45, Asr 18:15/18:30, Maghrib sunset, Isha 21:20/21:30
- [Dar Al-Hijrah Islamic Center](https://darulhijra.org/) — Fajr 05:15, Dhuhr 13:40, Asr 17:30, Maghrib sunset, Isha 21:45
- [Islamic Society of York Region](https://isyr.org/) — Fajr 05:00, Dhuhr 14:00, Asr 17:30, Maghrib after sunset, Isha 22:00

Two notes before shipping these:

- **Jami' Masjid Zakariya** — the original "impossible" flag was right that 23:15 Isha is
  unusual, but the site genuinely publishes it. A masjid-side scheduling choice, not a
  scraper bug. Safe to publish as read.
- **Bosnian Canadian Islamic Centre** and **Islamic Centre of Cambridge** are deliberately
  *not* here — they have real-looking widgets whose numbers do not check out. See §3 and §4.

## 2. Real site and real times, one manual step first (4)

- [Kanata Muslim Association](https://kanatamuslims.ca/) — live widget, but the reader ran the adhan/iqamah pairs together ("DHUHR 1:041:30"). Needs a browser-rendered scrape. Org is renting space while fundraising, so confirm times are still current
- [Oshawa Mosque](https://oshawamosque.com/) — full table, but showing a stale **2019** schedule. Blocked until the masjid refreshes their own page
- [Al-Arqam Islamic Centre](http://www.alarqam.ca/) — loads but returns empty content to the fetcher, likely a JS SPA. Needs a live-browser check
- [Al Mahdi Islamic Community Centre](https://almahdicentre.org/) — Fajr 05:26, Dhuhr 13:25, Maghrib 20:17 read fine; Asr and Isha were not captured. Needs a closer look for those two

## 3. Times read but impossible (5) — re-verified

- [Jami' Masjid Zakariya](https://cornwallmasjid.ca/) — resolved, moved to §1. Read correctly all along
- [Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/) — resolved, moved to §1. Worth telling the masjid: Isha is fixed at 19:00 while Maghrib floats with sunset, so on long summer days Isha lands *before* Maghrib. Their scheduling, not a read error
- [Mevlana Masjid](https://a-than.info/vv.php?code=MEVLANA01) — resolved, moved to §1. JS-rendered, so a plain fetch sees only "--:--" placeholders. The scraper must wait for the page JS or call the widget's API
- [Bosnian Canadian Islamic Centre](https://bkic.ca/) — still flagged. Adhan Fajr 03:58 / Isha 22:54, iqamah Fajr 05:00 / Isha 22:45 — iqamah Isha lands *before* adhan Isha. The numbers are in the HTML but render invisibly (a display bug on their end), and the whole set looks ~1h early for late August. Contact the masjid rather than trust this
- [Zawiya Fellowship — Annoor Jami Mosque](https://zawiyafellowship.com/) — move out of "impossible" into "no full timetable published". The homepage and `/prayers-schedule/` only ever publish Dhuhr 13:30 and Jumu'ah 13:30. There is no Fajr/Asr/Maghrib/Isha anywhere on the site to confirm or refute the original 04:36 Fajr

## 4. Times read but a prayer was blank (3) — re-verified

- [Imam Mahdi Islamic Centre](https://imammahdi.ca/) — legitimate, not a bug. The site states it publishes only Fajr, Dhuhr and Maghrib ("sunrise, sunset & midnight are reference times, not prayers"), consistent with Shia combined-prayer practice. Leave as-is
- [Al Zahra Shia Association of Waterloo Region](https://www.alzahra.ca/) — same pattern. Fajr 05:02, Dhuhr 13:23, Maghrib 20:15 are shown; there is no Asr/Isha column on the page at all, not just missing values
- [Islamic Centre of Cambridge](http://iccambridge.com/) — cause found: the widget is stuck on "August 28, 2026" and is not updating, confirmed by fetch and by browser. Because it is frozen on a Friday it shows "Juma Khutbah" where Dhuhr belongs, which is why Dhuhr reads blank. A freshness bug on their side; no reliable Dhuhr until it updates

## 5. Website loads but no times found (81) — re-verified

**12 resolved with real times** — see §1: Al Huda Institute Canada, Islamic Research
Center of Canada, London Muslim Mosque, Islamic Centre of Southwest Ontario, Masjid
Noor-ul-Haram, Erin Islamic Cultural Center, Masjid Al-Salaam (Kawartha), Masjid —
Muslim Society of Guelph, Islamic Centre of Bowmanville, Masjid Al-Abrar, Masjid Subhan
Ajax (both locations), Islamic Centre of Northern Ontario.

**5 confirmed dead** — domain does not resolve or hard 404, not just "could not be
opened": Jamiat-Ul-Ansar of Brampton, Baitul Ehsaan Mosque (404), Baitul Aman Masjid
listing page, Ebu Bekir Islamic Centre, Jafri Islamic Centre of Canada (Windsor).

**3 are Facebook pages, not fetchable sites** — Abu Thar al-Gofary Mosque, Mohawk
Mashjid, Imam Hussain Foundation. All blocked by Facebook's robots.txt, and a Facebook
page is not a reliable scrape target even by hand. Find each a standalone site instead.

**4 are not mosques and probably do not belong in this list** — Muslim Social Services
Waterloo Region and MRCSSI are family/social support charities, Muslim Wellness Network
is a mental-health org, and Cornwall Islamic Foundation is an online Islamic school.
None publish prayer times because none are places of prayer.

**~57 unchanged**, now confirmed current: the site is live but either publishes only
Jumu'ah, embeds an external widget (Mawaqit, TheMasjidApp, AthanPlus, MasjidBox,
mosqueassistantonline) that is not readable as static text, or publishes no schedule at
all. Four worth keeping in view:

- **Masjid Huzaifah** and **Islamic Society of Belleville** — both reference Mawaqit widgets. Check mawaqit.net directly for a masjid-specific slug
- **Masumeen Islamic Centre** and **Zainabiya Community Centre** (both on jaffari.org) — widget says "Prayer times are unavailable for this location", a config bug on their shared platform, not ours
- **St. Thomas Islamic Centre** — 403s automated fetching but loads in a browser; its own widget showed a stale date (Aug 29, not Aug 31) with no numbers rendered. Another site-side freshness bug
- **Al-Rashid Islamic Institute** — the parent org that operates Jami' Masjid Zakariya, per that site's own footer. Check whether this is a duplicate entry rather than a second masjid

## 6. Only a shared organisation homepage (10) — re-verified

- [Halton Islamic Association](https://www.hia.live/) — resolved, moved to §1. masjidhalton.com redirects to hia.live, the org's own real site
- **Mosque Aisha Thorold** — already its own dedicated single-mosque site, so it was mis-filed into this category. Still no numeric times on the page
- **Brantford Mosque** and **Islamic Centre of Brantford** — two entries pointing at one site, and they appear to be the **same physical masjid** (192 Greenwich St, run by the Muslim Association of Brantford). Merge them
- **North End Centre** — confirmed a genuinely separate location from the above (Park Rd N, not Greenwich St), same org and website. The site's widget appears to cover only the Greenwich St building, so North End's own times are not separately available
- **Faizan-E-Madinah Hamilton** and **Madina Masjid Ottawa (Dawat-e-Islami)** — no dedicated site for either beyond the shared dawateislamicanada.net homepage, which has no per-location times. Madina Masjid Ottawa's address (415 McArthur Ave) is known via aggregators but not from an official source
- **Baitun Nusrat, Baitul Quddus, Baitur-Rasheed Mosque** — none appear in Ahmadiyya Canada's own `/mosque/` directory (26 checked by name), unlike the other Ahmadiyya branches in §5 that do have subpages. Baitur-Rasheed's address was confirmed independently (70 Charterhouse Crescent, London, ON) via Doors Open Ontario and Instagram, but it has no standalone site

## 7. No website found in OpenStreetMap or Google (56) — searched individually

**16 do have a findable website.** Three with real quotable times are in §1 (Ummah
Nabawiah Masjid, Dar Al-Hijrah Islamic Center, Islamic Society of York Region), plus
Halton Islamic Association counted under §6. The rest have a site but no scrapeable
timetable: Kanata Muslim Association, Oshawa Mosque (stale), Stratford Mosque,
Naqshbandi Sufi Toronto, Canadian Islamic Civic Academy, Baitul Jannah Islamic Center,
Al-Arqam Islamic Centre, Al-Moustafa Islamic Centre (Hamilton), MUSALLAH QUMSA
(Queen's University), and — notably — **Baitul Hamd Mosque**, **Baitun Naseer Mosque**
and **Hadiqa Ahmad**, all three of which already have pages on `ahmadiyya.ca/mosque/…`
with matching addresses. "No website in OSM or Google" never meant no website exists,
only that neither source had one on file, which is exactly what this category's own
header predicted.

**~24 genuinely have no dedicated website**, only Facebook, directory listings or
aggregators — unchanged after searching: Bab ul Ilm - Bani Hashim Society, Usman Gousi
Mosque, Dawoodi Bohra Al Masjid Al Saifee Anjuman-e-Burhani, Albatool Fatima
Association, Rhoda Masjid and Institute, Islamic Shia Ithna Asheri Association of
Ottawa, Hawkesbury Mosque (now "Hawkesbury Islamic Cultural Centre"), Musalla
As-Sahaba, Istiqlal Mosque (Ballinafad), Al-Hikmah Centre Inc, Jannatul Ferdous Mosque,
Hamza Mosque (Parkdale), Afghan-Canadian Islamic Community, Al-Fatema Islamic Center
(Guelph), Muslim Youth Association Of London, Ahlul-Bayt Mosque (Windsor), Baitul
Haleem Ahmadiyya Mosque (Brantford, also absent from Ahmadiyya's directory), Masjid
Daru-Al-Ullum, Friday Mosque - CFB Borden Multifaith Facility (on a military base),
Alexandria Islamic Centre, Islamic centre of Port Hope, Timmins Masjid & Community
Centre, MAC Qurtuba Islamic Centre (Ottawa), Jamaat of Ontario, and Al-Huda Islamic
Centre (Toronto) — a **possible duplicate** of Al Huda Institute Canada, already
resolved in §1. Worth a dedup check.

**8 Ismaili jamatkhanas — not scrapeable by design.** Meadowvale Ismaili Centre, the
generic "Ismaili Jamatkhana" entry, Ismaili Centre Toronto, Ismaili Jamat Khana (Conroy
Rd, Ottawa), Don Mills Jamatkhana, Brampton Jamatkhana, Ismaili Community Centre and
Jamatkhana (Hamilton), Ismaili Jamatkhana Kingston. None publish a public
Fajr/Dhuhr/Asr/Maghrib/Isha timetable, and that is expected — Ismaili jamatkhanas
generally share timing with registered Jamati members through internal channels rather
than a public site. Treat as a closed cluster, not a gap to keep re-chasing.

## 8. Tracker data is wrong (7) — fix the entry, not the website

- **Mosque Lake** (North Frontenac, ON) — a **lake** literally named "Mosque Lake". Not a mosque. Delete
- **Faith Mosque — "182"** — almost certainly **Fatih Mosque, 182 Rhodes Avenue, Toronto** ("Fatih" is a common Turkish mosque name, easily mistyped as "Faith"). No official site found either way, but fix the name and address
- **House of the Commandments** — real place, full name "House Of The Commandments Masjid Ul Islam", Quinte West, ON. No dedicated site, but the shortened name made it hard to search. Use the full name
- **The Reign of Islamic Da'Wah** — this is TROID (Islamic Information Centre), a known Toronto org on Weston Road. No official site confirmed in this pass — worth a manual check
- **(unnamed)**, **Mosque**, **Masjid Mosque** — three entries with no usable name or address, nothing to search for. Trace back to the original OSM/Google source record or remove

---

## 9. Follow-up: what shipped, and what this list got wrong (2026-08-31)

Every entry in §1 was run through the app's own prayer maths before being written to
`masjids.json` — the same rule `scrape.ts` applies to a scraped read, that an iqamah
cannot fall before its own adhan (3 minutes of slack for rounding). **Eleven passed and
are live; the app went from 134 to 145.** Eight did not.

| | Count |
| --- | ---: |
| Shipped | 11 |
| Held — publishes adhan times, not iqamah | 5 |
| Held — calculation-method disagreement | 1 |
| Held — no address found on their own site | 3 |

**Shipped (11).** Al Huda Institute Canada, Islamic Centre of Southwest Ontario, Masjid
Noor-ul-Haram, Masjid Al-Salaam, Islamic Centre of Bowmanville, Ummah Nabawiah Masjid,
Islamic Research Center of Canada, Muslim Society of Guelph, Masjid Al-Abrar, and Masjid
Subhan at both its Scarborough and Ajax locations. All carry `needsReview: true` and
`source: manual` — read by hand here, never confirmed by the scraper.

**The systematic error in this list: five masjids publish adhan times, not iqamah.**

- [Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/) — Dhuhr 12:30, Asr 15:15 and Isha 19:00 all precede their own adhan, and Isha lands before Maghrib. The original listing below called this row misread rather than merely unusual, and it was right — §1 promoted it on the strength of the site publishing the numbers, which is not the same claim
- [Jami' Masjid Zakariya](https://cornwallmasjid.ca/) — Fajr 04:30 is 24 min before Fajr adhan in Cornwall
- [London Muslim Mosque](http://www.londonmosque.ca/) — Fajr 05:08 is 18 min before Fajr adhan
- [Islamic Society of York Region](https://isyr.org/) — Fajr 05:00 is 16 min before Fajr adhan
- [Erin Islamic Cultural Center](https://erinislamiccenter.ca/) — Isha 20:00 is 81 min before Isha adhan, impossible in Ontario in late August

All five are single-column sites. A congregation is not called before the prayer has
begun, so a single published column that lands before the adhan is the adhan itself.
**Do not re-promote these from §1 without confirming which column the site prints.**

**Held for a different reason (1).**

- [Islamic Centre of Northern Ontario](https://iconosudbury.com/) — Isha 21:18 against a computed adhan of 21:33. Not a misread: the site's own adhan is 21:13, so this is a 20-minute calculation-method disagreement at Sudbury's latitude, not a wrong column. Worth resolving by matching the method the masjid uses rather than by discarding the read

**Held for want of an address (3).** Mevlana Masjid, Halton Islamic Association and Dar
Al-Hijrah Islamic Center publish no postal address on their own sites, so they cannot be
placed. Name-based geocoding is not a fallback here — it returned Masjid Aisha for
"Muslim Society of Guelph" and Muslim Association of Milton for "Halton Islamic
Association", both already in the app under their own entries. A silent duplicate
carrying another masjid's times is the §14 failure this project exists to avoid.

**One correction to §6 of this document.** It reports that `masjidhalton.com` redirects
to `hia.live`, "the org's own real site". That is true, but the site prints no address,
which is why Halton is held rather than shipped.

**Four of the eleven needed `calc.madhab` changed** from hanafi to shafi, inferred the
way `fix-madhab.ts` does it — whichever school puts the Asr adhan before the published
iqamah with the smaller gap. Left on hanafi their real Asr times would have been
rejected as impossible.

---

*Audit performed 2026-08-31. Every "ready to go live" time was read from the masjid's own
site that same day and should be re-checked before long-term reliance — several sites in
this list were independently found to carry stale or internally inconsistent data.*

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
