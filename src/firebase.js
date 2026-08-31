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

const env = import.meta.env;
export const USE_EMULATORS = env.VITE_USE_EMULATORS === 'true';

const config = {
  apiKey: env.VITE_FB_API_KEY || 'demo-key',
  authDomain: env.VITE_FB_AUTH_DOMAIN || 'localhost',
  projectId: env.VITE_FB_PROJECT_ID || 'demo-myjungle',
  storageBucket: env.VITE_FB_STORAGE_BUCKET || 'demo-myjungle.appspot.com',
  messagingSenderId: env.VITE_FB_MESSAGING_SENDER_ID || '0',
  appId: env.VITE_FB_APP_ID || 'demo',
};

/** True when the app has not been pointed at a real Firebase project yet. */
export const FIREBASE_CONFIGURED = Boolean(env.VITE_FB_PROJECT_ID) || USE_EMULATORS;

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

// Keep the session across app restarts (PWA relaunch, browser close).
setPersistence(auth, browserLocalPersistence).catch(() => {});

export const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Dev-only console handle — useful for poking at the SDK (e.g. disableNetwork()
// to rehearse offline behaviour). Stripped from production builds.
if (import.meta.env.DEV) window.__myJungle = { app, db, auth, storage };
