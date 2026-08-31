# myJungle — the decisions behind it

Short notes on why the product is built the way it is. Written for the person who
will open this code in two years and wonder.

---

## 1. The one idea everything rests on

**A plant document says what the plant *is*. An event document says what *happened*.**

```
jungles/{jid}/plants/{plantId}     current profile — name, pot, room, care rule
jungles/{jid}/events/{eventId}     append-only history — one document per thing that happened
```

Editing a plant writes only to the plant document, so it is structurally impossible
for "fix a typo in the name" to touch a watering from last March. Every kind of
record you asked for — watering, growth, fertilizing, repotting, health issues,
propagation milestones, pests, moves, notes — is an event with a `type` and a
type-specific `data` payload. The timeline is simply the events sorted by date; the
watering history is `type in (water, waterChange)`; the growth chart is
`type == growth`.

One collection instead of six subcollections is a deliberate simplification. It
means a single live subscription, no fan-out reads, one export format, one security
rule, and offline replay that cannot get half-applied. A home jungle produces a few
thousand events over many years — comfortably one subscription. The cap is
`EVENT_LIMIT = 5000` in `src/data/store.jsx`; pagination goes there if it is ever hit.

**A cutting is a plant.** It is not a sub-record of its mother — it is its own
document with `kind: 'cutting'` and `parentId` pointing at the mother. That is why
you can have a mature plant, a hard-pruned one and five cuttings of the same species
each with their own profile and history, and why the lineage view is free: children
are the plants whose `parentId` is this one. A cutting that establishes is *promoted*
in place (`kind: 'plant'`), keeping its whole propagation story.

## 2. Jungles and sharing

```
jungles/{jid}                    name, ownerUid
jungles/{jid}/members/{uid}      role + who they are   ← the authority on access
invites/{code}                   jungleId + jungleName, doc id *is* the invite code
users/{uid}                      prefs, lastJungleId, jungles: { jid: {name, role} }
```

The membership subcollection is the single source of truth. Every rule for plants,
events and photos asks the same question: *does `jungles/{jid}/members/{me}` exist?*
The list of jungles on the user document is only a convenience index so the app knows
what to offer without a collection-group query; entries it can no longer open are
ignored rather than trusted.

**Joining without a backend.** Firestore rules can read other documents, so a
non-member is allowed exactly one write: creating their *own* membership document,
and only while presenting a live invite code that names that jungle. The invite's
document id is the code itself, `get` is allowed to any signed-in user and `list` is
denied — so codes cannot be enumerated, only redeemed by someone who was given one.
No Cloud Function, no server.

One consequence worth knowing: creating a jungle is two sequential writes, not a
batch. The rule for the founder's membership document reads the jungle document, and
rules only see state that is already committed — inside a batch the jungle would not
exist yet.

## 3. Reminders that mean "check", not "water"

This is the part that makes the app worth opening. A plant has a check window
(`checkMinDays…checkMaxDays`) and a dryness rule (`dryRule`), and the home screen says
**"time for a soil check"**, never "water now".

- Until there are **four or more observed intervals**, the window is the rule you set
  (seeded per medium + dryness rule when the plant is created).
- After that, the window is derived from this plant's own median interval in your
  home (`0.8×` to `1.3×` the median). The UI states which of the two it used —
  "Based on 9 records" versus "Your rule for this plant" — so a reminder is never an
  unexplained number.
- Logging **"checked — still moist"** moves the clock forward without claiming the
  plant was watered, and shortens the next window to a "look again soon" one. Three
  such checks in a row surface a suggestion to lengthen the interval.

Nothing here averages across species or across users. `src/lib/stats.js`.

## 4. Insights that are allowed to say "not enough data"

`src/lib/insights.js` generates at most six cards, each with a hard evidence
threshold: a rhythm needs ≥4 intervals, a *change* in rhythm needs ≥6 plus a ≥25%
shift, a seasonal comparison needs ≥3 gaps in each season, a growth-after-move
comparison needs ≥2 measurements on each side of the move. Every card carries the
record count it was computed from. If the thresholds are not met the card is not
produced, and the screen says so plainly rather than inventing a pattern.

## 5. Offline

Firestore is initialised with `persistentLocalCache` + `persistentMultipleTabManager`,
so the whole jungle is mirrored in IndexedDB, reads are served locally first, and
writes are queued and replayed on reconnect.

The non-obvious part: **`setDoc` resolves on *server* acknowledgement, which never
comes while offline** — the write is applied to the local cache immediately, but
awaiting the promise would leave every save sheet spinning on the train. So writes
are issued local-first (`localFirst()` in `store.jsx`) and the UI moves on; a genuine
failure — a rejected rule, a bad payload — surfaces asynchronously as a toast.
Storage cleanup after a delete is fire-and-forget for the same reason: it needs the
network, the record does not.

Photo *uploads* do need the network. A photo is compressed locally first, and if the
upload fails the entry is still saved and the failure is reported rather than
swallowed.

## 6. Not creating duplicates

Three separate paths, three structural answers rather than flags:

- **Double-tapping Save** — each open form generates its document id once, so the
  second tap writes the same document again instead of creating a second one. A busy
  lock (`useSubmit`) also disables the button.
- **Re-running the import** — every imported record gets a deterministic id derived
  from its legacy id (`legacy-p06`, `legacy-p06-w3-2026-08-14`), so a second run
  overwrites the same documents. It also preserves anything you have since edited
  (name, room, notes, care rule) and skips re-uploading photos that are already there.
- **Restoring a backup twice** — documents keep their original ids, so a restore
  updates rather than clones.

## 7. RTL and LTR

Direction is not a stylesheet variant here. `styles.css` uses logical properties
throughout (`margin-inline`, `inset-inline-start`, `border-block-end`,
`text-align: start`) so one set of rules produces both layouts. The only
direction-aware code is a `.flip-rtl` class for genuinely directional icons (back
arrow, chevrons) and the growth chart, which mirrors its own x-axis so time reads
right-to-left in Hebrew.

Mixed-direction content is handled by the `<Bidi>` component: the wrapper keeps the
*interface* direction so text stays aligned with its card, while an inner
`dir="auto"` span decides only how the characters inside it are ordered. That is why
a Latin species name sits correctly inside a Hebrew sentence, and a Hebrew plant name
sits left-aligned but correctly ordered inside the English UI. Numbers, dates and
measurements are wrapped in `<Num>` (`direction: ltr; unicode-bidi: isolate`).

No interface string is written in a component. Everything is a key in `i18n/he.js`
and `i18n/en.js`, and the data layer never stores a translated word — a plant's light
level is `brightIndirect`, not "אור בהיר עקיף" — so switching language never rewrites
data and old records keep rendering correctly. Adding a third language is adding one
file.

Units follow the same rule: storage is always metric (cm, ml) and ISO dates;
conversion happens at render time, so switching to imperial never touches a record.

## 8. Why these tools

- **Vite + React** — the app has real state (live subscriptions, sheets, forms);
  hand-rolled DOM would have been worse, not lazier.
- **react-router-dom** — a hash router, so Firebase Hosting needs no special
  configuration and the phone's back button behaves.
- **vite-plugin-pwa** — one dependency for the service worker, manifest and offline
  shell. Worth it: this is a phone-first app you open standing at a windowsill.
- **No chart library.** The growth chart is ~70 lines of SVG. A library would have
  been a large dependency that mirrors badly in RTL.
- **No i18n library.** Two dictionaries and a `t()` that resolves a dotted key with
  `{n}` interpolation is ~40 lines and does everything needed.
- **No state library.** One context over Firestore's own live cache is the state
  layer; adding Redux on top of a database that already pushes updates is duplication.

## 9. Security, briefly

- Authorisation is enforced entirely in `firestore.rules` and `storage.rules`. The
  client's queries are scoped to the current jungle, but that is convenience — the
  rules are what makes another account's data unreachable. Verified by calling the
  REST API directly as a non-member (see `QA.md`).
- Storage rules read Firestore (`firestore.exists(...)`) so photos use the *same*
  membership documents as the data. There is no second, drifting permission model.
- Uploads are capped at 8 MB and must have an `image/*` content type.
- Plant and event writes are validated in the rules (name present and ≤200 chars,
  events must carry a `plantId`, a `type` and a real timestamp, notes ≤20 000 chars)
  so a broken client cannot write unreadable history.
- Firebase Storage download URLs contain an unguessable token, which is how the
  `<img>` tags work. Anyone given a URL can fetch that one image; the bucket itself
  stays closed. That is the standard trade-off for `getDownloadURL` and is
  appropriate here.
- The web API key in `.env` is an identifier, not a secret.
- No composite indexes are needed: the only ordered query is `events` by `at`, which
  Firestore indexes automatically. `firestore.indexes.json` is intentionally empty.
