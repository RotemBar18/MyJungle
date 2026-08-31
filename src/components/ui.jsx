import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  useId,
} from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/index.jsx';
import { IconClose, IconCheck, IconPlus, IconCamera } from './icons.jsx';
import { prepareImage, ImageError } from '../lib/image.js';

/* ------------------------------------------------------------------ toasts */

const ToastCtx = createContext(() => {});
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }) {
  const [items, setItems] = useState([]);
  const push = useCallback((message, opts = {}) => {
    const id = Math.random().toString(36).slice(2);
    setItems((s) => [...s, { id, message, ...opts }]);
    const ttl = opts.action ? 7000 : 3400;
    setTimeout(() => setItems((s) => s.filter((x) => x.id !== id)), ttl);
  }, []);
  return (
    <ToastCtx.Provider value={push}>
      {children}
      {createPortal(
        <div className="toast-wrap" role="status" aria-live="polite">
          {items.map((t) => (
            <div key={t.id} className={`toast${t.type === 'error' ? ' err' : ''}`}>
              <span className="grow">{t.message}</span>
              {t.action && (
                <button
                  type="button"
                  onClick={() => {
                    setItems((s) => s.filter((x) => x.id !== t.id));
                    t.action.onClick();
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
          ))}
        </div>,
        document.body,
      )}
    </ToastCtx.Provider>
  );
}

/* ------------------------------------------------------------------- sheet */

/**
 * Bottom sheet on phones, centred dialog from 700px up (one component, the
 * difference is pure CSS). Escape closes, the backdrop closes, focus moves in
 * on open and returns to the trigger on close.
 */
export function Sheet({ open, onClose, title, children, footer, wide, labelledBy }) {
  const { t } = useI18n();
  const panel = useRef(null);
  const restore = useRef(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return;
    restore.current = document.activeElement;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const el = panel.current?.querySelector(
      'input:not([type=hidden]), select, textarea, button, [href]',
    );
    // Focusing an input would pop the mobile keyboard over the sheet; focus the
    // panel itself and let the user tap the field they want.
    (panel.current || el)?.focus?.();
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
      }
      if (e.key === 'Tab') trapFocus(e, panel.current);
    };
    document.addEventListener('keydown', onKey, true);
    return () => {
      document.body.style.overflow = prev;
      document.removeEventListener('keydown', onKey, true);
      restore.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;
  return createPortal(
    <div
      className="scrim"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div
        className={`sheet${wide ? ' wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || headingId}
        tabIndex={-1}
        ref={panel}
      >
        <div className="grabber" />
        <div className="sheet-head">
          <h3 id={headingId}>{title}</h3>
          <button className="btn icon" onClick={onClose} aria-label={t('a11y.closeSheet')}>
            <IconClose />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

function trapFocus(e, root) {
  if (!root) return;
  const f = [...root.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(
    (n) => n.offsetParent !== null,
  );
  if (!f.length) return;
  const first = f[0];
  const last = f[f.length - 1];
  if (e.shiftKey && document.activeElement === first) {
    e.preventDefault();
    last.focus();
  } else if (!e.shiftKey && document.activeElement === last) {
    e.preventDefault();
    first.focus();
  }
}

/** Yes/no confirmation. `danger` colours the confirm button. */
export function Confirm({ open, title, body, confirmLabel, onConfirm, onClose, danger, busy }) {
  const { t } = useI18n();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={title}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            {t('common.cancel')}
          </button>
          <button
            className={`btn ${danger ? 'danger' : 'primary'}`}
            onClick={onConfirm}
            disabled={busy}
          >
            {busy ? t('common.saving') : confirmLabel || t('common.confirm')}
          </button>
        </>
      }
    >
      <p style={{ fontSize: 14.5, lineHeight: 1.55 }}>{body}</p>
    </Sheet>
  );
}

/* ------------------------------------------------------------------- forms */

export function Field({ label, hint, error, children, className = '', htmlFor }) {
  return (
    <div className={`field ${className}`}>
      {label && (
        <label htmlFor={htmlFor} className="lbl">
          {label}
        </label>
      )}
      {children}
      {error ? <span className="err">{error}</span> : hint ? <span className="hint">{hint}</span> : null}
    </div>
  );
}

export function TextField({ label, hint, error, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} error={error} className={className} htmlFor={id}>
      <input id={id} aria-invalid={error ? 'true' : undefined} {...props} />
    </Field>
  );
}

export function TextArea({ label, hint, className, ...props }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <textarea id={id} {...props} />
    </Field>
  );
}

/** Native select — the platform picker is the best mobile picker there is. */
export function SelectField({ label, hint, options, value, onChange, allowEmpty, emptyLabel, className }) {
  const id = useId();
  return (
    <Field label={label} hint={hint} className={className} htmlFor={id}>
      <select id={id} value={value ?? ''} onChange={(e) => onChange(e.target.value)}>
        {allowEmpty && <option value="">{emptyLabel ?? '—'}</option>}
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </Field>
  );
}

export function Segmented({ value, onChange, options, label }) {
  return (
    <div className="field">
      {label && <span className="lbl">{label}</span>}
      <div className="seg" role="radiogroup" aria-label={label}>
        {options.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={value === o.value}
            className={value === o.value ? 'on' : ''}
            onClick={() => onChange(o.value)}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Multi- or single-select grid of tappable choices. */
export function ChoiceGrid({ options, value, onChange, multiple, label, hint }) {
  const selected = multiple ? new Set(value || []) : null;
  return (
    <div className="field">
      {label && <span className="lbl">{label}</span>}
      {hint && <span className="hint">{hint}</span>}
      <div className="choice-grid" role={multiple ? 'group' : 'radiogroup'} aria-label={label}>
        {options.map((o) => {
          const on = multiple ? selected.has(o.value) : value === o.value;
          return (
            <button
              key={o.value}
              type="button"
              role={multiple ? 'checkbox' : 'radio'}
              aria-checked={on}
              className={`choice${on ? ' on' : ''}`}
              onClick={() => {
                if (!multiple) return onChange(o.value);
                const next = new Set(selected);
                next.has(o.value) ? next.delete(o.value) : next.add(o.value);
                onChange([...next]);
              }}
            >
              {o.icon && <span className="ic">{o.icon}</span>}
              <span className="grow">{o.label}</span>
              {on && <IconCheck width={15} height={15} />}
            </button>
          );
        })}
      </div>
    </div>
  );
}

export function SwitchRow({ label, hint, checked, onChange }) {
  return (
    <div className="switch-row">
      <span>
        <b style={{ fontSize: 14.5, fontWeight: 600, display: 'block' }}>{label}</b>
        {hint && <span className="hint">{hint}</span>}
      </span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        aria-label={label}
        className="switch"
        onClick={() => onChange(!checked)}
      />
    </div>
  );
}

export function TagInput({ label, value = [], onChange, placeholder }) {
  const [draft, setDraft] = useState('');
  const id = useId();
  const add = () => {
    const v = draft.trim();
    if (v && !value.includes(v)) onChange([...value, v]);
    setDraft('');
  };
  return (
    <Field label={label} htmlFor={id}>
      {value.length > 0 && (
        <div className="wrap-row" style={{ marginBlockEnd: 6 }}>
          {value.map((v) => (
            <span key={v} className="chip">
              <span dir="auto">{v}</span>
              <button
                type="button"
                className="x"
                aria-label={`${v} ✕`}
                onClick={() => onChange(value.filter((x) => x !== v))}
              >
                ✕
              </button>
            </span>
          ))}
        </div>
      )}
      <input
        id={id}
        value={draft}
        placeholder={placeholder}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={add}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add();
          }
        }}
      />
    </Field>
  );
}

/* ------------------------------------------------------------------ photos */

/**
 * Picks photos and prepares them locally. Uploading is the caller's job (on
 * save), so a photo chosen while offline still reaches the record.
 */
export function PhotoPicker({ label, photos = [], onChange, max = 6 }) {
  const { t } = useI18n();
  const toast = useToast();
  const input = useRef(null);

  const pick = async (e) => {
    const files = [...(e.target.files || [])];
    e.target.value = '';
    const next = [...photos];
    for (const f of files.slice(0, max - photos.length)) {
      try {
        const prepared = await prepareImage(f);
        next.push({ blob: prepared.blob, preview: prepared.preview, w: prepared.width, h: prepared.height });
      } catch (err) {
        toast(err instanceof ImageError ? t(err.key, err.vars) : t('common.error'), { type: 'error' });
      }
    }
    onChange(next);
  };

  return (
    <div className="field">
      {label && <span className="lbl">{label}</span>}
      <div className="photo-input">
        {photos.map((p, i) => (
          <div className="photo-thumb" key={p.preview || p.url || i}>
            <img src={p.preview || p.url} alt="" />
            <button
              type="button"
              className="rm"
              aria-label={t('a11y.removePhoto')}
              onClick={() => {
                if (p.preview) URL.revokeObjectURL(p.preview);
                onChange(photos.filter((_, j) => j !== i));
              }}
            >
              ✕
            </button>
          </div>
        ))}
        {photos.length < max && (
          <button type="button" className="photo-add" onClick={() => input.current?.click()}>
            <IconCamera width={20} height={20} />
            <span>{t('common.addPhoto')}</span>
          </button>
        )}
      </div>
      <input
        ref={input}
        type="file"
        accept="image/*"
        multiple={max > 1}
        hidden
        onChange={pick}
      />
    </div>
  );
}

/* ------------------------------------------------------------------- bits */

export function EmptyState({ emoji = '🌱', title, body, action }) {
  return (
    <div className="empty-state">
      <div className="emoji" aria-hidden="true">
        {emoji}
      </div>
      {title && <h4>{title}</h4>}
      {body && <p className="small">{body}</p>}
      {action && <div style={{ marginBlockStart: 14 }}>{action}</div>}
    </div>
  );
}

export const Badge = ({ tone = 'neutral', children, ...p }) => (
  <span className={`badge ${tone}`} {...p}>
    {children}
  </span>
);

/**
 * Isolates a run of user text whose direction may differ from the UI (Latin
 * species names inside Hebrew, Hebrew plant names inside English).
 *
 * The wrapper keeps the interface direction, so the text stays aligned with
 * everything around it; the inner `dir="auto"` span decides only how the
 * characters inside it are ordered. Putting `dir="auto"` on the block itself
 * would right-align a Hebrew name in an otherwise left-aligned English card.
 */
export const Bidi = ({ children, as: As = 'span', className = '', ...p }) => (
  <As className={`bidi ${className}`} {...p}>
    <span dir="auto" style={{ unicodeBidi: 'isolate' }}>
      {children}
    </span>
  </As>
);

/** Numbers, dates and measurements always read left-to-right. */
export const Num = ({ children }) => <span className="ltr-run">{children}</span>;

export function AddButton({ onClick, label }) {
  return (
    <button className="btn primary" onClick={onClick}>
      <IconPlus />
      {label}
    </button>
  );
}
