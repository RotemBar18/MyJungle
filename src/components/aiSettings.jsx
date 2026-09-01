import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { TextField, SelectField, useToast, Bidi } from './ui.jsx';
import { Thinking, BusyVeil } from './thinking.jsx';
import {
  PROVIDERS,
  PROVIDER_IDS,
  loadAiSettings,
  saveAiSettings,
  testKey,
  listModels,
  findWorkingModel,
  AiError,
  AI_SETTINGS_EVENT,
  AI_BLOCKED_EVENT,
  readBlocked,
  emptyAiSettings,
  readUsage,
  FREE_DAILY_LIMIT,
} from '../lib/ai.js';

/**
 * Where the AI key is configured, and the one place that knows whether an
 * assistant is available at all. Kept in a context so the camera button and the
 * ask box can react the moment a key is added, without a reload.
 */
const AiContext = createContext(null);

export function AiProvider({ children }) {
  const store = useStore();
  // The ref, not the state, is the live value. A React state updater runs when
  // React decides to, so persisting from inside one meant `chat()` — which reads
  // localStorage — could still see the previous model on the very next line.
  // Writing through the ref makes an update visible synchronously.
  const current = useRef(loadAiSettings());
  const [settings, setSettings] = useState(current.current);

  const apply = useCallback((next) => {
    current.current = next;
    saveAiSettings(next);
    setSettings(next);
  }, []);

  const update = useCallback(
    (patch) => {
      const prev = current.current;
      const next = { ...prev, ...patch };
      // Switching provider carries the old provider's model name across, which
      // would always fail; reset it unless the model itself was what changed.
      if (patch.provider && patch.provider !== prev.provider && !patch.model) {
        next.model = PROVIDERS[patch.provider].defaultModel;
        next.apiKey = '';
      }
      apply(next);
      // Follow it to the account so the other devices pick it up. localStorage
      // stays the primary read, so the assistant works before the profile has
      // even loaded.
      if (store.uid) store.saveProfile({ ai: next }).catch(() => {});
      return next;
    },
    [apply, store],
  );

  /**
   * Adopt whatever the account holds, and seed the account from this device the
   * first time it has a key and the account does not. Last write wins, which is
   * the right resolution for one person's own key on their own devices.
   */
  const remote = store.profile?.ai;
  useEffect(() => {
    if (!store.uid) return;
    const local = current.current;
    if (remote?.apiKey) {
      if (
        remote.apiKey !== local.apiKey ||
        remote.provider !== local.provider ||
        remote.model !== local.model
      ) {
        apply({ provider: remote.provider, apiKey: remote.apiKey, model: remote.model });
      }
    } else if (local.apiKey.trim() && store.profile) {
      store.saveProfile({ ai: local }).catch(() => {});
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remote?.apiKey, remote?.provider, remote?.model, store.uid, Boolean(store.profile)]);

  /**
   * A key belongs to the person who typed it. When a different account signs in
   * on this browser — or nobody does — the previous one's key must not linger
   * where the next person could use it.
   */
  const lastUid = useRef(store.uid);
  useEffect(() => {
    if (lastUid.current && lastUid.current !== store.uid) apply(emptyAiSettings());
    lastUid.current = store.uid;
  }, [store.uid, apply]);

  // `chat()` can switch the model on its own when a provider retires one. That
  // write happens outside React, so pick it up here — and carry it to the
  // account too, or the other devices would keep using the retired model.
  useEffect(() => {
    const sync = () => {
      const fresh = loadAiSettings();
      const changedElsewhere =
        fresh.model !== current.current.model ||
        fresh.provider !== current.current.provider ||
        fresh.apiKey !== current.current.apiKey;
      current.current = fresh;
      setSettings(fresh);
      if (changedElsewhere && store.uid) store.saveProfile({ ai: fresh }).catch(() => {});
    };
    window.addEventListener(AI_SETTINGS_EVENT, sync);
    return () => window.removeEventListener(AI_SETTINGS_EVENT, sync);
  }, [store]);

  const value = useMemo(
    () => ({ ...settings, ready: Boolean(settings.apiKey.trim()), update }),
    [settings, update],
  );
  return <AiContext.Provider value={value}>{children}</AiContext.Provider>;
}

export function useAi() {
  const ctx = useContext(AiContext);
  if (!ctx) throw new Error('useAi must be used inside <AiProvider>');
  return ctx;
}

/** Translate an AiError, falling back to its raw message for unknown shapes. */
export function useAiError() {
  const { t } = useI18n();
  return useCallback(
    (err) => {
      if (err instanceof AiError) {
        const s = t(err.key);
        return s === err.key ? t('ai.errors.request') : s;
      }
      return t('common.error');
    },
    [t],
  );
}

/**
 * Which model to land on when the saved one will not do.
 *
 * A provider's catalogue is ordered alphabetically and contains retired
 * entries, so "the first one" and "the one matching our default" are both
 * wrong. Prefer a rolling alias where the provider offers one, then the highest
 * version number, so this does not need revisiting every release.
 */
const versionOf = (id) => {
  const m = id.match(/(\d+)(?:\.(\d+))?/);
  return m ? Number(m[1]) * 100 + Number(m[2] || 0) : 0;
};

function preferredModel(providerId, list, fallback) {
  if (!list.length) return fallback;
  const newest = (re) => list.filter((m) => re.test(m)).sort((a, b) => versionOf(b) - versionOf(a))[0];
  const oldest = (re) => list.filter((m) => re.test(m)).sort((a, b) => versionOf(a) - versionOf(b))[0];
  // Gemini is the free-tier default, and free quota is granted per model: the
  // newest ones frequently have none, while the smaller Flash-Lite models have
  // the largest allowance. So the opening pick goes for the one most likely to
  // work rather than the one most capable. Paid users can change it; the
  // dropdown lists everything their key can run.
  if (providerId === 'gemini')
    return (
      oldest(/flash-lite/) ||
      list.find((m) => m === 'gemini-flash-lite-latest') ||
      oldest(/flash/) ||
      list[0]
    );
  if (providerId === 'openai') return list.find((m) => m === 'gpt-5') || newest(/^gpt-\d/) || list[0];
  return list.find((m) => m.startsWith('claude-opus')) || newest(/^claude/) || list[0];
}

/** Raw provider text behind a disclosure — this app cannot diagnose keys for you. */
function Detail({ text, label }) {
  if (!text) return null;
  return (
    <details style={{ marginBlockStart: 8 }}>
      <summary className="tiny" style={{ cursor: 'pointer' }}>
        {label}
      </summary>
      <pre
        className="tiny"
        style={{
          marginBlockStart: 6,
          whiteSpace: 'pre-wrap',
          overflowWrap: 'anywhere',
          direction: 'ltr',
          textAlign: 'left',
          opacity: 0.85,
        }}
      >
        {text}
      </pre>
    </details>
  );
}

export function AiPanel() {
  const { t } = useI18n();
  const ai = useAi();
  const toast = useToast();
  const explain = useAiError();

  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [modelsError, setModelsError] = useState(null);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [probe, setProbe] = useState([]);
  const [blocked, setBlocked] = useState(() => readBlocked(ai.provider, ai.apiKey));

  const provider = PROVIDERS[ai.provider];
  const key = ai.apiKey.trim();
  const usage = readUsage();
  const freeLimit = FREE_DAILY_LIMIT[ai.provider];

  /**
   * The model list comes from the provider as soon as there is a key to ask
   * with, so the field is always a choice between models that actually exist
   * for this key — never a free-text box someone has to guess into.
   */
  useEffect(() => {
    if (!key) {
      setModels([]);
      setModelsError(null);
      return;
    }
    let alive = true;
    setLoadingModels(true);
    setModelsError(null);
    // Debounced: a key arrives one keystroke, or one paste, at a time.
    const timer = setTimeout(async () => {
      try {
        const available = await listModels();
        if (!alive) return;
        setModels(available);
        if (available.length && !available.includes(ai.model)) {
          ai.update({ model: preferredModel(ai.provider, available, ai.model) });
        }
      } catch (err) {
        if (alive) {
          setModels([]);
          setModelsError({ message: explain(err), detail: err?.detail });
        }
      } finally {
        if (alive) setLoadingModels(false);
      }
    }, 500);
    return () => {
      alive = false;
      clearTimeout(timer);
    };
    // Deliberately not keyed on ai.model — choosing a model would refetch the list.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, ai.provider]);

  // The app learns which models this key is refused for; reflect that here.
  useEffect(() => {
    const refresh = () => setBlocked(readBlocked(ai.provider, ai.apiKey));
    refresh();
    window.addEventListener(AI_BLOCKED_EVENT, refresh);
    return () => window.removeEventListener(AI_BLOCKED_EVENT, refresh);
  }, [ai.provider, ai.apiKey]);

  const runTest = async () => {
    setBusy(true);
    setResult(null);
    try {
      await testKey();
      setResult({ ok: true });
      toast(t('ai.testOk'));
    } catch (err) {
      setResult({ ok: false, message: explain(err), detail: err?.detail });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Ask the key which model it will actually answer with. Whether a listed
   * model is usable depends on retirement and free-tier allowance, neither of
   * which the catalogue reveals — so try them.
   */
  const runFind = async () => {
    setBusy(true);
    setResult(null);
    setProbe([]);
    try {
      const { model, tried } = await findWorkingModel((step) => setProbe((v) => [...v, step]));
      setProbe(tried);
      if (model) {
        ai.update({ model });
        setResult({ ok: true });
        toast(t('ai.foundModel', { model }));
      } else {
        setResult({ ok: false, message: t('ai.noneWorked') });
      }
    } catch (err) {
      setResult({ ok: false, message: explain(err), detail: err?.detail });
    } finally {
      setBusy(false);
    }
  };

  // Never render an empty select: fall back to whatever is currently saved.
  // Models this key was refused for sink to the bottom and say why, so the list
  // stops being a set of options that silently fail.
  const modelOptions = models.length
    ? [...models]
        .sort((a, b) => (blocked[a] ? 1 : 0) - (blocked[b] ? 1 : 0))
        .map((m) => ({
          value: m,
          label: blocked[m] ? `${m} — ${t(`ai.blocked.${blocked[m]}`)}` : m,
        }))
    : [{ value: ai.model, label: ai.model }];

  const modelHint = !key
    ? t('ai.modelNeedsKey')
    : loadingModels
      ? t('ai.loadingModels')
      : models.length
        ? t('ai.modelsFound', { n: models.length })
        : t('ai.modelsUnavailable');

  return (
    <div className="card pad">
      <BusyVeil show={busy} task="probe" />
      <p className="small muted">{t('ai.setupBody')}</p>

      <div style={{ marginBlockStart: 14 }}>
        <SelectField
          label={t('ai.provider')}
          value={ai.provider}
          onChange={(next) => {
            ai.update({ provider: next });
            setResult(null);
            setModels([]);
            setModelsError(null);
          }}
          options={PROVIDER_IDS.map((id) => ({
            value: id,
            label: `${PROVIDERS[id].label} — ${PROVIDERS[id].free ? t('ai.freeTag') : t('ai.paidTag')}`,
          }))}
        />

        <TextField
          type="password"
          label={t('ai.apiKey')}
          placeholder={provider.keyHint}
          dir="ltr"
          autoComplete="off"
          spellCheck={false}
          value={ai.apiKey}
          onChange={(e) => {
            ai.update({ apiKey: e.target.value });
            setResult(null);
          }}
        />

        <SelectField
          label={t('ai.model')}
          value={ai.model}
          onChange={(model) => {
            ai.update({ model });
            setResult(null);
          }}
          options={modelOptions}
          hint={modelHint}
        />

        {modelsError && (
          <div className="banner err" style={{ marginBlockEnd: 14, display: 'block' }} role="alert">
            <div>{modelsError.message}</div>
            <Detail text={modelsError.detail} label={t('ai.showDetail')} />
          </div>
        )}

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBlockEnd: 14 }}>
          <a className="btn sm" href={provider.keyUrl} target="_blank" rel="noreferrer noopener">
            {t('ai.getKey')} ↗
          </a>
          <button className="btn sm" onClick={runTest} disabled={busy || !key || loadingModels}>
            {busy ? t('ai.testing') : t('ai.test')}
          </button>
          <button className="btn sm primary" onClick={runFind} disabled={busy || !key || loadingModels}>
            {t('ai.findModel')}
          </button>
        </div>

        {busy && (
          <div className="tile" style={{ marginBlockEnd: 14 }}>
            <Thinking task="probe" inline />
          </div>
        )}

        {probe.length > 0 && (
          <div className="list" style={{ marginBlockEnd: 14 }}>
            {probe.map((p) => (
              <div className="list-row" key={p.model}>
                <span className="lead" aria-hidden="true">
                  {p.ok ? '✅' : '—'}
                </span>
                <span className="txt">
                  <b style={{ direction: 'ltr' }}>{p.model}</b>
                  {!p.ok && <small>{t(p.reason)}</small>}
                </span>
              </div>
            ))}
          </div>
        )}

        {result && (
          <div
            className={`banner ${result.ok ? 'info' : 'err'}`}
            style={{ marginBlockEnd: 14, display: 'block' }}
            role="status"
          >
            <div>{result.ok ? `✓ ${t('ai.testOk')} — ${ai.model}` : result.message}</div>
            <Detail text={result.detail} label={t('ai.showDetail')} />
          </div>
        )}
      </div>

      {key && (
        <div className="tile" style={{ marginBlockStart: 4 }}>
          <small>
            {freeLimit
              ? t('ai.usageOfLimit', { n: usage.count, max: freeLimit })
              : t('ai.usageToday', { n: usage.count })}
          </small>
          {freeLimit != null && (
            <span className="progress" style={{ display: 'block', marginBlockStart: 6 }}>
              <i style={{ inlineSize: `${Math.min(100, Math.round((usage.count / freeLimit) * 100))}%` }} />
            </span>
          )}
          <span className="tiny muted" style={{ display: 'block', marginBlockStart: 6 }}>
            {t('ai.usageNote')}
          </span>
        </div>
      )}

      <div className="col" style={{ gap: 8, marginBlockStart: 12 }}>
        {provider.free && <p className="tiny muted">🌱 {t('ai.freeNote')}</p>}
        {provider.free && <p className="tiny muted">📋 {t('ai.freeTierModels')}</p>}
        {!provider.free && <p className="tiny muted">💳 {t('ai.subscriptionNote')}</p>}
        <p className="tiny muted">
          🔒 <Bidi>{t('ai.privacy')}</Bidi>
        </p>
      </div>
    </div>
  );
}
