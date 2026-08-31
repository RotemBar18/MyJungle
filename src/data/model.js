import { defaultInterval } from '../lib/domain.js';

/**
 * Shapes of the two documents myJungle stores.
 *
 * Rule that everything else depends on: a plant document holds *what the plant
 * is now*; an event document holds *something that happened*. Events are only
 * ever appended, so editing a plant can never rewrite its history.
 */

export const emptyPlant = (over = {}) => ({
  name: '',
  species: '',
  cultivar: '',
  kind: 'plant', // plant | cutting
  photo: null, // { url, path }
  acquiredAt: null,
  source: '',
  room: '',
  location: '',
  light: 'brightIndirect',
  windowDirection: 'none',
  medium: 'soil',
  pot: { type: '', material: '', sizeCm: null },
  substrate: '',
  drainage: 'good',
  care: {
    dryRule: 'top3',
    checkMinDays: 6,
    checkMaxDays: 12,
    checkNote: '',
    fertilizeEveryDays: null,
  },
  metrics: ['height', 'leaves'],
  parentId: null,
  propagation: null, // { method, startedAt, outcome }
  tags: [],
  notes: '',
  favorite: false,
  status: 'active', // active | archived | dead | gifted
  createdAt: null,
  updatedAt: null,
  ...over,
});

export const emptyEvent = (over = {}) => ({
  plantId: null,
  type: 'note',
  at: null, // Date — when it happened (not when it was typed)
  data: {}, // type-specific payload, always metric units
  note: '',
  photos: [], // [{ url, path, w, h }]
  ref: null, // id of the event this one updates (health issue thread)
  createdAt: null,
  ...over,
});

/** Fill in anything an older/imported record is missing, so the UI never sees undefined. */
export function normalizePlant(raw = {}, id) {
  const base = emptyPlant();
  const p = { ...base, ...raw, id: id ?? raw.id };
  p.pot = { ...base.pot, ...(raw.pot || {}) };
  p.care = { ...base.care, ...(raw.care || {}) };
  p.tags = Array.isArray(raw.tags) ? raw.tags : [];
  p.metrics = Array.isArray(raw.metrics) && raw.metrics.length ? raw.metrics : base.metrics;
  if (!p.care.checkMinDays || !p.care.checkMaxDays) {
    const [mn, mx] = defaultInterval(p.medium, p.care.dryRule);
    p.care.checkMinDays = p.care.checkMinDays || mn;
    p.care.checkMaxDays = p.care.checkMaxDays || mx;
  }
  if (p.care.checkMaxDays < p.care.checkMinDays) p.care.checkMaxDays = p.care.checkMinDays;
  return p;
}

export function normalizeEvent(raw = {}, id) {
  const e = { ...emptyEvent(), ...raw, id: id ?? raw.id };
  e.data = raw.data && typeof raw.data === 'object' ? raw.data : {};
  e.photos = Array.isArray(raw.photos) ? raw.photos : [];
  return e;
}

/** Cuttings in water/leca get their water changed; everything else gets watered. */
export const isWaterMedium = (plant) => plant?.medium === 'water' || plant?.medium === 'leca';
export const waterEventType = (plant) => (isWaterMedium(plant) ? 'waterChange' : 'water');

/** Short one-line subtitle for a plant card. */
export const plantSubtitle = (p) => p?.species || p?.cultivar || '';
