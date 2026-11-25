# TechieMan — Firebase setup (M5)
## What the developer (Vishwet) must do — in order

The app ships with **placeholder** config files and runs fully without Firebase
(guest-only local mode). Nothing here needs a real key committed to the repo.
Do these steps once, in this order, in the Firebase console
(https://console.firebase.google.com). ~20 minutes.

## 1. Create the Firebase project

1. Console → **Add project** → name it `TechieMan` (project id will be
   auto-generated, e.g. `techieman-xxxxx` — note it down).
2. Google Analytics: **off** (not needed for M5).
3. Billing: **Spark (free)** is enough for Auth + Firestore at this scale.

## 2. Android app — replace the placeholder config

1. Project settings (gear) → **Your apps** → **Add app → Android**.
2. Android package name: `com.techieman` (must match `applicationId` in
   `android/app/build.gradle` — it already does).
3. App nickname: `TechieMan Android`. SHA-1: skip for now (only needed for
   Google sign-in on some devices — add your debug/release SHA-1 later
   under Project settings if Google sign-in fails with `DEVELOPER_ERROR`).
4. **Download `google-services.json`** and replace
   `android/app/google-services.json` (the committed file is a placeholder
   with project id `techieman-placeholder` — the app treats that id as
   "Firebase absent").
5. Rebuild: `cd app && npm run android`. The app now signs in anonymously
   on first launch and syncs.

## 3. iOS app — replace the placeholder config

1. Project settings → **Add app → iOS**.
2. Apple bundle ID: `com.techieman`.
   **Note:** the Xcode project currently still has the React Native template
   bundle id (`org.reactjs.native.example.$(PRODUCT_NAME:rfc1034identifier)`).
   In Xcode, select the TechieMan target → Signing & Capabilities → set
   Bundle Identifier to `com.techieman` BEFORE registering the app, or
   registration will reject it.
3. Download `GoogleService-Info.plist` and replace
   `ios/TechieMan/GoogleService-Info.plist` (placeholder — same rule as Android).
4. **Add the file to the Xcode project:** in Xcode, right-click the TechieMan
   folder → Add Files → select `GoogleService-Info.plist` → tick the
   TechieMan target. (The file being on disk is not enough — Xcode must
   reference it, or the iOS build will not find it.)

## 4. Enable Auth providers

Authentication → Sign-in method:
1. **Anonymous** → Enable. (Guest upgrade path — no setup needed.)
2. **Email/Password** → Enable. (No email templates needed for M5.)
3. **Google** → Enable. The Web SDK configuration is filled automatically
   from the Android/iOS apps you registered. The `default_web_client_id`
   used by Google sign-in comes from the real `google-services.json` —
   no code change needed.

## 5. Create Firestore + publish the rules

1. Firestore Database → **Create database** → Start in **production mode**,
   location: `asia-south1` (Mumbai — closest to the user base).
2. Rules tab → replace the rules with the contents of `app/firestore.rules`
   → **Publish**. Summary of what they allow:
   - a user reads/writes ONLY `users/{their-uid}` (+ progress + fights);
   - any signed-in player can READ league members, but write ONLY their
     own member doc (weeklyXp / displayName / updatedAt);
   - league group docs are never written by the app.
3. (Optional, later) Indexes: none needed for M5 — all reads are by document
   id or a single subcollection list.

## 6. Verify on a device

1. `npm run android` (or iOS). Play one Chapter 1 fight.
2. Home → Account card should say **"Synced ✓"** (not "not set up").
3. Firebase console → Firestore → `users/{uid}` — you should see the profile
   doc, `progress/{nodeId}` docs, and `fights/` entries.
4. Kill the app, reopen, sign in with email on the Login screen — the same
   XP must appear (merge keeps the higher XP; check the Account card's
   merge line).
5. Sign out → local progress must still be there. Delete account is a
   separate confirm dialog on Home → it wipes cloud + local on purpose.

## 7. Leagues — weekly assignment (optional Cloud Function)

Leagues are NOT assigned by the app (it never invents opponents). The app
writes each signed-in player's `weeklyXp` into their user doc on every sync,
and reads the league the function placed them in (`users/{uid}.currentLeague`).

Until the function exists, the League screen honestly says "not placed yet".
When you are ready, deploy this scheduled function (Node.js, Firebase
Functions v2, `functions/` directory — not included in the app repo yet):

```js
// Runs every Monday 00:05 UTC. Reads all users with weeklyXp > 0 for the
// new week, sorts by (previous tier desc, weeklyXp desc), chunks into
// 30-player groups (same rule as src/firebase/leagues.ts buildLeagues),
// writes leagues/{weekId}/groups/{leagueId} { tier, createdAt } and the
// members subcollection, then writes users/{uid}.currentLeague =
// { weekId, leagueId } for each player. Promotion/demotion for the NEXT
// week uses src/firebase/leagues.ts weekResults() on the finished league.
```

That function is a separate milestone (M5.5) — the app side is complete
without it.

## What is NOT in the repo (by design)

- No real API keys, no service-account JSON, no `google-services.json` with
  a real project id. Firebase Android/iOS API keys are not secrets in the
  cryptographic sense, but they are still never committed — the placeholder
  keeps the repo clean and the app's `isFirebaseConfigured()` check keeps
  placeholder builds honest.
- No Cloud Function code yet (see step 7).
- No Analytics / Crashlytics / Remote Config (M7 polish, if wanted).
