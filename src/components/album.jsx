import { useEffect, useMemo, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useI18n } from '../i18n/index.jsx';
import { EmptyState, Bidi } from './ui.jsx';
import { IconClose, IconChevron } from './icons.jsx';
import { eventType } from '../lib/domain.js';
import { toDate, daysBetween } from '../lib/format.js';

/**
 * A plant's album.
 *
 * Photos are not a separate collection — every one is already attached to the
 * event it was taken for, so the album is just those events read back in order.
 * That is what makes each picture carry a date and a reason ("repotting",
 * "watering") rather than being a loose file, and it is why the album fills
 * itself in as a side effect of ordinary logging.
 */
export function collectPhotos(plant, stats) {
  const fromEvents = (stats?.photos || []).map((p) => ({
    url: p.url,
    at: p.at,
    type: p.type,
    eventId: p.eventId,
  }));
  // The profile picture may predate any event, or have been set in the form.
  const cover = plant.photo?.url
    ? [{ url: plant.photo.url, at: toDate(plant.createdAt) || new Date(), type: 'photo', cover: true }]
    : [];
  const seen = new Set();
  return [...fromEvents, ...cover]
    .filter((p) => p.url && !seen.has(p.url) && seen.add(p.url))
    .sort((a, b) => b.at - a.at);
}

/** Photos grouped by the month they were taken, newest first. */
function byMonth(photos, fmtMonth) {
  const out = [];
  for (const p of photos) {
    const label = fmtMonth(p.at);
    if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
    out[out.length - 1].items.push(p);
  }
  return out;
}

export function Album({ plant, stats }) {
  const { t, fmtMonth, fmtDate } = useI18n();
  const photos = useMemo(() => collectPhotos(plant, stats), [plant, stats]);
  const [openAt, setOpenAt] = useState(null);
  const groups = useMemo(() => byMonth(photos, fmtMonth), [photos, fmtMonth]);

  if (!photos.length)
    return <EmptyState emoji="📷" title={t('gallery.title')} body={t('gallery.empty')} />;

  const span =
    photos.length > 1 ? daysBetween(photos[photos.length - 1].at, photos[0].at) : null;

  return (
    <div>
      <div className="row-between" style={{ marginBlockEnd: 12 }}>
        <p className="small muted">
          {photos.length === 1 ? t('gallery.countOne') : t('gallery.count', { n: photos.length })}
        </p>
        {span > 0 && <p className="tiny muted">{t('gallery.spanning', { n: span })}</p>}
      </div>

      {groups.map((g) => (
        <section key={g.label} style={{ marginBlockEnd: 18 }}>
          <div className="lbl" style={{ marginBlockEnd: 8 }}>
            {g.label}
          </div>
          <div className="gal">
            {g.items.map((p) => (
              <button key={p.url} onClick={() => setOpenAt(photos.indexOf(p))}>
                <img src={p.url} alt="" loading="lazy" />
                <span className="cap">
                  {eventType(p.type).icon} {fmtDate(p.at, { day: 'numeric', month: 'short' })}
                </span>
              </button>
            ))}
          </div>
        </section>
      ))}

      {openAt != null && (
        <Lightbox photos={photos} index={openAt} onIndex={setOpenAt} onClose={() => setOpenAt(null)} plant={plant} />
      )}
    </div>
  );
}

/** Full-screen viewer with keyboard and on-screen paging. */
function Lightbox({ photos, index, onIndex, onClose, plant }) {
  const { t, fmtDate, relTime } = useI18n();
  const photo = photos[index];

  const go = useCallback(
    (delta) => onIndex((i) => Math.min(photos.length - 1, Math.max(0, i + delta))),
    [onIndex, photos.length],
  );

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
      // Newer photos sit at index 0, so "next" in reading order walks backwards
      // in time — the arrows follow the pictures, not the array.
      if (e.key === 'ArrowRight') go(1);
      if (e.key === 'ArrowLeft') go(-1);
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [go, onClose]);

  return createPortal(
    <div className="lightbox" role="dialog" aria-modal="true" aria-label={t('gallery.title')}>
      <button className="btn icon close" onClick={onClose} aria-label={t('common.close')}>
        <IconClose />
      </button>

      <div className="lb-stage">
        {index < photos.length - 1 && (
          <button className="lb-nav prev" onClick={() => go(1)} aria-label={t('common.back')}>
            <IconChevron className="flip-rtl" style={{ transform: 'scaleX(-1)' }} />
          </button>
        )}
        <img src={photo.url} alt={t('a11y.photoOf', { name: plant.name })} />
        {index > 0 && (
          <button className="lb-nav next" onClick={() => go(-1)} aria-label={t('common.next')}>
            <IconChevron className="flip-rtl" />
          </button>
        )}
      </div>

      <div className="cap">
        <Bidi>
          {eventType(photo.type).icon} {t(`enum.eventType.${photo.type}`)}
        </Bidi>
        <div>
          {fmtDate(photo.at, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · {relTime(photo.at)}
        </div>
        <div className="tiny" style={{ opacity: 0.6, marginBlockStart: 4 }}>
          {index + 1} / {photos.length}
        </div>
      </div>
    </div>,
    document.body,
  );
}

/**
 * The strip shown on a plant's overview: the album is the point of the app, so
 * it should not be buried behind a tab.
 */
export function AlbumStrip({ plant, stats, onSeeAll }) {
  const { t, fmtDate } = useI18n();
  const photos = useMemo(() => collectPhotos(plant, stats), [plant, stats]);
  if (photos.length < 2) return null;
  return (
    <section className="card pad">
      <div className="section-head">
        <h3>{t('gallery.title')}</h3>
        <button className="link" onClick={onSeeAll}>
          {t('common.seeAll')}
        </button>
      </div>
      <div className="strip">
        {photos.slice(0, 10).map((p) => (
          <figure key={p.url}>
            <img src={p.url} alt="" loading="lazy" />
            <figcaption>{fmtDate(p.at, { day: 'numeric', month: 'short' })}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
