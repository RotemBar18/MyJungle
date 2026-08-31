/**
 * Locale-aware formatting.
 *
 * Storage is always metric and always ISO: lengths in cm, volumes in ml, dates
 * as ISO-8601 strings. Conversion happens at render time only, so changing
 * language or unit system never rewrites a single record.
 */

const LOCALES = { he: 'he-IL', en: 'en-GB' };
export const localeOf = (lang) => LOCALES[lang] || 'en-GB';

const cache = new Map();
function memo(key, make) {
  if (!cache.has(key)) cache.set(key, make());
  return cache.get(key);
}

export const dtf = (locale, opts) =>
  memo(`d:${locale}:${JSON.stringify(opts)}`, () => new Intl.DateTimeFormat(locale, opts));
export const nf = (locale, opts) =>
  memo(`n:${locale}:${JSON.stringify(opts)}`, () => new Intl.NumberFormat(locale, opts));

export const toDate = (v) => {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  if (typeof v === 'object' && typeof v.toDate === 'function') return v.toDate(); // Firestore Timestamp
  const d = new Date(v);
  return isNaN(d) ? null : d;
};

export const fmtDate = (v, locale, opts = { day: 'numeric', month: 'short', year: 'numeric' }) => {
  const d = toDate(v);
  return d ? dtf(locale, opts).format(d) : '';
};

export const fmtDateShort = (v, locale) => fmtDate(v, locale, { day: 'numeric', month: 'short' });

export const fmtTime = (v, locale) =>
  toDate(v) ? dtf(locale, { hour: '2-digit', minute: '2-digit' }).format(toDate(v)) : '';

export const fmtDateTime = (v, locale) => {
  const d = toDate(v);
  if (!d) return '';
  return `${fmtDate(d, locale)} · ${fmtTime(d, locale)}`;
};

export const fmtMonth = (v, locale) => fmtDate(v, locale, { month: 'long', year: 'numeric' });

export const fmtNumber = (n, locale, digits = 1) => {
  if (n == null || Number.isNaN(n)) return '';
  return nf(locale, { maximumFractionDigits: digits }).format(n);
};

const DAY = 86400000;

/** Whole days between two instants (calendar-day based, so "yesterday" is always 1). */
export function daysBetween(a, b = new Date()) {
  const da = toDate(a);
  const dbb = toDate(b);
  if (!da || !dbb) return null;
  const utc = (d) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  return Math.round((utc(dbb) - utc(da)) / DAY);
}

export const startOfDay = (d = new Date()) => {
  const x = toDate(d) || new Date();
  return new Date(x.getFullYear(), x.getMonth(), x.getDate());
};

/** ISO date string (yyyy-mm-dd) in local time — what <input type="date"> wants. */
export function isoDate(d = new Date()) {
  const x = toDate(d) || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${x.getFullYear()}-${p(x.getMonth() + 1)}-${p(x.getDate())}`;
}

/** Local time string (HH:mm) — what <input type="time"> wants. */
export function isoTime(d = new Date()) {
  const x = toDate(d) || new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${p(x.getHours())}:${p(x.getMinutes())}`;
}

/** Combine the date + time inputs of a form into a real instant. */
export function combineDateTime(dateStr, timeStr) {
  if (!dateStr) return new Date();
  const [y, m, d] = dateStr.split('-').map(Number);
  const [hh, mm] = (timeStr || '12:00').split(':').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, hh || 0, mm || 0);
}

/** "3 days ago" / "in 2 days", using the platform's own relative formatter. */
export function relTime(v, locale) {
  const d = toDate(v);
  if (!d) return '';
  const days = daysBetween(d);
  const rtf = memo(`r:${locale}`, () => new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }));
  if (Math.abs(days) < 31) return rtf.format(-days, 'day');
  if (Math.abs(days) < 365) return rtf.format(-Math.round(days / 30), 'month');
  return rtf.format(-Math.round(days / 365), 'year');
}

// ---------------------------------------------------------------- units

const CM_PER_IN = 2.54;
const ML_PER_OZ = 29.5735;

export function length(cm, units, locale, t) {
  if (cm == null || cm === '') return '';
  if (units === 'imperial') return `${fmtNumber(cm / CM_PER_IN, locale, 1)} ${t('units.in')}`;
  return `${fmtNumber(cm, locale, 1)} ${t('units.cm')}`;
}

export function volume(ml, units, locale, t) {
  if (ml == null || ml === '') return '';
  if (units === 'imperial') return `${fmtNumber(ml / ML_PER_OZ, locale, 1)} ${t('units.ozfl')}`;
  return `${fmtNumber(ml, locale, 0)} ${t('units.ml')}`;
}

/** Input helpers: what the user types is in their unit, storage stays metric. */
export const toStoredLength = (v, units) =>
  v === '' || v == null ? null : Number(v) * (units === 'imperial' ? CM_PER_IN : 1);
export const fromStoredLength = (cm, units) =>
  cm == null ? '' : Math.round((units === 'imperial' ? cm / CM_PER_IN : cm) * 10) / 10;
export const toStoredVolume = (v, units) =>
  v === '' || v == null ? null : Number(v) * (units === 'imperial' ? ML_PER_OZ : 1);
export const fromStoredVolume = (ml, units) =>
  ml == null ? '' : Math.round((units === 'imperial' ? ml / ML_PER_OZ : ml) * 10) / 10;

export const lengthUnitKey = (units) => (units === 'imperial' ? 'units.in' : 'units.cm');
export const volumeUnitKey = (units) => (units === 'imperial' ? 'units.ozfl' : 'units.ml');

/**
 * Wrap a run of text that may be in the opposite direction (Latin species names,
 * product names, URLs) so it cannot reorder the surrounding sentence.
 * Used as a `dir="auto"` hint on spans; see `<Bidi>` in components.
 */
export const hasLatin = (s = '') => /[A-Za-z]/.test(s);
export const hasHebrew = (s = '') => /[֐-׿]/.test(s);
