# Masjids found but not live — audit update (2026-08-31)

This is a manual, site-by-site re-check of every entry below, done on August 31, 2026.
Each site was fetched live (and several were checked in a real browser when the
automated fetcher hit a bot-block or a JS-only widget). Where a site now shows real,
current prayer times, they're quoted verbatim so they can be entered directly —
per this file's own original instruction ("if you can see the real times, send them
over and these go live immediately").

**Headline result: 19 masjids can go live right now** with verified real times (listed
first, below). A handful more have real sites with times that need a small manual
follow-up (stale dates, a garbled widget, a blocked fetch). The rest remain not-live
for the same underlying reasons as before, now confirmed current as of today rather
than whenever they were last scraped. A new section at the bottom flags data-quality
problems in the tracker itself (duplicate entries, a lake mis-tagged as a mosque, a
likely name typo, and a cluster of Ismaili jamatkhanas that structurally don't publish
this kind of schedule).

---

## ✅ Ready to go live now — verified real times (19)

All times below were read directly off each masjid's own site on Monday, August 31,
2026 and are quoted as shown (Adhan/Begins time first, Iqamah second where both are
given).

| Masjid | Site | Fajr | Dhuhr | Asr | Maghrib | Isha |
| --- | --- | --- | --- | --- | --- | --- |
| Jami' Masjid Zakariya (Cornwall) | [cornwallmasjid.ca](https://cornwallmasjid.ca/) | 4:30 AM | 1:30 PM | 6:30 PM | Sunset | 11:15 PM |
| Muslim Association of Tillsonburg | [muslimassociationtillsonburg.ca](https://muslimassociationtillsonburg.ca/) | 6:15 AM | 12:30 PM | 3:15 PM | Sunset | 7:00 PM |
| Mevlana Masjid | [a-than.info](https://a-than.info/vv.php?code=MEVLANA01) | 4:57/5:30 AM | 1:23/1:45 PM | 5:05/5:45 PM | 8:03/8:05 PM | 9:25/9:45 PM |
| Al Huda Institute Canada | [alhudainstitute.ca](https://alhudainstitute.ca/) | 6:00 AM | 1:40 PM | 5:45 PM | +5 min after Adhan | 9:45 PM |
| Islamic Research Center of Canada Inc. | [irccan.com](http://www.irccan.com/) | 5:45 AM | 1:45 PM | 6:00 PM | After Sunset | 9:15 PM |
| London Muslim Mosque | [londonmosque.ca](http://www.londonmosque.ca/) | 5:08 AM | 1:30 PM | 5:20 PM | 8:25 PM | 9:44 PM |
| Islamic Centre of Southwest Ontario | [islamiccentre.ca](https://islamiccentre.ca/) | 5:26 AM | 1:25 PM | 5:08 PM | 8:01 PM | 9:24 PM |
| Masjid Noor-ul-Haram | [wimcanada.com](https://wimcanada.com/) | 6:00 AM | 1:45 PM | 6:30 PM | Sunset | 9:45 PM |
| Erin Islamic Cultural Center | [erinislamiccenter.ca](https://erinislamiccenter.ca/) | 5:30 AM | 2:00 PM | 6:00 PM | Sunset | 8:00 PM |
| Masjid Al-Salaam (Kawartha Muslim Religious Assoc.) | [kmrapeterborough.org](https://www.kmrapeterborough.org/) | 5:11/5:30 AM | 1:14/1:30 PM | 4:57/5:30 PM | 7:54/7:59 PM | 9:17/9:30 PM |
| Masjid – Muslim Society of Guelph | [msofg.org](http://www.msofg.org/) | 5:09/6:15 AM | 1:26/1:45 PM | 6:01/6:30 PM | 8:05/8:05 PM | 9:11/9:30 PM |
| Islamic Centre of Bowmanville | [icbmasjid.com](https://icbmasjid.com/) | 5:13/6:00 AM | 1:15/2:00 PM | 5:55/6:15 PM | 7:52/7:57 PM | 9:16/9:30 PM |
| Masjid Al-Abrar | [alabrar.ca](http://www.alabrar.ca/) | 5:45 AM | 1:30 PM | 5:30 PM | Sunset | 9:30 PM |
| Masjid Subhan Ajax — Ajax location | [subhanislamicassociation.org](https://www.subhanislamicassociation.org/) | 6:00 AM | 2:00 PM | 6:15 PM | Sunset | 9:30 PM |
| Masjid Subhan Ajax — Scarborough location | (same site) | 5:45 AM | 2:00 PM | 6:45 PM | Sunset | 9:30 PM |
| Islamic Centre of Northern Ontario (ICONO Sudbury) | via [masjidbox.com](https://masjidbox.com/prayer-times/islamic-centre-of-northern-ontario) (linked from iconosudbury.com) | 5:14/5:45 AM | 1:24/1:45 PM | 5:06/6:30 PM | 8:04/8:09 PM | 9:13/9:18 PM |
| Halton Islamic Association (HIA) | [hia.live](https://www.hia.live/) (the real site — masjidhalton.com just redirects here) | 5:20 AM | 1:20 PM | 5:02 PM | 7:58 PM | 9:14 PM |
| Ummah Nabawiah Masjid | [theunm.com](https://www.theunm.com/) | 5:45/6:00 AM | 1:30/1:45 PM | 6:15/6:30 PM | Sunset | 9:20/9:30 PM |
| Dar Al-Hijrah Islamic Center | [darulhijra.org](https://darulhijra.org/) | 5:15 AM | 1:40 PM | 5:30 PM | Sunset | 9:45 PM |
| Islamic Society of York Region | [isyr.org](https://isyr.org/) | 5:00 AM | 2:00 PM | 5:30 PM | After Sunset | 10:00 PM |

Notes on a few of these:
- **Jami' Masjid Zakariya**: the original "impossible" flag was right that these times are unusual (a very late 11:15 PM Isha), but the live site genuinely publishes them. That's a masjid-side scheduling question, not a scraper bug — safe to publish as scraped.
- **Bosnian Canadian Islamic Centre** and **Islamic Centre of Cambridge** are *not* in this list — see the "still flagged" notes in Categories 1 and 2 below; they have real-looking widgets but the numbers themselves don't check out.

---

## ⚠️ Real site, real times exist, but needs a manual step first (4)

- **Kanata Muslim Association** — [kanatamuslims.ca](https://kanatamuslims.ca/) is real and has a live times widget, but the automated reader ran the Adhan/Iqamah pairs together (e.g. "DHUHR 1:041:30"). Needs a human (or a browser-rendered scrape) to read the widget cleanly. Org is currently renting space while it fundraises for a permanent building — worth confirming times are still accurate as they move.
- **Oshawa Mosque** — [oshawamosque.com](https://oshawamosque.com/) has a full prayer-times table, but it's showing a **stale 2019 schedule**. Needs the masjid to refresh their own page before this is usable.
- **Al-Arqam Islamic Centre** — [alarqam.ca](http://www.alarqam.ca/) loads but returned empty content to the automated fetcher (likely a JS SPA). Needs a live-browser check.
- **Al Mahdi Islamic Community Centre** — [almahdicentre.org](https://almahdicentre.org/) shows Fajr 5:26 AM, Dhuhr 1:25 PM, Maghrib 8:17 PM, plus Sunrise/Sunset, but Asr and Isha weren't captured in this pass — needs a closer look at the page for those two.

---

## 1. Times read but impossible (5) — re-verified

- **[Jami' Masjid Zakariya](https://cornwallmasjid.ca/)** — ✅ moved to the live list above. The scraper read it correctly; the masjid's own site really does say Fajr 4:30 AM / Isha 11:15 PM.
- **[Muslim Association of Tillsonburg](https://muslimassociationtillsonburg.ca/)** — ✅ moved to the live list above. Worth flagging to the masjid separately: Isha is a fixed 7:00 PM while Maghrib floats with sunset, so on long summer days (like now) Isha can land *before* Maghrib. That's the site's own scheduling, not a read error.
- **[Bosnian Canadian Islamic Centre](https://bkic.ca/)** — still flagged, unchanged. Live-checked today: Athan Fajr 03:58 / Isha 10:54, Iqamah Fajr 05:00 / Isha 10:45 (Iqamah Isha is *before* Athan Isha — internally inconsistent). Also, this section of the page doesn't render visibly on screen (the numbers are in the HTML but invisible — a display bug on their end), and the times look about an hour too early for August 31 (more like a mid-summer solstice pattern than late August). Recommend contacting the masjid rather than trusting this data as-is.
- **[Mevlana Masjid](https://a-than.info/vv.php?code=MEVLANA01)** — ✅ moved to the live list above. This site is JS-rendered; a plain fetch just sees "--:--" placeholders. The scraper needs to wait for the page's JS to finish loading (or hit whatever API the widget calls) rather than reading the raw HTML.
- **[Zawiya Fellowship – Annoor Jami Mosque](https://zawiyafellowship.com/)** — recommend **moving out of "impossible" and into "no full timetable published."** Checked the homepage and the dedicated `/prayers-schedule/` page: the site only ever publishes Zuhr (1:30 PM) and Jumu'ah (1:30 PM). There's no Fajr/Asr/Maghrib/Isha anywhere on the site to confirm or refute the original 4:36 AM Fajr read.

## 2. Times read but a prayer was blank (3) — re-verified

- **[Imam Mahdi Islamic Centre](https://imammahdi.ca/)** — **confirmed legitimate, not a bug.** The site explicitly states it only publishes Fajr, Dhuhr & Maghrib ("Sunrise, sunset & midnight are reference times, not prayers"), consistent with Shia combined-prayer practice. Leave as-is.
- **[Al Zahra Shia Association of Waterloo Region](https://www.alzahra.ca/)** — likely the same pattern. Live-checked today: Fajr 5:02 AM, Dhuhr 1:23 PM, Maghrib 8:15 PM are shown; there's no Asr/Isha column on the page at all, not just missing values.
- **[Islamic Centre of Cambridge](http://iccambridge.com/)** — **found the actual cause: the site's prayer-times widget is stuck on "August 28, 2026" (a Friday) and isn't updating**, confirmed both by the automated fetch and a live browser check on Monday, August 31. Because it's frozen on a Friday, the table shows "Juma Khutbah" in place of a Dhuhr row — that's why Dhuhr reads blank. This is a freshness bug on their site, not a genuinely missing prayer. No reliable Dhuhr time is retrievable until their widget updates itself.

## 3. Website loads, no times found (81 → 12 resolved, 5 confirmed dead, 3 unreachable, 4 not actually masjids, ~57 unchanged)

**Resolved with real times** (see the live-list table above): Al Huda Institute Canada,
Islamic Research Center of Canada, London Muslim Mosque, Islamic Centre of Southwest
Ontario, Masjid Noor-ul-Haram, Erin Islamic Cultural Center, Masjid Al-Salaam/Kawartha,
Masjid – Muslim Society of Guelph, Islamic Centre of Bowmanville, Masjid Al-Abrar,
Masjid Subhan Ajax (both its Ajax and Scarborough locations), and Islamic Centre of
Northern Ontario (ICONO Sudbury — the site itself now loads fine; the times live on a
linked masjidbox.com page, not the main domain).

**Confirmed genuinely dead** (domain doesn't resolve, or a hard 404 — not just "could
not be opened" anymore, actually gone): Jamiat-Ul-Ansar of Brampton, Baitul Ehsaan
Mosque (404), Baitul Aman Masjid listing page, Ebu Bekir Islamic Centre, Jafri Islamic
Centre of Canada (Windsor).

**Not real, fetchable websites** — all three "no times found" Facebook page links
(Abu Thar al-Gofary Mosque, Mohawk Mashjid, Imam Hussain Foundation) are blocked from
automated access by Facebook's own robots.txt, and a Facebook page isn't a reliable
scrape target even by hand. Recommend searching for an actual standalone site for each
instead of continuing to point the tracker at Facebook.

**Probably shouldn't be in a masjid list at all** — four of these are legitimate
organizations that simply aren't mosques: Muslim Social Services Waterloo Region and
Muslim Resource Centre for Social Support & Integration (MRCSSI) are family/social
support charities; Muslim Wellness Network is a mental-health org; Cornwall Islamic
Foundation is an online Islamic school ("CIF Online Islamic School"), not a physical
masjid. None of the four publish prayer times because they're not places of prayer.

**Everything else (~57 entries)** was re-checked and the underlying situation is
unchanged from the original scrape, now confirmed current: the site is live but
either (a) only publishes Jumu'ah/Friday times, not a full daily table, (b) embeds
its times via an external widget (Mawaqit, TheMasjidApp, AthanPlus, MasjidBox,
mosqueassistantonline) that isn't readable as static text, or (c) genuinely doesn't
publish a schedule anywhere. A few specific notes worth keeping:
- **Masjid Huzaifah** and **Islamic Society of Belleville** both reference Mawaqit
  widgets — worth checking mawaqit.net directly for a masjid-specific slug for each.
- **Masumeen Islamic Centre** and **Zainabiya Community Centre** (both on jaffari.org)
  have a widget that explicitly says "Prayer times are unavailable for this location" —
  a configuration bug on their shared platform, not a scraper problem.
- **St. Thomas Islamic Centre** blocks automated fetching (403) but is reachable in a
  real browser; its own "Today's Prayer Times" widget was showing a stale date
  (Aug 29 instead of Aug 31) with no numbers rendered — another site-side freshness bug.
- **Al-Rashid Islamic Institute** is the parent organization that operates Jami' Masjid
  Zakariya (per that site's own footer) — worth checking whether this is a duplicate
  tracker entry rather than a second masjid.

## 4. Only a shared organisation homepage (10) — re-verified

- **Halton Islamic Association (HIA)** — ✅ resolved, moved to the live list above. `masjidhalton.com` redirects to `hia.live`, which is the org's own real, working site.
- **Mosque Aisha Thorold** — this one turns out to already be its **own dedicated single-mosque site**, not actually a shared homepage — may have been mis-filed into this category originally. LIVE+NO-TIMES (no numeric times on the page).
- **Brantford Mosque** and **Islamic Centre of Brantford** — these two tracker entries point to the same site and appear to be the **same physical masjid** (192 Greenwich St, run by the Muslim Association of Brantford). Recommend merging them into one entry rather than treating as separate masjids.
- **North End Centre (a project of MAB)** — confirmed **legitimately a separate physical location** from the above, at Park Rd N (vs Greenwich St), still under the Muslim Association of Brantford and the same website. The site's embedded prayer widget appears to only cover the main Greenwich St building — North End Centre's own times aren't separately available yet.
- **Faizan-E-Madinah Hamilton** and **Madina Masjid Ottawa (Dawat-e-Islami)** — no dedicated website found for either beyond the shared `dawateislamicanada.net` homepage, which has no location-specific times. Madina Masjid Ottawa's address (415 McArthur Ave) is known via third-party aggregators (cmzapp.com, mosquefinder.co.uk) but not from an official source.
- **Baitun Nusrat Mosque, Baitul Quddus Mosque, Baitur-Rasheed Mosque** — none of these three appear in Ahmadiyya Canada's own `/mosque/` directory (26 mosques checked by name), unlike the other Ahmadiyya branches in Category 3 that do have their own subpages. Baitur-Rasheed's real address was confirmed independently (70 Charterhouse Crescent, London, ON) via Doors Open Ontario and Instagram, but it has no standalone website — only social media.

## 5. No website found in OpenStreetMap or Google (56) — searched individually

**16 turned out to have a findable website** — see the live-times table and the
"needs a manual step" table above for the ones with real, quotable times (Ummah
Nabawiah Masjid, Dar Al-Hijrah Islamic Center, Islamic Society of York Region, plus
Halton Islamic Association counted under Category 4). The rest that have a site but
no scrapeable timetable: Kanata Muslim Association, Oshawa Mosque (stale), Stratford
Mosque, Naqshbandi Sufi Toronto, Canadian Islamic Civic Academy, Baitul Jannah
Islamic Center, Al-Arqam Islamic Centre, Al-Moustafa Islamic Centre (Hamilton),
MUSALLAH QUMSA (Queen's University), and — notably — **Baitul Hamd Mosque, Baitun
Naseer Mosque, and Hadiqa Ahmad** all turned out to already have pages on
`ahmadiyya.ca/mosque/...` with matching addresses. The original "no website in
OSM/Google" claim doesn't mean no website exists at all — it means neither OSM nor
Google had one on file, and for these three (plus the 13 others above) a plain web
search found one anyway, which is exactly the gap this category's own header
predicted.

**~24 confirmed to genuinely have no dedicated website**, only Facebook pages,
directory listings, or aggregator sites — this list is unchanged after searching:
Bab ul Ilm - Bani Hashim Society, Usman Gousi Mosque, Dawoodi Bohra Al Masjid Al
Saifee Anjuman-e-Burhani (Dawoodi Bohra mosques are typically community-internal and
don't publish public sites), Albatool Fatima Association, Rhoda Masjid and Institute,
Islamic Shia Ithna Asheri Association of Ottawa, Hawkesbury Mosque (now going by
"Hawkesbury Islamic Cultural Centre"), Musalla As-Sahaba, Istiqlal Mosque / Istiqlal
Islamic Centre of Toronto (Ballinafad), Al-Hikmah Centre Inc, Jannatul Ferdous Mosque,
Hamza Mosque (Parkdale), Afghan-Canadian Islamic Community, Al-Fatema Islamic Center
(Guelph), Muslim Youth Association Of London, Ahlul-Bayt Mosque (Windsor), Baitul
Haleem Ahmadiyya Mosque (Brantford — also absent from Ahmadiyya's own directory),
Masjid Daru-Al-Ullum ("[Car Wash Building]" suggests a small storefront musalla),
Friday Mosque - CFB Borden Multifaith Facility (on a military base — unlikely to ever
have a public civilian site), Alexandria Islamic Centre, Islamic centre of Port Hope,
Timmins Masjid & Community Centre, MAC Qurtuba Islamic Centre (Ottawa), Jamaat of
Ontario, and Al-Huda Islamic Centre (Toronto) — **possible duplicate** of "Al Huda
Institute Canada" already resolved in Category 3, worth a manual dedup check.

**8 Ismaili jamatkhanas** — Meadowvale Ismaili Centre, the generic "Ismaili
Jamatkhana" entry, Ismaili Centre Toronto, Ismaili Jamat Khana (Conroy Rd, Ottawa),
Don Mills Jamatkhana, Brampton Jamatkhana, Ismaili Community Centre And Jamatkhana –
Hamilton, and Ismaili Jamatkhana Kingston. None have a public site with a
Fajr/Dhuhr/Asr/Maghrib/Isha-style timetable, and that's expected: Ismaili jamatkhanas
generally don't publish this kind of public schedule the way Sunni and Shia Ithna
Asheri mosques do — attendance and timing information is typically for registered
Jamati members through internal channels, not a public website. Recommend treating
this whole cluster as **not scrapeable by design**, not as a data gap to keep
re-chasing.

**Data-quality issues found in the tracker itself** (not website problems — the
underlying entries look wrong):
- **Mosque Lake** (North Frontenac, ON) — this is a **lake**, literally named "Mosque
  Lake." It is not a mosque. Recommend deleting this entry entirely.
- **Faith Mosque — "182"** (partial address) — almost certainly a mangled version of
  **Fatih Mosque, 182 Rhodes Avenue, Toronto** ("Fatih" is a common Turkish mosque name
  meaning "conqueror"; easy to mistype/OCR as "Faith"). No independent official site
  was found for Fatih Mosque either, but the name/address should be corrected in the
  tracker regardless.
- **House of the Commandments** — real place, full name is "House Of The Commandments
  Masjid Ul Islam" in Quinte West, ON. No dedicated website found (only aggregator
  listings), but the tracker's shortened name made it hard to search — worth updating
  to the full name.
- **The Reign of Islamic Da'Wah** — this is TROID (The Reign of Islamic Da'Wah,
  Islamic Information Centre), a known Toronto organization on Weston Road. No
  official website was confirmed in this pass — worth a manual check.
- **(unnamed)**, **Mosque**, **Masjid Mosque** — three entries with no usable name or
  address; nothing to search for. These likely need to be traced back to their
  original OSM/Google source record to identify what they actually are, or removed.

---

*Audit performed 2026-08-31. All "live" times above were read directly from each
masjid's own site earlier the same day and should be double-checked again before
long-term reliance, since several sites in this list were independently found to
have stale or inconsistent data on their own end.*

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
