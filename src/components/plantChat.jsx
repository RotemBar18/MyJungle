import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { EmptyState, Bidi, useToast } from './ui.jsx';
import { useAi, useAiError } from './aiSettings.jsx';
import { IconCamera, IconClose } from './icons.jsx';
import { logEntry, askPlant } from '../lib/plantAgent.js';
import { prepareImage, ImageError } from '../lib/image.js';
import { eventType } from '../lib/domain.js';
import { photoErrorKey, photoErrorDetail } from '../lib/photoError.js';
import { Thinking } from './thinking.jsx';

/**
 * The conversational surface: one box that both records what you did and answers
 * questions about this plant.
 *
 * Anything it records becomes a real event, so it lands in the timeline and
 * feeds the watering intervals exactly like a form entry would — with an Undo
 * for the times the model misreads you.
 *
 * The conversation itself is deliberately not persisted. What matters long-term
 * is the events it produced, and those are already permanent; keeping the chat
 * would double the storage and give the plant two competing histories.
 */
export function PlantChat({ plant, stats }) {
  const { t, lang } = useI18n();
  const store = useStore();
  const ai = useAi();
  const toast = useToast();
  const explain = useAiError();

  const [turns, setTurns] = useState([]);
  const [text, setText] = useState('');
  const [photo, setPhoto] = useState(null);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState('log');
  const fileRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [turns, busy]);

  useEffect(() => () => photo && URL.revokeObjectURL(photo.preview), [photo]);

  if (!ai.ready) {
    return (
      <EmptyState
        emoji="✨"
        title={t('ai.notConfigured')}
        body={t('ai.notConfiguredBody')}
        action={
          <Link className="btn primary" to="/settings">
            {t('ai.setup')}
          </Link>
        }
      />
    );
  }

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const prepared = await prepareImage(file);
      setPhoto({ blob: prepared.blob, preview: prepared.preview });
    } catch (err) {
      toast(err instanceof ImageError ? t(err.key, err.vars) : t('common.error'), { type: 'error' });
    }
  };

  /**
   * One box, two intentions. A question gets answered; anything else is treated
   * as something that happened and gets recorded. The heuristic is deliberately
   * simple and always recoverable — a misread question just produces a note the
   * user can undo.
   */
  const looksLikeQuestion = (s) =>
    /\?|^\s*(why|what|when|how|should|is|are|can|does|do|will|would|could)\b/i.test(s) ||
    /^\s*(למה|מה|מתי|איך|האם|כדאי|צריך|אפשר)\b/.test(s);

  const send = async () => {
    const message = text.trim();
    if ((!message && !photo) || busy) return;

    const mine = { role: 'user', text: message, photo: photo?.preview };
    setTurns((v) => [...v, mine]);
    setText('');
    const sentPhoto = photo;
    setPhoto(null);
    setBusy(true);

    try {
      const asking = message && !sentPhoto && looksLikeQuestion(message);
      setMode(asking ? 'ask' : 'log');

      if (asking) {
        const answer = await askPlant({
          plant,
          stats,
          question: message,
          history: turns.filter((x) => !x.events).map((x) => ({ role: x.role, text: x.text })),
          lang,
        });
        setTurns((v) => [...v, { role: 'assistant', text: answer }]);
      } else {
        const { events, reply } = await logEntry({
          plant,
          stats,
          text: message,
          imageBlob: sentPhoto?.blob,
          lang,
        });

        // Upload once, attach to the first event — the photo belongs to the
        // moment, not to every record that moment produced.
        let photos = [];
        if (sentPhoto) {
          try {
            photos = [await store.uploadPhoto(plant.id, sentPhoto.blob)];
          } catch (err) {
            toast(`${t(photoErrorKey(err))} ${photoErrorDetail(err)}`, { type: 'error' });
          }
        }

        const written = [];
        for (const [i, ev] of events.entries()) {
          const id = await store.addEvent(plant.id, {
            type: ev.type,
            at: ev.at,
            data: ev.data,
            note: ev.note,
            photos: i === 0 ? photos : [],
            source: 'ai',
          });
          written.push(id);
        }
        if (photos[0]?.url && !plant.photo?.url) {
          await store.savePlant(plant.id, { photo: photos[0] });
        }

        setTurns((v) => [
          ...v,
          { role: 'assistant', text: reply || t('ai.nothingToRecord'), events, eventIds: written },
        ]);
      }
    } catch (err) {
      setTurns((v) => [...v, { role: 'assistant', text: explain(err), error: true }]);
    } finally {
      setBusy(false);
    }
  };

  const undo = async (turnIndex, ids) => {
    for (const id of ids) await store.deleteEvent(id);
    setTurns((v) => v.map((x, i) => (i === turnIndex ? { ...x, eventIds: [], undone: true } : x)));
    toast(t('ai.undone'));
  };

  return (
    <div className="chat">
      <div className="chat-log">
        {turns.length === 0 && (
          <div className="chat-empty">
            <p className="small muted">{t('ai.emptyChat')}</p>
            <div className="wrap-row" style={{ justifyContent: 'center', marginBlockStart: 12 }}>
              {['water', 'how', 'problem'].map((k) => (
                <button key={k} className="chip" onClick={() => setText(t(`ai.suggestions.${k}`))}>
                  {t(`ai.suggestions.${k}`)}
                </button>
              ))}
            </div>
          </div>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={`bubble ${turn.role}${turn.error ? ' err' : ''}`}>
            {turn.photo && <img src={turn.photo} alt="" className="bubble-photo" />}
            {turn.text && (
              <Bidi as="div" className="bubble-text">
                {turn.text}
              </Bidi>
            )}

            {turn.events?.length > 0 && (
              <div className="bubble-events">
                {turn.events.map((e, k) => (
                  <span key={k} className="tagpill">
                    {eventType(e.type).icon} {t(`enum.eventType.${e.type}`)}
                  </span>
                ))}
                {turn.eventIds?.length > 0 && (
                  <button className="bubble-undo" onClick={() => undo(i, turn.eventIds)}>
                    {t('ai.undo')}
                  </button>
                )}
                {turn.undone && <span className="tiny muted">{t('ai.undone')}</span>}
              </div>
            )}
          </div>
        ))}

        {busy && (
          <div className="bubble assistant">
            <Thinking task={mode} />
          </div>
        )}
        <div ref={endRef} />
      </div>

      {photo && (
        <div className="chat-attach">
          <img src={photo.preview} alt="" />
          <button
            className="btn icon"
            aria-label={t('a11y.removePhoto')}
            onClick={() => {
              URL.revokeObjectURL(photo.preview);
              setPhoto(null);
            }}
          >
            <IconClose width={16} height={16} />
          </button>
        </div>
      )}

      <div className="chat-input">
        <button
          className="btn icon"
          onClick={() => fileRef.current?.click()}
          aria-label={t('ai.attachPhoto')}
          disabled={busy}
        >
          <IconCamera />
        </button>
        <textarea
          rows={1}
          value={text}
          placeholder={t('ai.askPlaceholder')}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
        />
        <button
          className="btn primary icon filled"
          onClick={send}
          disabled={busy || (!text.trim() && !photo)}
          aria-label={t('ai.send')}
        >
          ↑
        </button>
      </div>
      <p className="tiny muted" style={{ marginBlockStart: 6 }}>
        {t('ai.askHint')}
      </p>
    </div>
  );
}
