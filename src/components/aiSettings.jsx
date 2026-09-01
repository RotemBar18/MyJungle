import { createContext, useContext, useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { TextField, SelectField, useToast, Bidi } from './ui.jsx';
import { PROVIDERS, PROVIDER_IDS, loadAiSettings, saveAiSettings, testKey, listModels, AiError } from '../lib/ai.js';

/**
 * Where the AI key is configured, and the one place that knows whether an
 * assistant is available at all. Kept in a context so the camera button and the
 * ask box can react the moment a key is added, without a reload.
 */
const AiContext = createContext(null);

export function AiProvider({ children }) {
  // The ref, not the state, is the live value. A React state updater runs when
  // React decides to, so persisting from inside one meant `chat()` — which reads
  // localStorage — could still see the previous model on the very next line.
  // Writing through the ref makes an update visible synchronously.
  const current = useRef(loadAiSettings());
  const [settings, setSettings] = useState(current.current);

  const update = useCallback((patch) => {
    const prev = current.current;
    const next = { ...prev, ...patch };
    // Switching provider carries the old provider's model name across, which
    // would always fail; reset it unless the model itself was what changed.
    if (patch.provider && patch.provider !== prev.provider && !patch.model) {
      next.model = PROVIDERS[patch.provider].defaultModel;
      next.apiKey = '';
    }
    current.current = next;
    saveAiSettings(next);
    setSettings(next);
    return next;
  }, []);

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

  const provider = PROVIDERS[ai.provider];
  const key = ai.apiKey.trim();

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
          ai.update({
            model:
              available.find((m) => m === provider.defaultModel) ||
              available.find((m) => /flash|mini|haiku/i.test(m)) ||
              available[0],
          });
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

  // Never render an empty select: fall back to whatever is currently saved.
  const modelOptions = models.length
    ? models.map((m) => ({ value: m, label: m }))
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
          <button className="btn sm primary" onClick={runTest} disabled={busy || !key || loadingModels}>
            {busy ? t('ai.testing') : t('ai.test')}
          </button>
        </div>

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

      <div className="col" style={{ gap: 8, marginBlockStart: 4 }}>
        {provider.free && <p className="tiny muted">🌱 {t('ai.freeNote')}</p>}
        {!provider.free && <p className="tiny muted">💳 {t('ai.subscriptionNote')}</p>}
        <p className="tiny muted">
          🔒 <Bidi>{t('ai.privacy')}</Bidi>
        </p>
      </div>
    </div>
  );
}
