import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { TextField, SelectField, useToast, Bidi } from './ui.jsx';
import { PROVIDERS, PROVIDER_IDS, loadAiSettings, saveAiSettings, testKey, AiError } from '../lib/ai.js';

/**
 * Where the AI key is configured, and the one place that knows whether an
 * assistant is available at all. Kept in a context so the camera button and the
 * ask box can react the moment a key is added, without a reload.
 */
const AiContext = createContext(null);

export function AiProvider({ children }) {
  const [settings, setSettings] = useState(loadAiSettings);

  const update = useCallback((patch) => {
    setSettings((prev) => {
      const next = { ...prev, ...patch };
      // Switching provider carries the old provider's model name across, which
      // would always fail; reset it unless the model itself was what changed.
      if (patch.provider && patch.provider !== prev.provider && !patch.model) {
        next.model = PROVIDERS[patch.provider].defaultModel;
        next.apiKey = '';
      }
      saveAiSettings(next);
      return next;
    });
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

export function AiPanel() {
  const { t } = useI18n();
  const ai = useAi();
  const toast = useToast();
  const explain = useAiError();
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const provider = PROVIDERS[ai.provider];

  const run = async () => {
    setBusy(true);
    setResult(null);
    try {
      await testKey();
      setResult({ ok: true });
      toast(t('ai.testOk'));
    } catch (err) {
      setResult({ ok: false, message: explain(err) });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="card pad">
      <p className="small muted">{t('ai.setupBody')}</p>

      <div style={{ marginBlockStart: 14 }}>
        <SelectField
          label={t('ai.provider')}
          value={ai.provider}
          onChange={(provider) => {
            ai.update({ provider });
            setResult(null);
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

        <div className="row" style={{ gap: 8, flexWrap: 'wrap', marginBlockEnd: 14 }}>
          <a className="btn sm" href={provider.keyUrl} target="_blank" rel="noreferrer noopener">
            {t('ai.getKey')} ↗
          </a>
          <button className="btn sm primary" onClick={run} disabled={busy || !ai.apiKey.trim()}>
            {busy ? t('ai.testing') : t('ai.test')}
          </button>
        </div>

        {result && (
          <div className={`banner ${result.ok ? 'info' : 'err'}`} style={{ marginBlockEnd: 14 }} role="status">
            {result.ok ? `✓ ${t('ai.testOk')}` : result.message}
          </div>
        )}

        <details>
          <summary className="small muted" style={{ cursor: 'pointer', minHeight: 32 }}>
            {t('ai.model')}
          </summary>
          <div style={{ paddingBlockStart: 10 }}>
            <TextField
              label={t('ai.model')}
              dir="ltr"
              value={ai.model}
              onChange={(e) => ai.update({ model: e.target.value })}
              hint={provider.defaultModel}
            />
          </div>
        </details>
      </div>

      <div className="col" style={{ gap: 8, marginBlockStart: 12 }}>
        {provider.free && <p className="tiny muted">🌱 {t('ai.freeNote')}</p>}
        {!provider.free && <p className="tiny muted">💳 {t('ai.subscriptionNote')}</p>}
        <p className="tiny muted">🔒 <Bidi>{t('ai.privacy')}</Bidi></p>
      </div>
    </div>
  );
}
