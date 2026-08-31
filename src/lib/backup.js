import { doc, writeBatch } from 'firebase/firestore';
import { db } from '../firebase.js';
import { toDate, isoDate } from './format.js';

export const BACKUP_FORMAT = 'myjungle-backup';
export const BACKUP_VERSION = 1;

/** Dates become ISO strings so the file is readable and portable. */
function plain(obj) {
  if (Array.isArray(obj)) return obj.map(plain);
  if (obj && typeof obj === 'object') {
    if (typeof obj.toDate === 'function') return obj.toDate().toISOString();
    if (obj instanceof Date) return obj.toISOString();
    return Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, plain(v)]));
  }
  return obj;
}

export async function buildBackup(store) {
  const { plants, events } = await store.readAll();
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    counts: { plants: plants.length, events: events.length },
    plants: plain(plants),
    events: plain(events),
  };
}

export function downloadJson(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const backupFilename = () => `myjungle-backup-${isoDate()}.json`;

/**
 * Restore. Documents keep their original ids, so restoring the same file twice
 * updates the same records instead of creating a second copy of the jungle.
 * Photo URLs are preserved as-is — the images still live in Storage.
 */
export async function restoreBackup(jungleId, data, onProgress) {
  if (!data || data.format !== BACKUP_FORMAT || !Array.isArray(data.plants))
    throw new Error('bad-format');

  const plants = data.plants;
  const events = Array.isArray(data.events) ? data.events : [];
  const total = plants.length + events.length;
  let done = 0;

  const write = async (items, colName, transform) => {
    for (let i = 0; i < items.length; i += 300) {
      const batch = writeBatch(db);
      for (const item of items.slice(i, i + 300)) {
        const { id, ...rest } = item;
        if (!id) continue;
        batch.set(doc(db, 'jungles', jungleId, colName, id), transform(rest), { merge: true });
      }
      await batch.commit();
      done = Math.min(total, done + 300);
      onProgress?.(done, total);
    }
  };

  await write(plants, 'plants', (p) => ({
    ...p,
    createdAt: toDate(p.createdAt) || new Date(),
    updatedAt: new Date(),
  }));
  await write(events, 'events', (e) => ({
    ...e,
    at: toDate(e.at) || new Date(),
    createdAt: toDate(e.createdAt) || new Date(),
  }));

  return { plants: plants.length, events: events.length };
}
