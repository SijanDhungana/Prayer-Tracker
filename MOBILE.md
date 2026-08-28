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
