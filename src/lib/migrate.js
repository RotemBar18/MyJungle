import { doc, getDoc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { emptyPlant } from '../data/model.js';
import { toDate } from './format.js';

/**
 * One-time import of the original single-file `plant_tracker.html` prototype.
 *
 * Idempotency is structural rather than flag-based: every imported record gets
 * a deterministic id derived from its legacy id, so running the import a second
 * time overwrites the same documents instead of cloning the collection. The
 * `migration` marker on the user document is only used to tell the user it has
 * already happened.
 */

const LEGACY_KEY = 'plantTracker_v1';
const pid = (legacyId) => `legacy-${legacyId}`;
const eid = (legacyId, kind, i, date) => `legacy-${legacyId}-${kind}${i}-${String(date || '').slice(0, 10)}`;

/* ------------------------------------------------------------------ sources */

/** Anything the old app left in this browser's localStorage. */
export function readLocalStorageSource() {
  try {
    const raw = localStorage.getItem(LEGACY_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed?.plants) && parsed.plants.length ? parsed.plants : null;
  } catch {
    return null;
  }
}

/** A JSON export from the old app, or the prototype .html file itself. */
export async function readFileSource(file) {
  const text = await file.text();
  try {
    const parsed = JSON.parse(text);
    if (Array.isArray(parsed?.plants)) return parsed.plants;
    if (Array.isArray(parsed)) return parsed;
  } catch {
    /* not JSON — fall through to the HTML parser */
  }
  const m = text.match(/const\s+INITIAL\s*=\s*(\[[\s\S]*?\]);/);
  if (m) {
    try {
      return JSON.parse(m[1]);
    } catch {
      return null;
    }
  }
  return null;
}

/** The 23 plants shipped with the app, extracted from the prototype. */
export async function readBundledSource() {
  const base = import.meta.env.BASE_URL || '/';
  const res = await fetch(`${base}seed/plants.json`);
  if (!res.ok) return null;
  return res.json();
}

/* -------------------------------------------------------------- conversion */

const LIGHT_MAP = [
  [/שמש\s*ישיר|הרבה אור/, 'directSun'],
  [/בהיר מאוד/, 'bright'],
  [/בהיר עקיף|בהיר, עקיף/, 'brightIndirect'],
  [/בינוני/, 'medium'],
  [/חלש|מעט אור/, 'low'],
];

const lightOf = (text = '') => LIGHT_MAP.find(([re]) => re.test(text))?.[1] || 'brightIndirect';

function dryRuleOf(legacy) {
  const c = legacy.check || '';
  if (/יבש לחלוטין|ייבוש מלא/.test(c)) return 'full';
  if (/רוב המצע|כמעט מלא|ייבוש משמעותי/.test(c)) return 'mostly';
  if (/4[–-]6|4-6/.test(c)) return 'top5';
  if (/3[–-]5|3-5/.test(c)) return 'top3';
  if (/לחות עקבית|לחות קלה|לא לתת להתייבש/.test(c)) return 'evenMoist';
  const min = legacy.waterMinDays || 7;
  if (min >= 15) return 'full';
  if (min >= 10) return 'mostly';
  if (min >= 6) return 'top3';
  return 'evenMoist';
}

function metricsOf(legacy, isCutting) {
  if (isCutting) return ['rootLength', 'leaves'];
  if (/קקטוס|סוקולנט|Cact|Crassula|Sedum|Aeonium|Gasteria|Mammillaria/i.test(
      `${legacy.category} ${legacy.scientific}`,
    ))
    return ['height', 'width', 'pups'];
  return ['height', 'leaves', 'newGrowth'];
}

export function convertPlant(legacy) {
  const isCutting = legacy.mode === 'water' || /ייחור/.test(legacy.category || '');
  const light = lightOf(legacy.light);
  // The original free-text light description does not always map onto an enum;
  // keep the exact words rather than losing them.
  const keptLight = legacy.light && light === 'brightIndirect' && !/בהיר עקיף/.test(legacy.light)
    ? `${legacy.light}\n`
    : '';

  return {
    ...emptyPlant(),
    name: legacy.name || 'ללא שם',
    species: legacy.scientific || '',
    kind: isCutting ? 'cutting' : 'plant',
    medium: legacy.mode === 'water' ? 'water' : 'soil',
    light,
    care: {
      dryRule: dryRuleOf(legacy),
      checkMinDays: legacy.waterMinDays || 7,
      checkMaxDays: legacy.waterMaxDays || 14,
      checkNote: legacy.check || '',
      fertilizeEveryDays: null,
    },
    metrics: metricsOf(legacy, isCutting),
    tags: legacy.category ? [legacy.category] : [],
    notes: `${keptLight}${legacy.notes || ''}`.trim(),
    propagation: isCutting ? { method: 'water', startedAt: null, outcome: 'inProgress' } : null,
    status: 'active',
    createdAt: toDate(legacy.created) || new Date(),
    importedFrom: { app: 'plant_tracker.html', legacyId: legacy.id },
  };
}

function convertEvents(legacy, plantId) {
  const out = [];
  const isWater = legacy.mode === 'water';

  (legacy.watering || []).forEach((w, i) => {
    if (!w?.date) return;
    out.push({
      id: eid(legacy.id, 'w', i, w.date),
      plantId,
      type: isWater ? 'waterChange' : 'water',
      at: new Date(`${w.date}T12:00:00`),
      data: {
        ...(w.amount != null && w.amount !== '' ? (isWater ? { percent: Number(w.amount) } : { amountMl: Number(w.amount) }) : {}),
        ...(w.soil ? { soil: legacySoil(w.soil) } : {}),
      },
      note: [w.condition, w.notes].filter(Boolean).join(' · '),
      photos: [],
      ref: null,
      createdAt: new Date(`${w.date}T12:00:00`),
    });
  });

  (legacy.growth || []).forEach((g, i) => {
    if (!g?.date) return;
    const values = {};
    if (g.height != null) values.height = Number(g.height);
    if (g.leaves != null) values.leaves = Number(g.leaves);
    if (g.newLeaves != null) values.newGrowth = Number(g.newLeaves);
    out.push({
      id: eid(legacy.id, 'g', i, g.date),
      plantId,
      type: 'growth',
      at: new Date(`${g.date}T12:00:00`),
      data: { values },
      note: [g.condition, g.event, g.notes].filter(Boolean).join(' · '),
      photos: [],
      ref: null,
      createdAt: new Date(`${g.date}T12:00:00`),
    });
  });

  return out;
}

const SOIL_MAP = {
  'יבש לחלוטין': 'dry',
  'יבש ברובו': 'mostlyDry',
  'יבש בשכבה העליונה': 'topDry',
  'מעט לח': 'slightlyMoist',
  'לח מאוד': 'wet',
};
const legacySoil = (s) => SOIL_MAP[s] || undefined;

/* ------------------------------------------------------------------- runner */

export async function migrationStatus(jungleId) {
  const snap = await getDoc(doc(db, 'jungles', jungleId));
  return snap.exists() ? snap.data()?.migration || null : null;
}

/**
 * @param uploadPhoto  (plantId, blob) => {url, path}
 * @param existingIds  ids already in the jungle, so a re-run reports honestly
 */
export async function runMigration({ jungleId, legacyPlants, uploadPhoto, existingPlants, onProgress, source }) {
  const existing = new Map(existingPlants.map((p) => [p.id, p]));
  let added = 0;
  let updated = 0;
  let skipped = 0;
  const total = legacyPlants.length;

  for (let i = 0; i < total; i++) {
    const legacy = legacyPlants[i];
    const id = pid(legacy.id || `i${i}`);
    const prior = existing.get(id);
    onProgress?.(i, total);

    const plant = convertPlant(legacy);

    // Keep whatever the user has already changed since a previous import.
    if (prior) {
      plant.name = prior.name;
      plant.notes = prior.notes;
      plant.room = prior.room;
      plant.location = prior.location;
      plant.tags = prior.tags;
      plant.status = prior.status;
      plant.favorite = prior.favorite;
      plant.metrics = prior.metrics;
      plant.care = prior.care;
      plant.createdAt = toDate(prior.createdAt) || plant.createdAt;
    }

    // Photo: only upload when this plant does not have one yet, so a second run
    // does not fill Storage with copies.
    let photo = prior?.photo || null;
    if (!photo) {
      const blob = await legacyPhotoBlob(legacy);
      if (blob) {
        try {
          photo = await uploadPhoto(id, blob);
        } catch (err) {
          console.warn('photo upload failed for', id, err);
        }
      }
    }
    plant.photo = photo;

    const events = convertEvents(legacy, id);
    const batch = writeBatch(db);
    batch.set(doc(db, 'jungles', jungleId, 'plants', id), { ...plant, updatedAt: new Date() }, { merge: true });
    for (const e of events) {
      const { id: evId, ...rest } = e;
      batch.set(doc(db, 'jungles', jungleId, 'events', evId), rest, { merge: true });
    }
    await batch.commit();

    if (prior) {
      if (events.length) updated++;
      else skipped++;
    } else added++;
  }

  onProgress?.(total, total);
  const batch = writeBatch(db);
  batch.set(
    doc(db, 'jungles', jungleId),
    { migration: { done: true, at: new Date(), source: source || 'bundled', count: total } },
    { merge: true },
  );
  await batch.commit();

  return { added, updated, skipped, total };
}

async function legacyPhotoBlob(legacy) {
  const src = legacy.image || legacy.photo;
  if (!src) return null;
  try {
    if (src.startsWith('data:')) return await (await fetch(src)).blob();
    const base = import.meta.env.BASE_URL || '/';
    const url = src.startsWith('http') ? src : `${base}${src.replace(/^\//, '')}`;
    const res = await fetch(url);
    return res.ok ? await res.blob() : null;
  } catch {
    return null;
  }
}
