# myJungle — QA record

What was actually exercised, how, and what was found. Anything not verified is
listed as not verified rather than assumed.

**Environment:** Firebase Emulator Suite (Auth, Firestore, Storage) with the real
`firestore.rules` and `storage.rules` loaded, driven through the app's own UI in a
Chromium browser at 375×812 (mobile), 360 px (narrow) and 1280×820 (desktop), in
both Hebrew/RTL and English/LTR.

---

## Core workflows

| # | Workflow | Result |
|---|---|---|
| 1 | Sign up (tested with email+password before that provider was removed) | ✅ Account created, jungle auto-created, home screen rendered |
| 2 | Sign in / sign out | ✅ Session survives reload; sign-out clears the active jungle so the next person never inherits it |
| 3 | Create plant | ✅ Saved, redirected to the new plant |
| 4 | Create plant with an empty name | ✅ Blocked, stays on the form |
| 5 | Edit plant | ✅ Profile fields updated, history untouched |
| 6 | Archive plant | ✅ Hidden from the jungle, still in Settings → Archived, restorable |
| 7 | Delete plant | ✅ Requires typing `DELETE`; confirm button stays disabled until then |
| 8 | Log watering | ✅ Amount, substrate state, drainage, note all stored and shown in the timeline |
| 9 | Log "checked — still moist" | ✅ Recorded as a check, not a watering; shortens the next check window |
| 10 | Log growth measurement (×3, backdated) | ✅ Chart, change (+5 cm) and rate (2.6 cm/month) all computed correctly |
| 11 | Add timeline event (free choice) | ✅ Type picker grouped by category; all 30 types reachable |
| 12 | Add health issue | ✅ Opened, shown as "open for 12 days" |
| 13 | Update health issue → resolved | ✅ Moved to Resolved, "resolved after 12 days", update history kept |
| 14 | Log fertilizing | ✅ Product, type, dose, dilution, method stored |
| 15 | Log repotting | ✅ Old/new pot size, old/new substrate, root condition, root treatment stored; plant's pot size and substrate updated to match |
| 16 | Move a plant | ✅ Event recorded *and* the plant's room/location updated |
| 17 | Take a cutting | ✅ Child plant created in water, linked to the mother, events written on both |
| 18 | Lineage both ways | ✅ Mother lists its cuttings; cutting links back to its mother |
| 19 | Upload photo | ✅ 135 KB source → 21 KB stored (resized to 1600 px), appears in the gallery |
| 20 | Delete a timeline entry | ✅ 8 entries → 7, confirmation required |
| 21 | Search | ✅ By species (4 hits), and by text inside an *event note* (1 hit) |
| 22 | Filters | ✅ Cuttings → 8; quick filters, facets and sort all applied |
| 23 | Insights | ✅ Produced only the one card the data supported; the rest correctly withheld |
| 24 | Export backup | ✅ JSON with 25 plants and 10 events, `format: myjungle-backup` |
| 25 | Restore that backup | ✅ "Restored 25 plants and 10 entries" — count stayed 25, not 50 |
| 26 | Language switch he ⇄ en | ✅ `dir` and `lang` flip, layout intact, no reload |
| 27 | Dark mode | ✅ Applied instantly and persisted across reloads |

## Multi-jungle and sharing

| # | Workflow | Result |
|---|---|---|
| 28 | Auto-create first jungle | ✅ Created on first sign-in |
| 29 | Create a second jungle | ✅ "Balcony" created and empty — data isolated from the first |
| 30 | Switch jungles | ✅ Plants, events and members all swap |
| 31 | Create invite link | ✅ Code `B9T3XQUSQK`, link `…/#/join/B9T3XQUSQK` |
| 32 | Open invite link while signed out | ✅ Survives the sign-up round trip and returns to the invite |
| 33 | Join via invite | ✅ Second account joined and immediately saw all 23 plants; chip showed "· 2" |
| 34 | Both members write to one jungle | ✅ Second account logged waterings, growth and health that the first can see |

## Security — verified from outside the app

Called the Firestore REST API directly with a **non-member's** ID token, bypassing
the UI entirely:

| Attempt | Expected | Result |
|---|---|---|
| Read another jungle's `plants` | denied | ✅ **403** |
| Read another jungle's `events` | denied | ✅ **403** |
| Read the jungle document | denied | ✅ **403** |
| Add self as a member with no invite | denied | ✅ **403** |
| Read plants with no token at all | denied | ✅ **403** |

Rules also enforce: only the owner can remove members or rename the jungle; a member
can only edit their own membership document and cannot change their own role; invites
are `get`-only (you must know the code) and can never be listed.

## Data integrity

| # | Case | Result |
|---|---|---|
| 35 | Tap Save twice on one form | ✅ **Exactly one** event written — each open form fixes its document id once |
| 36 | Run the prototype import | ✅ 23 plants + photos imported |
| 37 | Run it a second time | ✅ "Imported 0, updated 0, skipped 23" — nothing duplicated |
| 38 | Restore the same backup twice | ✅ Records updated in place, no clones |
| 39 | Editing a plant after logging history | ✅ History untouched (separate documents by design) |
| 40 | Delete a mother that has cuttings | ✅ Warned "this plant is the mother of 1 cutting"; after deletion the cutting shows "Mother plant no longer in your jungle" instead of breaking |
| 41 | Refresh mid-session | ✅ No data loss |

## Offline

| # | Case | Result |
|---|---|---|
| 42 | Go offline | ✅ "Offline — changes are saved on this device" pill appears |
| 43 | Log a watering while offline | ✅ Sheet closes, toast confirms, plant updates immediately |
| 44 | Reconnect | ✅ Pill clears, Settings shows "Everything is synced" |
| 45 | Confirm the write actually landed | ✅ Read back from the server over REST — the offline note was present |

## Layout

| # | Case | Result |
|---|---|---|
| 46 | Mobile 375 px, RTL | ✅ Bottom tab bar, 3×2 quick actions, sheets from the bottom |
| 47 | Mobile 375 px, LTR | ✅ Mirrored correctly; Hebrew plant names left-aligned but ordered correctly |
| 48 | Narrow 360 px | ⚠️ Found overflow in the app bar and badges → **fixed** (truncation + max-width) |
| 49 | Desktop 1280 px | ✅ Side rail nav, centred content, 3-column grid |
| 50 | Growth chart in RTL | ✅ Time runs right→left, axis labels legible |
| 51 | Touch targets | ✅ 44 px minimum throughout |

---

## Bugs found during QA and fixed

1. **Quick actions saved empty events.** The plant screen wrapped the event type twice, so `fieldsFor()` never matched and watering/growth/fertilizing forms rendered with only date, time and notes. Fixed and re-verified all six quick actions.
2. **Offline saves hung forever.** `setDoc` only resolves on *server* acknowledgement, so `await`ing it left every sheet spinning with the button stuck on "Saving…". Writes are now issued local-first; failures surface asynchronously as a toast. Storage cleanup after a delete was awaited for the same reason and is now fire-and-forget.
3. **The join flow was blocked by its own rule.** Joining checked for an existing membership document first, but reading one required already being a member. The rule now lets anyone read *their own* membership document.
4. **Photos stretched.** `aspect-ratio` was on the container; a tall photo's automatic minimum size overrode it. Moved the ratio onto the image itself (plant cards, hero, gallery).
5. **Chart labels clipped and distorted.** `preserveAspectRatio="none"` stretched the text, and `text-anchor` flipped under RTL. The chart now scales uniformly and draws in a fixed LTR coordinate space that it mirrors itself.
6. **Hebrew names right-aligned inside the English UI.** `dir="auto"` on the block changed its alignment as well as its character order. The `<Bidi>` wrapper now keeps the interface direction and isolates only the inner run.
7. **App bar and badges overflowed at 360 px.**
8. **"1 results" / "1 photos" / duplicate "Stage" label**, and an open-issue badge that read "Open issues".
9. **Black letterbox bands baked into all 23 prototype photos.** Detected and cropped out of the seed set — this was in your original data, not the CSS.
10. **Hot reload crashed the dev server** with "initializeFirestore has already been called". Guarded.

Also added while here: a top-level error boundary, so a render error costs one reload instead of a white screen.

---

## Not verified — needs you

1. **Google sign-in end to end.** The button is wired (popup, with an automatic redirect fallback for in-app browsers and pop-up blockers) and I watched it reach the IdP handshake against the Auth emulator, but an OAuth popup cannot complete its callback inside the automated browser. **Please click "Continue with Google" once yourself.**
2. **Service worker / installability.** All the pieces are correct — `sw.js` and `manifest.webmanifest` serve with the right MIME types over a secure context, icons and scope are right — but the automated browser sandbox refuses to register any service worker, so I could not observe it running. **Verify on your phone after deploying: open the site, "Add to Home Screen", then turn on airplane mode and reopen it.**
3. **Storage on the real project.** Not created yet — a bucket probe returns 404, and `firebase deploy --only storage` refuses until it exists. Photos will fail to upload until you click "Get Started" at <https://console.firebase.google.com/project/myjungle-68907/storage> and I deploy `storage.rules`.
4. **Email/Password sign-in has been removed** at your request — Google is the only sign-in method, in the UI and in the console. The core workflows above were exercised through the email provider before it was removed; the data layer below the sign-in screen is identical either way.
5. **Multi-device sync in the wild.** Verified across two accounts and two jungles in one browser against a real Firestore backend; not yet across two physical devices.
6. **Long-horizon behaviour.** The learned watering window switches from your configured rule to this plant's own median after four observed intervals. I tested it with synthetic backdated history; it will show its real value after a couple of months of actual logging.

## Deployed to `myjungle-68907`

- ✅ Firestore database created (default)
- ✅ `firestore.rules` deployed
- ✅ Billing linked (Blaze) — required before a Storage bucket can exist
- ✅ Budget: **₪4/month** (~$1, the billing account is in ILS), scoped to this
  project, alerting at 50% / 90% / 100%. Note that a Google budget *alerts*; it
  does not hard-stop spending.
- ✅ Cloud Storage default bucket `myjungle-68907.firebasestorage.app` created in
  **europe-west1**, matching the Firestore region
- ✅ `storage.rules` deployed — verified: an unauthenticated request to the bucket
  returns **403** (it returned 404 before the bucket existed)
- ✅ Source pushed to <https://github.com/RotemBar18/MyJungle> — verified from the
  public internet that `.env` and `public/seed/*.jpg` are **not** there (both 404)
- ✅ Hosting deployed — <https://myjungle-68907.web.app>. Verified live: index, `sw.js`
  and `manifest.webmanifest` all serve with correct MIME types, deep routes fall back
  to index.html, and the site loads with a clean console against the real project.
- ✅ `myjungle-68907.web.app` is already in Firebase Auth's authorised domains, so
  Google sign-in will work from the live URL with no extra configuration.

## Storage: what is and is not verified

The bucket exists, is in the right region, and its rules are live and denying
anonymous access. What has **not** been exercised against the real project is an
actual signed-in upload, because that needs a completed Google sign-in, which the
automated browser cannot do. The identical upload path was exercised end to end
against the Storage emulator with these same rules (test 19: 135 KB → 21 KB, stored
and rendered). First real photo you add will confirm it.
