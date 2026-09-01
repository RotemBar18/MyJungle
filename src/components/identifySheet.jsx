import { useRef, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';
import { Sheet, Badge, Bidi, useToast } from './ui.jsx';
import { useAi, useAiError } from './aiSettings.jsx';
import { IconCamera } from './icons.jsx';
import { identifyPlant, identityToPlant } from '../lib/plantAgent.js';
import { prepareImage, ImageError } from '../lib/image.js';

/**
 * Camera-first plant creation: photograph it, and the species, light, watering
 * rule and what-to-watch-for come back filled in. The result is always shown
 * for confirmation before anything is written — the model is a fast first
 * draft, not an authority, and it says so when it is unsure.
 */
export function IdentifySheet({ open, onClose, onAccept, onManual }) {
  const { t, lang } = useI18n();
  useAi(); // ensures the sheet re-renders when a key is added
  const toast = useToast();
  const explain = useAiError();
  const fileRef = useRef(null);

  const [shot, setShot] = useState(null); // { blob, preview }
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const reset = () => {
    if (shot) URL.revokeObjectURL(shot.preview);
    setShot(null);
    setResult(null);
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const pick = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setError(null);
    setResult(null);
    let prepared;
    try {
      prepared = await prepareImage(file);
    } catch (err) {
      toast(err instanceof ImageError ? t(err.key, err.vars) : t('common.error'), { type: 'error' });
      return;
    }
    if (shot) URL.revokeObjectURL(shot.preview);
    setShot({ blob: prepared.blob, preview: prepared.preview });

    setBusy(true);
    try {
      setResult(await identifyPlant(prepared.blob, lang));
    } catch (err) {
      setError(explain(err));
    } finally {
      setBusy(false);
    }
  };

  const accept = () => {
    onAccept({ patch: identityToPlant(result), photo: shot });
    setShot(null); // ownership of the blob passes to the caller
    setResult(null);
    onClose();
  };

  return (
    <Sheet
      open={open}
      onClose={close}
      title={t('ai.identify')}
      footer={
        result ? (
          <>
            <button className="btn" onClick={() => fileRef.current?.click()}>
              {t('ai.retake')}
            </button>
            <button className="btn primary" onClick={accept}>
              {t('ai.useThis')}
            </button>
          </>
        ) : null
      }
    >
      {!shot && (
        <button className="big-camera" onClick={() => fileRef.current?.click()}>
          <span className="ico" aria-hidden="true">
            📷
          </span>
          <b>{t('ai.identify')}</b>
          <span className="small">{t('ai.setupBody')}</span>
        </button>
      )}

      {shot && (
        <div className="identify-shot">
          <img src={shot.preview} alt="" />
          {busy && (
            <div className="working">
              <span className="dots" aria-hidden="true">
                <i />
                <i />
                <i />
              </span>
              {t('ai.identifying')}
            </div>
          )}
        </div>
      )}

      {error && (
        <div className="banner err" style={{ marginBlockStart: 14 }} role="alert">
          {error}
        </div>
      )}

      {result && (
        <div style={{ marginBlockStart: 16 }}>
          <div className="row-between" style={{ alignItems: 'flex-start' }}>
            <div className="grow">
              <Bidi as="h3" style={{ fontSize: 19 }}>
                {result.name}
              </Bidi>
              {result.species && (
                <Bidi as="div" className="sci" style={{ fontStyle: 'italic', color: 'var(--muted)', fontSize: 13 }}>
                  {result.species}
                  {result.cultivar ? ` ‘${result.cultivar}’` : ''}
                </Bidi>
              )}
            </div>
            <Badge tone={result.confidence === 'high' ? 'green' : result.confidence === 'medium' ? 'amber' : 'red'}>
              {t(`ai.confidence.${result.confidence}`)}
            </Badge>
          </div>

          {result.confidence !== 'high' && (
            <p className="tiny muted" style={{ marginBlockStart: 6 }}>
              {t('ai.lowConfidenceHint')}
            </p>
          )}

          <div className="grid-2" style={{ gap: 8, marginBlockStart: 14 }}>
            <div className="tile">
              <small>{t('plant.fields.kind')}</small>
              <b>{t(`enum.kind.${result.kind}`)}</b>
            </div>
            <div className="tile">
              <small>{t('plant.fields.medium')}</small>
              <b>{t(`enum.medium.${result.medium}`)}</b>
            </div>
            <div className="tile">
              <small>{t('plant.fields.light')}</small>
              <b>{t(`enum.light.${result.light}`)}</b>
            </div>
            <div className="tile">
              <small>{t('plants.typicalRange')}</small>
              <b>{t('common.days', { n: `${result.checkMinDays}–${result.checkMaxDays}` })}</b>
            </div>
          </div>

          {result.checkNote && (
            <div className="banner info" style={{ marginBlockStart: 12 }}>
              💧 <Bidi>{result.checkNote}</Bidi>
            </div>
          )}

          {result.observations && (
            <section style={{ marginBlockStart: 14 }}>
              <div className="lbl">{t('ai.observations')}</div>
              <Bidi as="p" className="small" style={{ marginBlockStart: 4 }}>
                {result.observations}
              </Bidi>
            </section>
          )}

          {result.notes && (
            <Bidi as="p" className="small muted" style={{ marginBlockStart: 12, whiteSpace: 'pre-wrap' }}>
              {result.notes}
            </Bidi>
          )}

          {result.tags.length > 0 && (
            <div className="wrap-row" style={{ marginBlockStart: 12 }}>
              {result.tags.map((x) => (
                <span key={x} className="tagpill">
                  <Bidi>#{x}</Bidi>
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {!result && !busy && (
        <button className="btn ghost block" style={{ marginBlockStart: 14 }} onClick={onManual}>
          {t('ai.orManual')}
        </button>
      )}

      <input ref={fileRef} type="file" accept="image/*" capture="environment" hidden onChange={pick} />
    </Sheet>
  );
}
