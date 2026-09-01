import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getAuth,
  connectAuthEmulator,
  browserLocalPersistence,
  setPersistence,
  GoogleAuthProvider,
} from 'firebase/auth';
import {
  getFirestore,
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  connectFirestoreEmulator,
} from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import committed from './firebase.config.js';

const env = import.meta.env;
export const USE_EMULATORS = env.VITE_USE_EMULATORS === 'true';

// The committed config is the default so that any deploy target — Vercel,
// Firebase Hosting, a fork on someone's laptop — builds and runs with no setup.
// Environment variables still win where they are set, which is how the emulators
// and a fork pointed at a different project are handled.
const config = {
  apiKey: env.VITE_FB_API_KEY || committed.apiKey,
  authDomain: env.VITE_FB_AUTH_DOMAIN || committed.authDomain,
  projectId: env.VITE_FB_PROJECT_ID || committed.projectId,
  storageBucket: env.VITE_FB_STORAGE_BUCKET || committed.storageBucket,
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID || committed.messagingSenderId,
  appId: env.VITE_FB_APP_ID || committed.appId,
};

/** True once there is a project to talk to — which, by default, there always is. */
export const FIREBASE_CONFIGURED = Boolean(config.projectId) || USE_EMULATORS;

const hadApp = getApps().length > 0;
export const app = hadApp ? getApp() : initializeApp(config);

// Offline-first: Firestore keeps a full IndexedDB mirror of everything this user
// reads/writes, replays queued writes on reconnect, and shares one cache between
// tabs. The guard keeps Vite's hot reload from re-initialising an existing app.
export const db = hadApp
  ? getFirestore(app)
  : initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    });

export const auth = getAuth(app);
export const storage = getStorage(app);

if (USE_EMULATORS && !hadApp) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
  connectFirestoreEmulator(db, '127.0.0.1', 8080);
  connectStorageEmulator(storage, '127.0.0.1', 9199);
}

if (import.meta.env.DEV) {
  console.info(`[myJungle] project: ${config.projectId}${USE_EMULATORS ? ' (emulators)' : ''}`);
}

// Keep the session across app restarts (PWA relaunch, browser close).
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dev-only console handle — useful for poking at the SDK (e.g. disableNetwork()
// to rehearse offline behaviour). Stripped from production builds.
if (import.meta.env.DEV) window.__myJungle = { app, db, auth, storage };
