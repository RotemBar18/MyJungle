import { createContext, useContext, useMemo, useState, useEffect, useCallback } from 'react';
import he from './he.js';
import en from './en.js';
import * as F from '../lib/format.js';

const DICTS = { he, en };
export const LANGS = [
  { id: 'he', label: 'עברית', dir: 'rtl' },
  { id: 'en', label: 'English', dir: 'ltr' },
];
export const dirOf = (lang) => (lang === 'he' ? 'rtl' : 'ltr');

const PREF_KEY = 'myjungle.prefs';

export function loadPrefs() {
  try {
    const p = JSON.parse(localStorage.getItem(PREF_KEY) || '{}');
    return { lang: p.lang, units: p.units, theme: p.theme };
  } catch {
    return {};
  }
}
function savePrefs(p) {
  try {
    localStorage.setItem(PREF_KEY, JSON.stringify(p));
  } catch {
    /* private mode — prefs just won't persist */
  }
}

function detectLang() {
  const saved = loadPrefs().lang;
  if (saved && DICTS[saved]) return saved;
  return (navigator.languages || [navigator.language || 'en']).some((l) => /^he/i.test(l))
    ? 'he'
    : 'en';
}

/** Resolve a dotted key against a dictionary, falling back to English then the key itself. */
function resolve(dict, path) {
  let v = dict;
  for (const part of path.split('.')) {
    if (v == null) return undefined;
    v = v[part];
  }
  return typeof v === 'string' ? v : undefined;
}

const I18nContext = createContext(null);

export function I18nProvider({ children }) {
  const initial = loadPrefs();
  const [lang, setLangState] = useState(detectLang);
  const [units, setUnitsState] = useState(initial.units || 'metric');
  const [theme, setThemeState] = useState(initial.theme || 'system');

  const dir = dirOf(lang);
  const locale = F.localeOf(lang);

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = dir;
    root.dataset.theme = theme;
    savePrefs({ lang, units, theme });
  }, [lang, dir, units, theme]);

  const t = useCallback(
    (key, vars) => {
      let s = resolve(DICTS[lang], key) ?? resolve(en, key);
      if (s == null) {
        if (import.meta.env.DEV) console.warn('[i18n] missing key:', key);
        return key;
      }
      if (vars) {
        s = s.replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? String(vars[k]) : m));
      }
      return s;
    },
    [lang],
  );

  const value = useMemo(() => {
    /** "5 days" with correct singular/dual forms (Hebrew has a dual: יומיים). */
    const days = (n) => {
      const a = Math.abs(Math.round(n ?? 0));
      if (a === 0) return t('common.dayZero');
      if (a === 1) return t('common.dayOne');
      if (a === 2) return t('common.dayTwo');
      return t('common.days', { n: F.fmtNumber(a, locale, 0) });
    };
    return {
      lang,
      dir,
      locale,
      units,
      theme,
      t,
      days,
      setLang: (l) => DICTS[l] && setLangState(l),
      setUnits: (u) => setUnitsState(u === 'imperial' ? 'imperial' : 'metric'),
      setTheme: (x) => setThemeState(['light', 'dark', 'system'].includes(x) ? x : 'system'),
      // formatting bound to the current locale + unit system
      fmtDate: (v, opts) => F.fmtDate(v, locale, opts),
      fmtDateShort: (v) => F.fmtDateShort(v, locale),
      fmtTime: (v) => F.fmtTime(v, locale),
      fmtDateTime: (v) => F.fmtDateTime(v, locale),
      fmtMonth: (v) => F.fmtMonth(v, locale),
      fmtNumber: (v, d) => F.fmtNumber(v, locale, d),
      relTime: (v) => F.relTime(v, locale),
      length: (cm) => F.length(cm, units, locale, t),
      volume: (ml) => F.volume(ml, units, locale, t),
      lengthUnit: () => t(F.lengthUnitKey(units)),
      volumeUnit: () => t(F.volumeUnitKey(units)),
      toStoredLength: (v) => F.toStoredLength(v, units),
      fromStoredLength: (v) => F.fromStoredLength(v, units),
      toStoredVolume: (v) => F.toStoredVolume(v, units),
      fromStoredVolume: (v) => F.fromStoredVolume(v, units),
    };
  }, [lang, dir, locale, units, theme, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside <I18nProvider>');
  return ctx;
}
