import { useEffect, useState } from 'react';
import { useI18n } from '../i18n/index.jsx';

/**
 * The waiting state for an AI call.
 *
 * These requests take a few seconds — long enough that a static spinner reads
 * as a hang. Naming the stage it is at ("looking at the photo", "reading this
 * plant's history") makes the wait legible instead of merely tolerable, and the
 * steps are per-task because "thinking" tells the owner nothing.
 *
 * The copy advances on a timer rather than from real progress: the providers
 * stream no stage information, and pretending otherwise would be a lie. It
 * stops on the last line rather than looping back, so a slow call looks slow
 * instead of looking stuck in a cycle.
 */
export function Thinking({ task = 'ask', inline = false }) {
  const { t } = useI18n();
  const steps = t(`ai.steps.${task}`);
  const lines = Array.isArray(steps) ? steps : [t('ai.thinking')];
  const [i, setI] = useState(0);

  useEffect(() => {
    if (i >= lines.length - 1) return;
    const id = setTimeout(() => setI((v) => v + 1), 2200);
    return () => clearTimeout(id);
  }, [i, lines.length]);

  return (
    <span className={`thinking${inline ? ' inline' : ''}`} role="status" aria-live="polite">
      <span className="sprout" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
      <span className="thinking-text" key={i}>
        {lines[i]}
      </span>
    </span>
  );
}
