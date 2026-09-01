# myJungle 🌿

A personal plant journal: every plant, cutting and pot in your home, with its full
history — watering, growth, health, repotting, propagation and photos — in one place.
Hebrew and English, RTL and LTR, works offline, installs to your phone's home screen.

Built from the original `plant_tracker.html` prototype.

---

## What you need to do (about 10 minutes)

Everything below is in the Firebase console — the code needs no changes.

### 1. Create a Firebase project

1. <https://console.firebase.google.com> → **Add project** → name it (e.g. `myjungle`).
   Google Analytics is not needed.
2. In the project, click the **Web** icon (`</>`) to register a web app.
   Copy the `firebaseConfig` values it shows you.

### 2. Turn on the three services

| Service | Where | What to do |
|---|---|---|
| **Authentication** | Build → Authentication → Get started | Enable **Google** (pick a support email). This is the only sign-in method the app offers. |
| **Firestore** | Build → Firestore Database → Create database | Start in **production mode**, pick a region near you (`europe-west1` is a good default for Israel) |
| **Storage** | Build → **Storage** → Get started | This is *Cloud Storage*, not *Realtime Database* — a different item in the same sidebar. New projects need the Blaze plan for it (see README note below). Pick the same region as Firestore. |

### 3. Point the app at your project

```bash
cp .env.example .env
```

Fill `.env` with the values from step 1:

```
VITE_FB_API_KEY=AIza...
VITE_FB_AUTH_DOMAIN=myjungle-xxxx.firebaseapp.com
VITE_FB_PROJECT_ID=myjungle-xxxx
VITE_FB_STORAGE_BUCKET=myjungle-xxxx.firebasestorage.app
VITE_FB_MESSAGING_SENDER_ID=1234567890
VITE_FB_APP_ID=1:1234:web:abcd
VITE_USE_EMULATORS=false
```

`.env` is git-ignored. These keys are *not* secrets — they identify the project;
what protects your data is the security rules in step 4.

### 4. Deploy the rules (important — do this before you add real data)

```bash
npm install -g firebase-tools
firebase login
```

Put your project id in `.firebaserc` (replace `your-project`), then:

```bash
firebase deploy --only firestore:rules,storage
```

Until these are deployed, Firestore's default rules apply and the app will not work
(production mode denies everything).

### 5. Run it

```bash
npm install
npm run dev
```

Open <http://localhost:5173> and sign in with Google. Add your first plant with
the **+** button.

### 6. Put it online

```bash
firebase deploy
```

That builds and publishes to Firebase Hosting (`https://<project>.web.app`).
On your phone, open that URL and use **Add to Home Screen** — it then behaves like
an installed app, including offline.

If you use Google sign-in on a custom domain, add that domain under
**Authentication → Settings → Authorized domains**.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Dev server at <http://localhost:5173> |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run deploy` | Build + `firebase deploy` |
| `firebase emulators:start` | Local Firebase (auth, Firestore, Storage) — set `VITE_USE_EMULATORS=true` to use it |

---

## Project layout

```
myJungle/
├── index.html                 app shell
├── firebase.json              hosting, rules and emulator config
├── firestore.rules            who can read/write which document
├── firestore.indexes.json     (empty — no composite index is needed, see ARCHITECTURE.md)
├── storage.rules              who can read/write which photo
├── .env.example               the keys to copy into .env
├── public/
│   └── icon-*.png             home-screen icons
└── src/
    ├── main.jsx               entry point
    ├── App.jsx                routes + app shell (tab bar, offline pill)
    ├── firebase.js            SDK setup, offline cache, emulator wiring
    ├── styles.css             the whole design system (one file, logical properties)
    ├── i18n/
    │   ├── index.jsx          language + direction + unit context
    │   ├── he.js  en.js       every interface string
    ├── data/
    │   ├── model.js           what a plant and an event are
    │   ├── jungle.js          jungles, membership, invitations
    │   └── store.jsx          live Firestore subscriptions + every write
    ├── lib/
    │   ├── domain.js          the vocabulary (event types, mediums, metrics…)
    │   ├── stats.js           per-plant history → status, intervals, issues
    │   ├── insights.js        evidence-based personal insights
    │   ├── format.js          dates, numbers, units, bidi helpers
    │   └── image.js           photo resizing before upload
    ├── components/            sheets, forms, cards, chart, timeline pieces
    └── screens/               Home, Jungle, PlantDetail, PlantForm, Insights,
                               Settings, Auth, Join
```

---

## Sharing a jungle

A **jungle** is a collection with its own plants, history and people. You can have
more than one (home, the balcony, a parent's place) and switch with the chip in the
top bar.

To let a housemate or family member in:
**Settings → Jungles → Create an invite link → Share**.
Whoever opens the link and signs in joins that jungle and can log care for every
plant in it. The link expires after 14 days and you can revoke it at any time.
The owner can remove a member; a member can leave. Everything a person logged stays
in the history either way.

---

## Your data

- **Deleting** — plants are archived by default (hidden, history kept). Real deletion
  asks you to type `DELETE` and warns if the plant is the mother of any cuttings.
- **Photos** live in your project's Storage bucket, readable only by members of the
  jungle they belong to.


---

## A note on Cloud Storage and billing

Photos are the one part of myJungle that needs **Cloud Storage** — the sidebar item
called *Storage*, not *Realtime Database* and not *Firestore*. All three are separate
products:

| Product | What it is | Does myJungle use it? |
|---|---|---|
| **Firestore Database** | documents — plants, events, members | ✅ yes |
| **Cloud Storage** | files — your photos | ✅ yes |
| **Realtime Database** | an older JSON-tree database | ❌ no — safe to ignore or delete |

Since late 2024 Firebase requires the **Blaze (pay-as-you-go) plan** to create the
Cloud Storage bucket on a new project. Blaze still includes the same free monthly
allowance — for one person's plant photos (a few hundred images of ~200 KB) the bill
is realistically **$0** — but it does need a payment method on the account.

Everything except photo upload works without it: plants, watering, growth, health,
timeline, sharing and offline. Photo uploads report a clear failure rather than
breaking the record.
