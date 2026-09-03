# Shipping Masjid Times as a mobile app

The web app is wrapped with [Capacitor](https://capacitorjs.com): the same
React build runs inside a native shell, so there is one codebase and one set of
prayer-time logic. `ios/` and `android/` are real, committed native projects.

Bundle ID: `com.sijandhungana.masjidtimes` (in `capacitor.config.ts`). It is
also the Android package name. **Change it before the first App Store
submission or not at all** — once an app is published under a bundle ID, a new
ID means a new listing, with reviews and installs starting from zero.

## Everyday workflow

```bash
npm run mobile:ios       # build, sync, open Xcode
npm run mobile:android   # build, sync, open Android Studio
npm run mobile:sync      # build + copy into both, no IDE
```

`cap sync` copies `dist/` into the native projects. The copies are gitignored,
so **always sync after pulling** — the native projects do not carry web assets
in git and will otherwise run whatever was last built locally.

## Prayer times in a packaged app

This matters more here than on the web. `src/data/masjids.json` is compiled
into the bundle, and in an installed app that copy is frozen at build time. The
daily scrape would never reach anyone without an App Store release.

So the app fetches the directory at runtime (`src/lib/masjidData.ts`), rendering
the bundled copy first and upgrading in place when the deployment has something
newer. For that to work in a native build you **must** set:

```
VITE_DATA_URL=https://your-app.vercel.app/masjids.json
```

Unset, a native build silently falls back to its own frozen copy — it works,
but the times never change. Two things make the fetch possible cross-origin,
both already configured in `vercel.json`: an `Access-Control-Allow-Origin`
header (a packaged app's origin is `capacitor://localhost`, so this is a
cross-origin request that Vercel would otherwise block) and a `Cache-Control`
that forces revalidation, since a cached copy of this file is a stale prayer
time.

Nothing fetched is trusted blindly: every entry is validated field by field,
and a payload older than what is already on screen is refused, so a rolled-back
deployment cannot push last month's times onto a current install.

## Permissions

Both are already declared, and both are load-bearing:

- **iOS** — `NSLocationWhenInUseUsageDescription` in `ios/App/App/Info.plist`.
  Without it iOS *terminates the app* when the map's crosshair calls
  `navigator.geolocation`, and App Review rejects builds whose usage strings
  are missing or vague.
- **Android** — `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` in
  `AndroidManifest.xml`. Without them the crosshair silently does nothing.

## Getting it onto your own iPhone

No paid account needed for this part; a free Apple ID signs builds that last
seven days.

1. `npm run mobile:ios`
2. In Xcode: select the **App** target → **Signing & Capabilities**
3. Tick **Automatically manage signing**, pick your Apple ID under **Team**
4. Plug in the iPhone, select it as the run destination, press **Run**
5. First launch: **Settings → General → VPN & Device Management** on the phone,
   and trust your developer certificate

## The home-screen widget

`ios/App/PrayerWidget/` holds a WidgetKit extension showing the next **iqamah**
at the masjid nearest you — iqamah and not adhan, because the congregation time
is the whole point of the app (§2 of CLAUDE.md) and an astronomical time on a
home screen answers a question nobody asked. The adhan sits underneath it in
small type, since the gap between the two is what tells you whether you can
still make it.

It is deliberately self-contained. It fetches the same `masjids.json` the app
fetches (`MasjidDirectory.url`, which must match `VITE_DATA_URL`), computes
adhan times with **Adhan-Swift**, and resolves the same `fixed`/`offset` iqamah
rules `src/lib/prayer.ts` resolves. Using Adhan-Swift rather than reimplementing
the astronomy is the point: it is the same algorithm by the same authors as the
web app's `adhan`, so the widget and the app agree by construction instead of by
two implementations happening to round the same way. That agreement is checked —
four live masjids, both rule types, matching to the minute.

Two steps have to happen in Xcode's GUI. Creating an app-extension target means
new build phases and an embed step, and hand-editing `project.pbxproj` to fake
that is a good way to end up with a project that no longer opens.

**1. Create the target.** `npm run mobile:ios`, then in Xcode:
**File → New → Target… → Widget Extension**. Name it `PrayerWidget`, leave
"Include Live Activity" and "Include Configuration App Intent" **unchecked**
(this widget uses `StaticConfiguration`), and activate the scheme when asked.

Xcode writes its own template files. **Delete the generated `.swift` files** —
they carry their own `@main`, and two in one target will not build — then drag
the four real ones in from `ios/App/PrayerWidget/`, ticking the `PrayerWidget`
target: `MasjidData.swift`, `PrayerMath.swift`, `LocationProvider.swift`,
`PrayerWidget.swift`.

**2. Add Adhan-Swift.** **File → Add Package Dependencies…**, enter
`https://github.com/batoulapps/adhan-swift`, and add the `Adhan` product **to
the PrayerWidget target** (not to App).

Then set the extension's deployment target to **iOS 17** — `containerBackground`
requires it — and Run.

### Location

The widget asks for one coarse fix per timeline through
`CLLocationManager.isAuthorizedForWidgetUpdates`. Widgets do not get continuous
location; they inherit the container app's authorization, and the app having
permission is not on its own enough. **The extension's own `Info.plist` must
declare `NSWidgetWantsLocation = YES`** — without it that property is always
false, and the first device build shipped exactly that way: the app showed
"My location" while the widget on the same phone said "Location off for
widgets". The extension also carries its own
`NSLocationWhenInUseUsageDescription`, since a location manager in an extension
reads the extension's plist, not the app's.

When there is no fix the widget says "Location off for widgets" rather than
falling back to a default city. A widget quietly showing another city's masjid
is worse than one that admits it does not know where you are.

### What it does when things go wrong

- **No network** — the last good directory is cached in the extension's
  container and reused. Nothing partial is ever cached: the payload is decoded
  first, and only a payload that parses replaces the last one.
- **Times past the last Isha** — rolls to tomorrow's Fajr rather than going
  blank, which is exactly when someone is checking whether they can still make
  it.
- **A masjid whose rules will not resolve** — skipped for the next one along.
  Being closest is not useful if it cannot answer the question.
- **Times over 45 days old, or never scraper-verified** — marked with a small
  `exclamationmark.circle`, matching `STALE_AFTER_DAYS` in `src/lib/trust.ts`.


## Submitting to the App Store

1. **Enrolment approved.** Paying is not the same as being approved — wait for
   the email, then accept the current agreements in App Store Connect. Builds
   are rejected at upload with an unhelpful error until the agreements are
   signed.
2. **Create the app record** in App Store Connect: name, primary language,
   the bundle ID above, and an SKU (any private string, e.g. `masjidtimes01`).
3. **Archive and upload.** In Xcode: destination **Any iOS Device**, then
   **Product → Archive → Distribute App → App Store Connect**.
4. **Fill in the listing.** Screenshots are mandatory at the current required
   iPhone sizes, plus description, keywords, and a support URL.
5. **Privacy.** Two separate obligations, and both block submission:
   a public **privacy policy URL**, and the **App Privacy questionnaire**.
   This app requests location, so it must be declared even though the location
   never leaves the device — the questionnaire asks what is *collected*, and
   "used on device only, not collected" is a valid, accurate answer here.
6. **Submit for review.** Usually a day or two.

### The rejection risk worth planning for

App Store Review Guideline **4.2 (Minimum Functionality)** rejects apps that
are essentially a website in a wrapper. A Capacitor app is exactly the shape
reviewers look at hardest, so the defence is to do something a web page cannot:

- **Local notifications for prayer reminders** — the strongest answer, and
  independently the feature most likely to keep the app installed. Not built
  yet.
- **A home-screen widget** — built, see above. Not as strong as notifications,
  but it is a real platform feature a web page cannot offer, and it is the kind
  of thing a reviewer looking at 4.2 can see in a screenshot.
- **Offline support** — already true: the bundled directory means the app opens
  and shows times with no network at all.

Shipping the notification feature before the first submission is the
recommended order. Reviewers do read the description, so it should lead with
what the app does natively rather than describing a website.

## Android

Google Play needs a signed release build and a one-time $25 developer account.
`npm run mobile:android` opens Android Studio; **Build → Generate Signed
Bundle/APK** produces the `.aab` that Play requires. Keep the keystore and its
password somewhere safe — losing it means you can never update the app again.
