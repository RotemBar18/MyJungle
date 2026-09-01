import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from 'react';
import { onAuthStateChanged, signOut as fbSignOut } from 'firebase/auth';
import {
  doc,
  setDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  orderBy,
  query,
  limit,
  writeBatch,
  collection,
} from 'firebase/firestore';
import { ref as sref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { auth, db, storage } from '../firebase.js';
import { normalizePlant, normalizeEvent, emptyPlant } from './model.js';
import * as J from './jungle.js';
import { plantStats, attentionOf } from '../lib/stats.js';
import { toDate } from '../lib/format.js';
import { prepareImage } from '../lib/image.js';

// ponytail: one flat `events` collection per jungle instead of a subcollection
// per plant. A home jungle produces a few thousand events over years, which fits
// in one live subscription — and it keeps queries, rules, export and offline
// replay trivial. Paginate here if the cap below is ever reached.
const EVENT_LIMIT = 5000;

const LAST_JUNGLE_KEY = 'myjungle.lastJungle';

const StoreContext = createContext(null);

export function StoreProvider({ children }) {
  const [user, setUser] = useState(undefined); // undefined = still checking
  const [profile, setProfile] = useState(null);
  const [jungleId, setJungleId] = useState(() => localStorage.getItem(LAST_JUNGLE_KEY) || null);
  const [jungle, setJungle] = useState(null);
  const [members, setMembers] = useState([]);
  const [plants, setPlants] = useState([]);
  const [events, setEvents] = useState([]);
  const [loaded, setLoaded] = useState({ plants: false, events: false, profile: false });
  const [bootstrapping, setBootstrapping] = useState(false);
  const [online, setOnline] = useState(navigator.onLine);
  const [pending, setPending] = useState(0);
  const [accessError, setAccessError] = useState(null);
  const [writeError, setWriteError] = useState(null);

  useEffect(() => onAuthStateChanged(auth, (u) => setUser(u || null)), []);

  useEffect(() => {
    const on = () => setOnline(true);
    const off = () => setOnline(false);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => {
      window.removeEventListener('online', on);
      window.removeEventListener('offline', off);
    };
  }, []);

  // --------------------------------------------------------- user profile

  useEffect(() => {
    if (!user) {
      setProfile(null);
      setLoaded((l) => ({ ...l, profile: false }));
      // A different person may sign in next; never carry the previous
      // session's jungle into theirs.
      setJungleId(null);
      setAccessError(null);
      return;
    }
    return onSnapshot(J.userDoc(user.uid), (snap) => {
      setProfile(snap.exists() ? snap.data() : {});
      setLoaded((l) => ({ ...l, profile: true }));
    });
  }, [user]);

  const myJungles = useMemo(() => {
    const map = profile?.jungles || {};
    return Object.entries(map).map(([id, v]) => ({ id, name: v?.name || 'myJungle', role: v?.role || 'member' }));
  }, [profile]);

  // First run (or a fresh account): give the person a jungle to put plants in.
  useEffect(() => {
    if (!user || !loaded.profile || bootstrapping) return;
    if (myJungles.length === 0) {
      setBootstrapping(true);
      J.createJungle(user, 'myJungle')
        .then((jid) => selectJungle(jid))
        .catch((e) => setAccessError(e.message))
        .finally(() => setBootstrapping(false));
      return;
    }
    const known = myJungles.some((j) => j.id === jungleId);
    if (!known) {
      const next = profile?.lastJungleId && myJungles.some((j) => j.id === profile.lastJungleId)
        ? profile.lastJungleId
        : myJungles[0].id;
      setJungleId(next);
      localStorage.setItem(LAST_JUNGLE_KEY, next);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, loaded.profile, myJungles, jungleId]);

  const myJunglesRef = useRef([]);
  useEffect(() => {
    myJunglesRef.current = myJungles;
  }, [myJungles]);

  const selectJungle = useCallback(
    (jid) => {
      setJungleId(jid);
      setPlants([]);
      setEvents([]);
      setLoaded((l) => ({ ...l, plants: false, events: false }));
      localStorage.setItem(LAST_JUNGLE_KEY, jid);
      if (user) J.setLastJungle(user.uid, jid).catch(() => {});
    },
    [user],
  );

  // --------------------------------------------------------- jungle data
  // Firestore serves these from its IndexedDB cache first, so the app is fully
  // usable offline and reconciles when the socket comes back.

  useEffect(() => {
    if (!user || !jungleId) {
      setPlants([]);
      setEvents([]);
      setJungle(null);
      setMembers([]);
      return;
    }
    setAccessError(null);
    const onErr = (err) => {
      console.error(err);
      // A denial while the jungle is still absent from the profile index is
      // just a race during joining/creating; only a persistent one is real.
      if (err.code === 'permission-denied' && myJunglesRef.current.some((j) => j.id === jungleId)) {
        setAccessError('permission-denied');
      }
    };

    const unsubs = [
      onSnapshot(J.jungleDoc(jungleId), (snap) => setJungle(snap.exists() ? { id: snap.id, ...snap.data() } : null), onErr),
      onSnapshot(J.membersCol(jungleId), (snap) => setMembers(snap.docs.map((d) => ({ id: d.id, ...d.data() }))), onErr),
      onSnapshot(
        J.plantsCol(jungleId),
        (snap) => {
          setPlants(snap.docs.map((d) => normalizePlant(d.data(), d.id)));
          setLoaded((l) => ({ ...l, plants: true }));
        },
        onErr,
      ),
      onSnapshot(
        query(J.eventsCol(jungleId), orderBy('at', 'desc'), limit(EVENT_LIMIT)),
        (snap) => {
          setEvents(snap.docs.map((d) => normalizeEvent(d.data(), d.id)));
          setPending(snap.docs.filter((d) => d.metadata.hasPendingWrites).length);
          setLoaded((l) => ({ ...l, events: true }));
        },
        onErr,
      ),
    ];
    return () => unsubs.forEach((u) => u());
  }, [user, jungleId]);

  const ready =
    user === undefined
      ? false
      : !user
        ? true
        : loaded.profile && !!jungleId && loaded.plants && loaded.events;

  // ------------------------------------------------------------- derived

  const eventsByPlant = useMemo(() => {
    const m = new Map();
    for (const e of events) {
      if (!e.plantId) continue;
      if (!m.has(e.plantId)) m.set(e.plantId, []);
      m.get(e.plantId).push(e);
    }
    return m;
  }, [events]);

  const stats = useMemo(() => {
    const m = new Map();
    for (const p of plants) m.set(p.id, plantStats(p, eventsByPlant.get(p.id) || []));
    return m;
  }, [plants, eventsByPlant]);

  const attention = useMemo(() => {
    const m = new Map();
    for (const p of plants) {
      const a = attentionOf(p, stats.get(p.id));
      if (a) m.set(p.id, a);
    }
    return m;
  }, [plants, stats]);

  const childrenOf = useMemo(() => {
    const m = new Map();
    for (const p of plants) {
      if (!p.parentId) continue;
      if (!m.has(p.parentId)) m.set(p.parentId, []);
      m.get(p.parentId).push(p);
    }
    return m;
  }, [plants]);

  // ------------------------------------------------------------- writes

  const uid = user?.uid;
  const jid = jungleId;
  const newId = useCallback((kind) => doc(collection(db, 'jungles', jid || 'x', kind)).id, [jid]);

  // Firestore applies a write to its local cache immediately, but the promise it
  // returns only settles on server acknowledgement — which never comes while
  // offline. Waiting for it would leave every save sheet spinning on a train.
  // So writes are issued and the UI moves on; a genuine failure (a rejected
  // rule, a bad payload) surfaces asynchronously as a toast.
  const localFirst = useCallback((promise) => {
    promise?.catch?.((err) => {
      console.error(err);
      setWriteError(err);
    });
    return Promise.resolve();
  }, []);

  const savePlant = useCallback(
    async (id, patch) => {
      if (!uid || !jid) throw new Error('no jungle');
      const isNew = !plants.some((p) => p.id === id);
      // merge:true never removes fields the form did not touch — history-adjacent
      // profile data (parentId, propagation) survives a partial edit.
      await localFirst(
        setDoc(
          doc(J.plantsCol(jid), id),
          {
            ...patch,
            updatedAt: new Date(),
            updatedBy: uid,
            ...(isNew ? { createdAt: patch.createdAt || new Date(), createdBy: uid } : {}),
          },
          { merge: true },
        ),
      );
      return id;
    },
    [uid, jid, plants, localFirst],
  );

  const createPlant = useCallback(
    async (data, id) => {
      const pid = id || newId('plants');
      await savePlant(pid, { ...emptyPlant(), ...data });
      return pid;
    },
    [newId, savePlant],
  );

  const setPlantStatus = useCallback(
    (id, status) =>
      localFirst(updateDoc(doc(J.plantsCol(jid), id), { status, updatedAt: new Date(), updatedBy: uid })),
    [jid, uid, localFirst],
  );

  const toggleFavorite = useCallback(
    (p) => localFirst(updateDoc(doc(J.plantsCol(jid), p.id), { favorite: !p.favorite, updatedAt: new Date() })),
    [jid, localFirst],
  );

  /** Hard delete: the plant, all of its events, and all of its stored photos. */
  const deletePlant = useCallback(
    async (id) => {
      const mine = eventsByPlant.get(id) || [];
      const paths = [
        ...mine.flatMap((e) => (e.photos || []).map((p) => p.path)),
        plants.find((p) => p.id === id)?.photo?.path,
      ].filter(Boolean);

      // Firestore batches cap at 500 writes.
      for (let i = 0; i < mine.length; i += 400) {
        const batch = writeBatch(db);
        mine.slice(i, i + 400).forEach((e) => batch.delete(doc(J.eventsCol(jid), e.id)));
        await localFirst(batch.commit());
      }
      await localFirst(deleteDoc(doc(J.plantsCol(jid), id)));
      // Storage cleanup is best-effort and needs the network; a missed object
      // costs a few KB, so it is never allowed to hold up the delete.
      paths.forEach((p) => deleteObject(sref(storage, p)).catch(() => {}));
      // Cuttings keep pointing at a now-missing mother; the UI says so rather
      // than silently losing the lineage.
    },
    [jid, eventsByPlant, plants, localFirst],
  );

  const addEvent = useCallback(
    async (plantId, data, id) => {
      if (!uid || !jid) throw new Error('no jungle');
      const eid = id || newId('events');
      await localFirst(
        setDoc(doc(J.eventsCol(jid), eid), {
          plantId,
          type: 'note',
          note: '',
          photos: [],
          data: {},
          ref: null,
          ...data,
          at: toDate(data.at) || new Date(),
          createdAt: new Date(),
          createdBy: uid,
        }),
      );
      return eid;
    },
    [uid, jid, newId, localFirst],
  );

  const updateEvent = useCallback(
    (id, patch) => localFirst(updateDoc(doc(J.eventsCol(jid), id), { ...patch, editedAt: new Date() })),
    [jid, localFirst],
  );

  const deleteEvent = useCallback(
    async (id) => {
      const ev = events.find((e) => e.id === id);
      await localFirst(deleteDoc(doc(J.eventsCol(jid), id)));
      (ev?.photos || []).forEach((p) => p.path && deleteObject(sref(storage, p.path)).catch(() => {}));
    },
    [jid, events, localFirst],
  );

  /** Compress + upload one photo. Throws on failure so callers can offer a retry. */
  const uploadPhoto = useCallback(
    async (plantId, fileOrBlob, meta = {}) => {
      if (!jid) throw new Error('no jungle');
      let blob = fileOrBlob;
      let width = meta.width ?? null;
      let height = meta.height ?? null;
      if (fileOrBlob instanceof File) {
        const prepared = await prepareImage(fileOrBlob);
        blob = prepared.blob;
        width = prepared.width;
        height = prepared.height;
        URL.revokeObjectURL(prepared.preview);
      }
      const path = `jungles/${jid}/plants/${plantId}/${newId('photos')}.jpg`;
      const r = sref(storage, path);
      try {
        await uploadBytes(r, blob, { contentType: 'image/jpeg', cacheControl: 'public,max-age=31536000' });
        const url = await getDownloadURL(r);
        return { url, path, w: width, h: height };
      } catch (err) {
        // Photo failures used to surface as a generic "you are offline", which
        // is wrong for the two causes that actually happen: a bucket without
        // CORS for this origin, and rules that reject the write. Keep the real
        // code and message so the UI can say which.
        console.error('photo upload failed', { path, code: err?.code, message: err?.message }, err);
        const e = new Error(err?.message || 'upload failed');
        e.code = err?.code || 'storage/unknown';
        e.path = path;
        throw e;
      }
    },
    [jid, newId],
  );

  const saveProfile = useCallback(
    (patch) => setDoc(J.userDoc(uid), patch, { merge: true }),
    [uid],
  );

  const signOut = useCallback(async () => {
    localStorage.removeItem(LAST_JUNGLE_KEY);
    await fbSignOut(auth);
  }, []);

  const role = members.find((m) => m.id === uid)?.role || profile?.jungles?.[jid]?.role || 'member';

  const value = useMemo(
    () => ({
      user,
      uid,
      ready,
      online,
      pending,
      profile,
      accessError,
      writeError,
      clearWriteError: () => setWriteError(null),
      // jungles
      jungleId: jid,
      jungle,
      jungles: myJungles,
      members,
      role,
      isOwner: role === 'owner',
      selectJungle,
      createJungle: async (name) => {
        const id = await J.createJungle(user, name);
        selectJungle(id);
        return id;
      },
      renameJungle: (name) => J.renameJungle(jid, uid, name),
      createInvite: () => J.createInvite(jid, jungle?.name || 'myJungle', user),
      revokeInvite: J.revokeInvite,
      readInvite: J.readInvite,
      joinJungle: async (code) => {
        const res = await J.joinJungle(code, user);
        if (res.jungleId) selectJungle(res.jungleId);
        return res;
      },
      leaveJungle: async () => {
        await J.leaveJungle(jid, uid);
        const rest = myJungles.filter((x) => x.id !== jid);
        if (rest.length) selectJungle(rest[0].id);
        else setJungleId(null);
      },
      removeMember: (memberUid) => J.removeMember(jid, memberUid),
      // plants
      plants,
      events,
      stats,
      attention,
      eventsByPlant,
      childrenOf,
      plantById: (id) => plants.find((p) => p.id === id) || null,
      statsFor: (id) => stats.get(id) || plantStats(emptyPlant(), []),
      eventsFor: (id) => eventsByPlant.get(id) || [],
      childrenFor: (id) => childrenOf.get(id) || [],
      newId,
      createPlant,
      savePlant,
      setPlantStatus,
      toggleFavorite,
      deletePlant,
      addEvent,
      updateEvent,
      deleteEvent,
      uploadPhoto,
      saveProfile,
      signOut,
    }),
    [
      user, uid, ready, online, pending, profile, accessError, writeError, jid, jungle, myJungles, members, role,
      selectJungle, plants, events, stats, attention, eventsByPlant, childrenOf, newId,
      createPlant, savePlant, setPlantStatus, toggleFavorite, deletePlant, addEvent, updateEvent,
      deleteEvent, uploadPhoto, saveProfile, signOut,
    ],
  );

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
}

export function useStore() {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside <StoreProvider>');
  return ctx;
}

/** Guards a submit handler against double taps and reports failures once. */
export function useSubmit(fn, { onError } = {}) {
  const [busy, setBusy] = useState(false);
  const lock = useRef(false);
  const run = useCallback(
    async (...args) => {
      if (lock.current) return;
      lock.current = true;
      setBusy(true);
      try {
        return await fn(...args);
      } catch (err) {
        console.error(err);
        onError?.(err);
      } finally {
        lock.current = false;
        setBusy(false);
      }
    },
    [fn, onError],
  );
  return [run, busy];
}
