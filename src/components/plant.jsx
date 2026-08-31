import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { Badge, Bidi, Num } from './ui.jsx';
import { IconChevron, IconDrop, IconStar } from './icons.jsx';

/** One place that turns a computed state into a colour + words. */
export function statusInfo(plant, s, t) {
  if (plant.status === 'archived') return { tone: 'neutral', label: t('status.archived') };
  if (plant.status === 'dead') return { tone: 'neutral', label: t('status.dead') };
  if (plant.status === 'gifted') return { tone: 'neutral', label: t('status.gifted') };
  switch (s.state) {
    case 'due':
      return {
        tone: s.isWater ? 'blue' : 'amber',
        label: s.isWater ? t('status.dueWater') : t('status.due'),
      };
    case 'check':
      return { tone: 'amber', label: t('status.check') };
    case 'fine':
      return { tone: 'green', label: t('status.fine') };
    default:
      return { tone: 'neutral', label: t('status.unknown') };
  }
}

export function PhotoOrPlaceholder({ photo, name, className = '', emoji = '🪴' }) {
  const { t } = useI18n();
  if (photo?.url)
    return <img className={className} src={photo.url} alt={t('a11y.photoOf', { name })} loading="lazy" />;
  return (
    <div className={`${className} ph`} aria-hidden="true">
      {emoji}
    </div>
  );
}

export function PlantCard({ plant, stats: s, onQuickLog }) {
  const { t, relTime } = useI18n();
  const st = statusInfo(plant, s, t);
  const waterLabel = s.isWater ? t('plants.lastWaterChange') : t('plants.lastWater');

  return (
    <article className="pcard">
      <Link
        to={`/plant/${plant.id}`}
        className="thumb"
        aria-label={t('a11y.openPlant', { name: plant.name })}
      >
        <PhotoOrPlaceholder photo={plant.photo} name={plant.name} />
        <span className="pin">
          <Badge tone={st.tone}>{st.label}</Badge>
        </span>
        {plant.favorite && (
          <span className="fav" aria-hidden="true">
            ⭐
          </span>
        )}
      </Link>
      <div className="body">
        <div>
          <Link to={`/plant/${plant.id}`} style={{ color: 'inherit', textDecoration: 'none' }}>
            <Bidi as="div" className="name">
              {plant.name}
            </Bidi>
          </Link>
          {plant.species && (
            <Bidi as="div" className="sci">
              {plant.species}
            </Bidi>
          )}
        </div>
        <div className="facts">
          <span>
            {waterLabel}:{' '}
            <b>
              {s.lastWater ? <Num>{relTime(s.lastWater.at)}</Num> : t('common.never')}
            </b>
          </span>
          {plant.room && (
            <span>
              <Bidi>{plant.room}</Bidi>
            </span>
          )}
          {s.openIssues.length > 0 && <Badge tone="red">{t('status.issue')}</Badge>}
        </div>
        <div className="card-actions">
          <button
            className="btn soft"
            onClick={() => onQuickLog(plant)}
            aria-label={t('a11y.quickWater', { name: plant.name })}
          >
            <IconDrop />
            {s.isWater ? t('actions.waterChange') : t('actions.water')}
          </button>
          <Link className="btn" to={`/plant/${plant.id}`}>
            {t('actions.openPlant')}
          </Link>
        </div>
      </div>
    </article>
  );
}

/** Compact row used by the home screen's attention list. */
export function AttentionRow({ plant, stats: s, attention, onQuickLog }) {
  const { t } = useI18n();
  const top = attention.reasons[0];
  const reason = t(`home.reasons.${top.key}`, top.vars);

  return (
    <div className="att">
      <Link
        to={`/plant/${plant.id}`}
        className="row grow"
        style={{ color: 'inherit', textDecoration: 'none', gap: 12, minWidth: 0 }}
      >
        <PhotoOrPlaceholder photo={plant.photo} name={plant.name} className="av" />
        <span className="meta">
          <Bidi as="span" className="n" style={{ display: 'block' }}>
            {plant.name}
          </Bidi>
          <span className="r">
            <Badge tone={top.tone}>{reason}</Badge>
          </span>
        </span>
      </Link>
      <button
        className="btn icon filled go"
        onClick={() => onQuickLog(plant)}
        aria-label={t('a11y.quickWater', { name: plant.name })}
        title={s.isWater ? t('actions.waterChange') : t('actions.water')}
      >
        <IconDrop />
      </button>
    </div>
  );
}

export function FavoriteButton({ plant, onToggle }) {
  const { t } = useI18n();
  return (
    <button
      className="btn icon"
      aria-pressed={plant.favorite}
      aria-label={plant.favorite ? t('actions.unfavorite') : t('actions.favorite')}
      onClick={() => onToggle(plant)}
    >
      <IconStar filled={plant.favorite} />
    </button>
  );
}

export function ListRow({ to, lead, title, subtitle, trail, onClick }) {
  const inner = (
    <>
      {lead && <span className="lead">{lead}</span>}
      <span className="txt">
        <Bidi as="b">{title}</Bidi>
        {subtitle && <Bidi as="small">{subtitle}</Bidi>}
      </span>
      {trail !== undefined ? (
        <span className="trail">{trail}</span>
      ) : (
        <IconChevron className="flip-rtl" width={17} height={17} style={{ color: 'var(--muted)' }} />
      )}
    </>
  );
  if (to)
    return (
      <Link className="list-row" to={to} style={{ color: 'inherit', textDecoration: 'none' }}>
        {inner}
      </Link>
    );
  return (
    <button className="list-row" onClick={onClick} type="button">
      {inner}
    </button>
  );
}
