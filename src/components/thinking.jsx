import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/index.jsx';

/** True when the device asks for less motion. Re-evaluated if the setting changes. */
function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );
  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const on = () => setReduced(mq.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return reduced;
}

/**
 * The waiting state for an AI call.
 *
 * Driven from React state rather than a CSS animation. A CSS keyframe is the
 * obvious choice, but it is also the thing a phone flattens under "reduce
 * animations" and throttles in a backgrounded or busy tab — which left the
 * indicator looking frozen until the screen was touched. Progress feedback is
 * the one case where stillness is worse than motion, so this keeps moving; what
 * the reduced-motion setting changes is *how*, fading rather than growing.
 *
 * The copy advances on a timer, not on real progress: the providers stream no
 * stage information and pretending otherwise would be a lie. It settles on the
 * last line rather than looping, so a slow call looks slow instead of stuck.
 */
export function Thinking({ task = 'ask', inline = false }) {
  const { t } = useI18n();
  const reduced = useReducedMotion();
  const steps = t(`ai.steps.${task}`);
  const lines = Array.isArray(steps) ? steps : [t('ai.thinking')];

  const [step, setStep] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick((v) => v + 1), reduced ? 700 : 340);
    return () => clearInterval(id);
  }, [reduced]);

  useEffect(() => {
    if (step >= lines.length - 1) return;
    const id = setTimeout(() => setStep((v) => v + 1), 2400);
    return () => clearTimeout(id);
  }, [step, lines.length]);

  return (
    <span className={`thinking${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <span className="sprout" aria-hidden="true">
        {[0, 1, 2].map((i) => {
          const active = tick % 3 === i;
          return (
            <i
              key={i}
              style={
                reduced
                  ? { opacity: active ? 1 : 0.3 }
                  : { opacity: active ? 1 : 0.35, transform: `scale(${active ? 1.5 : 0.7}) rotate(-45deg)` }
              }
            />
          );
        })}
      </span>
      <span className="thinking-text">{lines[step]}</span>
    </span>
  );
}

/**
 * Covers the app while the assistant works.
 *
 * These calls take seconds and write real records, so a second tap during one
 * can start a duplicate or navigate away mid-write. Blocking input is simpler
 * and more honest than disabling controls one at a time, and it puts the
 * explanation of the wait in the middle of the screen where it is being looked
 * for anyway.
 */
export function BusyVeil({ show, task }) {
  useEffect(() => {
    if (!show) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [show]);

  if (!show) return null;
  return createPortal(
    <div className="busy-veil" aria-busy="true">
      <div className="busy-card">
        <Thinking task={task} />
      </div>
    </div>,
    document.body,
  );
}
