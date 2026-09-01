import { useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import {
  Sheet,
  Confirm,
  EmptyState,
  Badge,
  Bidi,
  Num,
  TextField,
  useToast,
} from '../components/ui.jsx';
import { PhotoOrPlaceholder, statusInfo, FavoriteButton, ListRow } from '../components/plant.jsx';
import { EventSheet } from '../components/eventSheet.jsx';
import { LineChart } from '../components/chart.jsx';
import { PlantChat } from '../components/plantChat.jsx';
import { Album, AlbumStrip } from '../components/album.jsx';
import { IconMore, IconEdit, IconTrash, IconRuler, IconPlus } from '../components/icons.jsx';
import { eventType, METRIC_UNITS } from '../lib/domain.js';
import { waterEventType, isWaterMedium } from '../data/model.js';
import { growthRate } from '../lib/stats.js';
import { daysBetween } from '../lib/format.js';

const TABS = ['ask', 'overview', 'timeline', 'growth', 'health', 'gallery', 'details'];

export default function PlantDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();

  const plant = store.plantById(id);
  const s = store.statsFor(id);
  const [tab, setTab] = useState('ask');
  const [sheet, setSheet] = useState(null); // { type, issue } | 'menu' | 'pick'
  const [confirm, setConfirm] = useState(null);

  if (!plant) {
    return (
      <>
        <TopBar back title={t('common.error')} />
        <main className="content" id="main">
          <EmptyState emoji="🤔" title={t('common.error')} action={<Link className="btn" to="/jungle">{t('plants.title')}</Link>} />
        </main>
      </>
    );
  }

  const st = statusInfo(plant, s, t);

  return (
    <>
      <TopBar
        back
        title={plant.name}
        actions={
          <>
            <FavoriteButton plant={plant} onToggle={store.toggleFavorite} />
            <button className="btn icon" onClick={() => setSheet({ menu: true })} aria-label={t('actions.moreActions')}>
              <IconMore />
            </button>
          </>
        }
      />

      <main className="content" id="main">
        <div className="hero">
          <PhotoOrPlaceholder photo={plant.photo} name={plant.name} />
          <div className="veil" />
          <div className="cap">
            <Bidi as="h2">{plant.name}</Bidi>
            {plant.species && <Bidi as="div" className="sci">{plant.species}</Bidi>}
            <div className="wrap-row" style={{ marginBlockStart: 8 }}>
              <Badge tone={st.tone}>{st.label}</Badge>
              {plant.kind === 'cutting' && <Badge tone="green">{t('enum.kind.cutting')}</Badge>}
              {s.openIssues.length > 0 && <Badge tone="red">{t('status.issue')}</Badge>}
            </div>
          </div>
        </div>

        <QuickActions plant={plant} onPick={setSheet} />

        <div className="tabs" role="tablist" aria-label={plant.name}>
          {TABS.map((k) => (
            <button
              key={k}
              role="tab"
              aria-selected={tab === k}
              onClick={() => setTab(k)}
            >
              {k === 'ask' ? `✨ ${t('ai.ask')}` : t(`plant.${k}`)}
            </button>
          ))}
        </div>

        <div role="tabpanel" style={{ paddingBlockStart: 16 }}>
          {tab === 'ask' && <PlantChat plant={plant} stats={s} />}
          {tab === 'overview' && (
            <Overview plant={plant} s={s} onOpenEvent={(x) => setSheet(x)} onSeeAlbum={() => setTab('gallery')} />
          )}
          {tab === 'timeline' && <Timeline plant={plant} s={s} onAdd={() => setSheet({ pick: true })} />}
          {tab === 'growth' && <Growth plant={plant} s={s} onAdd={() => setSheet({ type: 'growth' })} />}
          {tab === 'health' && <Health plant={plant} s={s} onOpen={(x) => setSheet(x)} />}
          {tab === 'gallery' && <Album plant={plant} stats={s} />}
          {tab === 'details' && <Details plant={plant} s={s} onConfirm={setConfirm} />}
        </div>
      </main>

      {sheet?.menu && (
        <ActionMenu
          plant={plant}
          s={s}
          onClose={() => setSheet(null)}
          onEvent={(type) => setSheet({ type })}
          onConfirm={(c) => {
            setSheet(null);
            setConfirm(c);
          }}
        />
      )}

      {(sheet?.type || sheet?.pick) && (
        <EventSheet
          open
          plant={plant}
          type={sheet.type}
          issue={sheet.issue}
          onClose={() => setSheet(null)}
        />
      )}

      <ConfirmHost
        confirm={confirm}
        plant={plant}
        onClose={() => setConfirm(null)}
        onDone={(msg, goHome) => {
          setConfirm(null);
          toast(msg);
          if (goHome) nav('/jungle', { replace: true });
        }}
      />

    </>
  );
}

/* ------------------------------------------------------------------ pieces */

function QuickActions({ plant, onPick }) {
  const { t } = useI18n();
  const water = waterEventType(plant);
  const items = [
    { type: water, icon: '💧', label: isWaterMedium(plant) ? t('actions.waterChange') : t('actions.water'), hero: true },
    { type: 'check', icon: '👀', label: t('actions.checkOnly') },
    { type: 'growth', icon: '📏', label: t('actions.measure') },
    { type: 'fertilize', icon: '🧪', label: t('actions.fertilize') },
    { type: 'photo', icon: '📷', label: t('common.photo') },
    { type: null, icon: '＋', label: t('actions.addEvent') },
  ];
  return (
    <div className="quickbar">
      {items.map((it, i) => (
        <button
          key={i}
          className={`qa${it.hero ? ' hero-act' : ''}`}
          onClick={() => onPick(it.type ? { type: it.type } : { pick: true })}
        >
          <span className="ic" aria-hidden="true">{it.icon}</span>
          <span>{it.label}</span>
        </button>
      ))}
    </div>
  );
}

function Overview({ plant, s, onOpenEvent, onSeeAlbum }) {
  const { t, days, relTime, fmtDate, length } = useI18n();
  const store = useStore();
  const children = store.childrenFor(plant.id);
  const parent = plant.parentId ? store.plantById(plant.parentId) : null;

  const nextText =
    s.daysToNext == null
      ? t('status.explainNever')
      : s.daysToNext <= 0
        ? t('status.due')
        : days(s.daysToNext);

  return (
    <div className="stack">
      {plant.status !== 'active' && (
        <div className="banner">{plant.status === 'dead' ? t('plant.deadNotice') : t('plant.archivedNotice')}</div>
      )}

      <section className="card pad">
        <div className="section-head">
          <h3>{t('care.title')}</h3>
          <span className="tiny muted">
            {s.windowSource === 'history'
              ? t('insights.evidence', { n: s.waterCount })
              : t('care.ruleTitle')}
          </span>
        </div>
        <div className="grid-2" style={{ gap: 8 }}>
          <div className="tile">
            <small>{s.isWater ? t('plants.lastWaterChange') : t('care.lastWater')}</small>
            <b>{s.lastWater ? <Num>{relTime(s.lastWater.at)}</Num> : t('common.never')}</b>
          </div>
          <div className="tile">
            <small>{t('plants.nextCheck')}</small>
            <b>{nextText}</b>
          </div>
          <div className="tile">
            <small>{t('care.avgInterval')}</small>
            <b>
              {s.medianInterval ? (
                <Num>{t('care.everyNDays', { n: s.medianInterval })}</Num>
              ) : s.avgInterval ? (
                <Num>{t('care.everyNDays', { n: s.avgInterval })}</Num>
              ) : (
                t('common.notEnoughData')
              )}
            </b>
          </div>
          <div className="tile">
            <small>{t('plants.typicalRange')}</small>
            <b>{t('common.days', { n: `${s.window[0]}–${s.window[1]}` })}</b>
          </div>
        </div>
        <p className="tiny muted" style={{ marginBlockStart: 10 }}>
          💡 {t('care.checkNotWater')}
        </p>
        {s.moistStreak >= 2 && (
          <div className="banner info" style={{ marginBlockStart: 10 }}>
            {t('care.soilWasMoist', { n: s.moistStreak })}
          </div>
        )}
        {plant.care.checkNote && (
          <p className="small" style={{ marginBlockStart: 10 }}>
            <Bidi>{plant.care.checkNote}</Bidi>
          </p>
        )}
      </section>

      <AlbumStrip plant={plant} stats={s} onSeeAll={onSeeAlbum} />

      <section className="card pad">
        <h3 style={{ marginBlockEnd: 10 }}>{t('plant.details')}</h3>
        <div className="grid-2" style={{ gap: 8 }}>
          <Tile label={t('plant.fields.room')} value={plant.room} />
          <Tile label={t('plant.fields.light')} value={t(`enum.light.${plant.light}`)} />
          <Tile label={t('plant.fields.medium')} value={t(`enum.medium.${plant.medium}`)} />
          <Tile label={t('plant.fields.potSize')} value={length(plant.pot?.sizeCm)} />
          <Tile label={t('care.lastFert')} value={s.lastFert ? relTime(s.lastFert.at) : t('fert.never')} />
          <Tile label={t('care.lastRepot')} value={s.lastRepot ? relTime(s.lastRepot.at) : t('common.never')} />
        </div>
      </section>

      {(parent || children.length > 0 || plant.kind === 'cutting') && (
        <section className="card pad">
          <h3 style={{ marginBlockEnd: 10 }}>{t('plant.family')}</h3>
          {plant.parentId && !parent && <p className="small muted">{t('plant.parentMissing')}</p>}
          {parent && (
            <div className="list" style={{ marginBlockEnd: children.length ? 10 : 0 }}>
              <ListRow to={`/plant/${parent.id}`} lead="🌿" title={parent.name} subtitle={t('plant.childOf')} />
            </div>
          )}
          {children.length > 0 && (
            <>
              <div className="lbl" style={{ marginBlockEnd: 6 }}>
                {t('plant.parentOf')} · {children.length}
              </div>
              <div className="list">
                {children.map((c) => (
                  <ListRow key={c.id} to={`/plant/${c.id}`} lead="🌱" title={c.name} subtitle={c.species} />
                ))}
              </div>
            </>
          )}
          {plant.kind === 'cutting' && (
            <div className="grid-2" style={{ gap: 8, marginBlockStart: 10 }}>
              <Tile
                label={t('prop.takenAt')}
                value={s.propagation.takenAt ? fmtDate(s.propagation.takenAt) : '—'}
              />
              <Tile
                label={t('prop.state')}
                value={t(`enum.propagationOutcome.${s.propagation.outcome}`)}
              />
              <Tile
                label={t('prop.firstRoots')}
                value={
                  s.propagation.daysToRoot != null
                    ? t('prop.daysToRoot', { n: s.propagation.daysToRoot })
                    : s.propagation.daysRooting != null
                      ? t('prop.daysRooting', { n: s.propagation.daysRooting })
                      : null
                }
              />
            </div>
          )}
        </section>
      )}

      {s.openIssues.length > 0 && (
        <section className="card pad">
          <h3 style={{ marginBlockEnd: 10 }}>{t('health.open')}</h3>
          <div className="list">
            {s.openIssues.map((i) => (
              <ListRow
                key={i.id}
                lead="⚠️"
                title={t(`enum.healthIssue.${i.data?.issue || 'other'}`)}
                subtitle={t('health.openFor', { n: i.openDays })}
                onClick={() => onOpenEvent({ type: 'healthUpdate', issue: i })}
              />
            ))}
          </div>
        </section>
      )}

      {(plant.notes || plant.tags.length > 0) && (
        <section className="card pad">
          {plant.notes && (
            <p style={{ fontSize: 14, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>
              <Bidi>{plant.notes}</Bidi>
            </p>
          )}
          {plant.tags.length > 0 && (
            <div className="wrap-row" style={{ marginBlockStart: plant.notes ? 10 : 0 }}>
              {plant.tags.map((x) => (
                <span key={x} className="tagpill">
                  <Bidi>#{x}</Bidi>
                </span>
              ))}
            </div>
          )}
        </section>
      )}
    </div>
  );
}

const Tile = ({ label, value }) =>
  value ? (
    <div className="tile">
      <small>{label}</small>
      <b>
        <Bidi>{value}</Bidi>
      </b>
    </div>
  ) : null;

function Timeline({ plant, s, onAdd }) {
  const { t, fmtDate, fmtTime } = useI18n();
  const store = useStore();
  const [filter, setFilter] = useState('all');
  const [menu, setMenu] = useState(null);

  const groups = useMemo(() => {
    const list = filter === 'all' ? s.events : s.events.filter((e) => eventType(e.type).group === filter);
    const out = [];
    let key = null;
    for (const e of list) {
      const d = fmtDate(e.at, { day: 'numeric', month: 'long', year: 'numeric' });
      if (d !== key) {
        key = d;
        out.push({ day: d, items: [] });
      }
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [s.events, filter, fmtDate]);

  if (!s.events.length)
    return (
      <EmptyState
        emoji="📖"
        title={t('timeline.title')}
        body={t('timeline.empty')}
        action={
          <button className="btn primary" onClick={onAdd}>
            {t('timeline.addFirst')}
          </button>
        }
      />
    );

  const groupsAvailable = [...new Set(s.events.map((e) => eventType(e.type).group))];

  return (
    <div>
      <div className="scroller" style={{ marginBlockEnd: 14 }}>
        <button className={`chip${filter === 'all' ? ' on' : ''}`} onClick={() => setFilter('all')}>
          {t('timeline.filterAll')}
        </button>
        {groupsAvailable.map((g) => (
          <button key={g} className={`chip${filter === g ? ' on' : ''}`} onClick={() => setFilter(g)}>
            {t(`enum.eventGroup.${g}`)}
          </button>
        ))}
      </div>

      {groups.length === 0 && <p className="small muted">{t('timeline.emptyFiltered')}</p>}

      <div className="tl">
        {groups.map((g) => (
          <div key={g.day}>
            <div className="tl-day">{g.day}</div>
            {g.items.map((e) => (
              <article className="tl-item" key={e.id}>
                <span className="dot" aria-hidden="true">
                  {eventType(e.type).icon}
                </span>
                <div className="row-between">
                  <div className="grow">
                    <div className="ttl">
                      {e.type === 'custom' && e.data?.title ? (
                        <Bidi>{e.data.title}</Bidi>
                      ) : (
                        t(`enum.eventType.${e.type}`)
                      )}
                    </div>
                    <div className="when">
                      {t('timeline.at')} {fmtTime(e.at)}
                    </div>
                  </div>
                  <button
                    className="btn icon sm"
                    aria-label={t('actions.moreActions')}
                    onClick={() => setMenu(e)}
                  >
                    <IconMore width={16} height={16} />
                  </button>
                </div>
                <EventDetails event={e} plant={plant} />
                {e.note && (
                  <div className="body">
                    <Bidi>{e.note}</Bidi>
                  </div>
                )}
                {e.photos?.length > 0 && (
                  <div className="shots">
                    {e.photos.map((p, i) => (
                      <img key={i} src={p.url} alt="" loading="lazy" />
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        ))}
      </div>

      <Confirm
        open={!!menu}
        title={t('timeline.deleteEvent')}
        body={t('timeline.deleteEventBody')}
        confirmLabel={t('common.delete')}
        danger
        onClose={() => setMenu(null)}
        onConfirm={async () => {
          await store.deleteEvent(menu.id);
          setMenu(null);
        }}
      />
    </div>
  );
}

/** Renders the type-specific payload of one event as compact key/value chips. */
function EventDetails({ event: e, plant }) {
  const { t, length, volume, fmtNumber } = useI18n();
  const d = e.data || {};
  const bits = [];
  const push = (label, value) => value != null && value !== '' && bits.push({ label, value });

  push(t('water.amount'), d.amountMl != null ? volume(d.amountMl) : null);
  push(t('water.percentReplaced'), d.percent != null ? `${fmtNumber(d.percent, 0)}%` : null);
  push(t('water.soilBefore'), d.soil ? t(`enum.soilState.${d.soil}`) : null);
  push(t('water.drained'), d.drained === 'yes' ? t('common.yes') : d.drained === 'no' ? t('common.no') : null);
  push(t('fert.product'), d.product);
  push(t('fert.dose'), d.dose);
  push(t('fert.dilution'), d.dilution);
  push(t('fert.method'), d.method ? t(`enum.applicationMethod.${d.method}`) : null);
  push(t('health.issue'), d.issue ? t(`enum.healthIssue.${d.issue}`) : null);
  push(t('health.severity'), d.severity ? t(`health.severities.${d.severity}`) : null);
  push(t('health.outcome'), d.outcome ? t(`health.outcomes.${d.outcome}`) : null);
  push(t('health.action'), d.action);
  push(t('event.pest'), d.pest ? t(`enum.pest.${d.pest}`) : null);
  push(t('event.treatment'), d.treatment);
  push(t('repot.fromSize'), d.fromSizeCm != null ? length(d.fromSizeCm) : null);
  push(t('repot.toSize'), d.toSizeCm != null ? length(d.toSizeCm) : null);
  push(t('repot.toSubstrate'), d.toSubstrate);
  push(t('repot.rootCondition'), d.rootCondition ? t(`enum.rootCondition.${d.rootCondition}`) : null);
  push(t('repot.rootTreatment'), d.rootTreatment);
  push(t('event.rootObservation'), d.observation);
  push(t('prop.rootLength'), d.rootLengthCm != null ? length(d.rootLengthCm) : null);
  push(t('plant.fields.room'), d.toRoom);
  push(t('plant.fields.location'), d.toLocation);
  push(t('plant.fields.status'), d.status ? t(`enum.plantStatus.${d.status}`) : null);

  if (d.values) {
    for (const [k, v] of Object.entries(d.values)) {
      push(t(`growth.metricsShort.${k}`), METRIC_UNITS[k] === 'length' ? length(v) : fmtNumber(v, 0));
    }
  }

  if (!bits.length) return null;
  return (
    <div className="kv">
      {bits.map((b, i) => (
        <span key={i} className="muted">
          {b.label}: <b style={{ color: 'var(--ink)' }}><Bidi>{b.value}</Bidi></b>
        </span>
      ))}
    </div>
  );
}

function Growth({ plant, s, onAdd }) {
  const { t, length, fmtNumber, fmtDate, lengthUnit } = useI18n();
  const available = Object.keys(s.series).filter((k) => s.series[k].length >= 1);
  const [metric, setMetric] = useState(available[0] || plant.metrics[0]);
  const points = s.series[metric] || [];
  const rate = growthRate(points);
  const isLength = METRIC_UNITS[metric] === 'length';
  const fmt = (v) => (isLength ? length(v) : fmtNumber(v, 0));

  return (
    <div className="stack">
      <div className="row-between">
        <h3>{t('growth.chartTitle')}</h3>
        <button className="btn sm primary" onClick={onAdd}>
          <IconRuler /> {t('actions.measure')}
        </button>
      </div>

      {available.length === 0 ? (
        <EmptyState emoji="📏" title={t('common.notEnoughData')} body={t('growth.firstMeasurement')} />
      ) : (
        <>
          <div className="scroller">
            {available.map((k) => (
              <button key={k} className={`chip${metric === k ? ' on' : ''}`} onClick={() => setMetric(k)}>
                {t(`growth.metricsShort.${k}`)}
              </button>
            ))}
          </div>

          {points.length >= 2 ? (
            <div className="card pad">
              <div className="row-between" style={{ marginBlockEnd: 4 }}>
                <span className="lbl">{t(`growth.metricsShort.${metric}`)}</span>
                {isLength && <span className="tiny muted">{lengthUnit()}</span>}
              </div>
              <LineChart points={points} label={t(`growth.metricsShort.${metric}`)} />
              <div className="grid-2" style={{ gap: 8, marginBlockStart: 10 }}>
                <div className="tile">
                  <small>{t('growth.change')}</small>
                  <b>
                    <Num>
                      {points[points.length - 1].value > points[0].value ? '+' : ''}
                      {fmt(points[points.length - 1].value - points[0].value)}
                    </Num>
                  </b>
                </div>
                <div className="tile">
                  <small>{t('growth.rate')}</small>
                  <b>
                    <Num>{rate != null ? t('growth.perMonth', { v: fmt(rate) }) : '—'}</Num>
                  </b>
                </div>
              </div>
            </div>
          ) : (
            <p className="small muted">{t('growth.firstMeasurement')}</p>
          )}

          <div className="list">
            {[...s.growth].reverse().map((g) => (
              <div className="list-row" key={g.id}>
                <span className="txt">
                  <b>{fmtDate(g.date)}</b>
                  <small>
                    {Object.entries(g.values)
                      .map(
                        ([k, v]) =>
                          `${t(`growth.metricsShort.${k}`)} ${METRIC_UNITS[k] === 'length' ? length(v) : v}`,
                      )
                      .join(' · ')}
                  </small>
                </span>
              </div>
            ))}
          </div>
        </>
      )}

      <PhotoCompare s={s} />
    </div>
  );
}

function PhotoCompare({ s }) {
  const { t, fmtDate } = useI18n();
  if (s.photos.length < 2) return null;
  const latest = s.photos[0];
  const first = s.photos[s.photos.length - 1];
  const apart = daysBetween(first.at, latest.at);
  return (
    <section className="card pad">
      <h3 style={{ marginBlockEnd: 10 }}>{t('growth.compare')}</h3>
      <div className="compare">
        <figure>
          <img src={first.url} alt="" loading="lazy" />
          <figcaption>
            {t('gallery.first')} · {fmtDate(first.at)}
          </figcaption>
        </figure>
        <figure>
          <img src={latest.url} alt="" loading="lazy" />
          <figcaption>
            {t('gallery.latest')} · {fmtDate(latest.at)}
          </figcaption>
        </figure>
      </div>
      <p className="tiny muted center" style={{ marginBlockStart: 8 }}>
        {t('gallery.apart', { n: apart })}
      </p>
    </section>
  );
}

function Health({ plant, s, onOpen }) {
  const { t } = useI18n();
  const open = s.issues.filter((i) => i.open);
  const closed = s.issues.filter((i) => !i.open);

  return (
    <div className="stack">
      <div className="row-between">
        <h3>{t('health.title')}</h3>
        <button className="btn sm primary" onClick={() => onOpen({ type: 'health' })}>
          <IconPlus /> {t('health.newIssue')}
        </button>
      </div>

      {s.issues.length === 0 && <EmptyState emoji="🌿" title={t('health.noIssues')} />}

      {open.length > 0 && (
        <section>
          <div className="lbl" style={{ marginBlockEnd: 8 }}>{t('health.open')}</div>
          {open.map((i) => (
            <IssueCard key={i.id} issue={i} onUpdate={() => onOpen({ type: 'healthUpdate', issue: i })} />
          ))}
        </section>
      )}

      {closed.length > 0 && (
        <section>
          <div className="lbl" style={{ marginBlockEnd: 8 }}>{t('health.resolved')}</div>
          {closed.map((i) => (
            <IssueCard key={i.id} issue={i} resolved />
          ))}
        </section>
      )}
    </div>
  );
}

function IssueCard({ issue: i, onUpdate, resolved }) {
  const { t, fmtDate } = useI18n();
  return (
    <div className="card pad" style={{ marginBlockEnd: 10 }}>
      <div className="row-between">
        <div>
          <b>{t(`enum.healthIssue.${i.data?.issue || 'other'}`)}</b>
          <div className="tiny muted">
            {t('health.openedOn', { date: fmtDate(i.startedAt) })}
            {' · '}
            {resolved
              ? t('health.resolvedAfter', { n: i.openDays })
              : t('health.openFor', { n: i.openDays })}
          </div>
        </div>
        <Badge tone={resolved ? 'green' : 'red'}>
          {resolved ? t('health.outcomes.resolved') : t('health.openBadge')}
        </Badge>
      </div>
      {i.note && (
        <p className="small" style={{ marginBlockStart: 8 }}>
          <Bidi>{i.note}</Bidi>
        </p>
      )}
      {i.photos?.length > 0 && (
        <div className="shots" style={{ display: 'flex', gap: 6, marginBlockStart: 8 }}>
          {i.photos.map((p, k) => (
            <img key={k} src={p.url} alt="" style={{ width: 70, height: 70, objectFit: 'cover', borderRadius: 10 }} />
          ))}
        </div>
      )}
      {i.updates.length > 0 && (
        <ul className="small" style={{ marginBlockStart: 10, color: 'var(--muted)' }}>
          {i.updates.map((u) => (
            <li key={u.id}>
              {fmtDate(u.at)} — {t(`health.outcomes.${u.data?.outcome || 'same'}`)}
              {u.data?.action ? ` · ${u.data.action}` : ''}
            </li>
          ))}
        </ul>
      )}
      {!resolved && (
        <button className="btn sm" style={{ marginBlockStart: 10 }} onClick={onUpdate}>
          {t('health.addUpdate')}
        </button>
      )}
    </div>
  );
}

function Details({ plant, s, onConfirm }) {
  const { t, fmtDate, length } = useI18n();
  const rows = [
    [t('plant.fields.species'), plant.species],
    [t('plant.fields.cultivar'), plant.cultivar],
    [t('plant.fields.kind'), t(`enum.kind.${plant.kind}`)],
    [t('plant.fields.acquiredAt'), plant.acquiredAt ? fmtDate(plant.acquiredAt) : null],
    [t('plant.fields.source'), plant.source],
    [t('plant.fields.room'), plant.room],
    [t('plant.fields.location'), plant.location],
    [t('plant.fields.light'), t(`enum.light.${plant.light}`)],
    [t('plant.fields.windowDirection'), t(`enum.windowDirection.${plant.windowDirection}`)],
    [t('plant.fields.medium'), t(`enum.medium.${plant.medium}`)],
    [t('plant.fields.potType'), plant.pot?.type ? t(`enum.potType.${plant.pot.type}`) : null],
    [t('plant.fields.potMaterial'), plant.pot?.material ? t(`enum.potMaterial.${plant.pot.material}`) : null],
    [t('plant.fields.potSize'), length(plant.pot?.sizeCm)],
    [t('plant.fields.substrate'), plant.substrate],
    [t('plant.fields.drainage'), t(`enum.drainage.${plant.drainage}`)],
    [t('plant.fields.dryRule'), t(`enum.dryRule.${plant.care.dryRule}`)],
    [
      t('plants.typicalRange'),
      t('common.days', { n: `${plant.care.checkMinDays}–${plant.care.checkMaxDays}` }),
    ],
    [t('plant.fields.status'), t(`enum.plantStatus.${plant.status}`)],
    [t('plant.addedOn', { date: '' }).trim(), plant.createdAt ? fmtDate(plant.createdAt) : null],
  ].filter(([, v]) => v);

  return (
    <div className="stack">
      <Link className="btn block" to={`/plant/${plant.id}/edit`}>
        <IconEdit /> {t('actions.editPlant')}
      </Link>
      <p className="tiny muted center">{t('plant.historySafe')}</p>

      <div className="list">
        {rows.map(([k, v]) => (
          <div className="list-row" key={k}>
            <span className="txt">
              <small>{k}</small>
              <Bidi as="b" style={{ fontSize: 14.5 }}>
                {v}
              </Bidi>
            </span>
          </div>
        ))}
      </div>

      <section>
        <div className="lbl" style={{ marginBlockEnd: 8 }}>{t('settings.dangerZone')}</div>
        <div className="col">
          {plant.status === 'active' ? (
            <button className="btn" onClick={() => onConfirm({ kind: 'archive' })}>
              {t('common.archive')}
            </button>
          ) : (
            <button className="btn" onClick={() => onConfirm({ kind: 'unarchive' })}>
              {t('common.unarchive')}
            </button>
          )}
          <button className="btn danger" onClick={() => onConfirm({ kind: 'delete' })}>
            <IconTrash /> {t('common.delete')}
          </button>
        </div>
      </section>
    </div>
  );
}

function ActionMenu({ plant, s, onClose, onEvent, onConfirm }) {
  const { t } = useI18n();
  const store = useStore();
  const nav = useNavigate();
  const toast = useToast();

  const [takeCutting, busyCutting] = useSubmit(async () => {
    const id = await store.createPlant({
      name: t('prop.cuttingName', { name: plant.name }),
      species: plant.species,
      cultivar: plant.cultivar,
      kind: 'cutting',
      parentId: plant.id,
      medium: 'water',
      room: plant.room,
      light: plant.light,
      metrics: ['rootLength'],
      care: { dryRule: 'evenMoist', checkMinDays: 4, checkMaxDays: 8, checkNote: '' },
      propagation: { method: 'water', startedAt: new Date(), outcome: 'inProgress' },
    });
    await store.addEvent(id, { type: 'cuttingTaken', at: new Date(), data: { parentId: plant.id } });
    await store.addEvent(plant.id, { type: 'cuttingTaken', at: new Date(), data: { childId: id } });
    toast(t('prop.created'));
    onClose();
    nav(`/plant/${id}`);
  });

  const [promote, busyPromote] = useSubmit(async () => {
    await store.savePlant(plant.id, {
      kind: 'plant',
      medium: 'soil',
      propagation: { ...(plant.propagation || {}), outcome: 'established' },
    });
    await store.addEvent(plant.id, { type: 'potted', at: new Date() });
    toast(t('prop.promoted'));
    onClose();
  });

  return (
    <Sheet open onClose={onClose} title={t('actions.moreActions')}>
      <div className="list">
        <ListRow to={`/plant/${plant.id}/edit`} lead="✏️" title={t('actions.editPlant')} />
        <ListRow lead="🌿" title={t('prop.createCutting')} subtitle={t('prop.createCuttingBody')} onClick={takeCutting} trail={busyCutting ? '…' : undefined} />
        {plant.kind === 'cutting' && (
          <ListRow lead="🪴" title={t('prop.promote')} subtitle={t('prop.promoteBody')} onClick={promote} trail={busyPromote ? '…' : undefined} />
        )}
        <ListRow lead="🪴" title={t('enum.eventType.repot')} onClick={() => { onClose(); onEvent('repot'); }} />
        <ListRow lead="⚠️" title={t('health.newIssue')} onClick={() => { onClose(); onEvent('health'); }} />
        <ListRow lead="📍" title={t('enum.eventType.move')} onClick={() => { onClose(); onEvent('move'); }} />
        <ListRow lead="🏷️" title={t('plant.statusTitle')} onClick={() => { onClose(); onEvent('status'); }} />
        <ListRow
          lead="📦"
          title={plant.status === 'active' ? t('common.archive') : t('common.unarchive')}
          onClick={() => onConfirm({ kind: plant.status === 'active' ? 'archive' : 'unarchive' })}
        />
        <ListRow lead="🗑️" title={t('common.delete')} onClick={() => onConfirm({ kind: 'delete' })} />
      </div>
    </Sheet>
  );
}

function ConfirmHost({ confirm, plant, onClose, onDone }) {
  const { t } = useI18n();
  const store = useStore();
  const children = store.childrenFor(plant.id);
  const [word, setWord] = useState('');

  const [run, busy] = useSubmit(async () => {
    if (confirm.kind === 'archive') {
      await store.setPlantStatus(plant.id, 'archived');
      onDone(t('plant.archived'));
    } else if (confirm.kind === 'unarchive') {
      await store.setPlantStatus(plant.id, 'active');
      onDone(t('common.updated'));
    } else if (confirm.kind === 'delete') {
      await store.deletePlant(plant.id);
      onDone(t('common.deleted'), true);
    }
  });

  if (!confirm) return null;

  if (confirm.kind === 'delete') {
    const token = t('plant.deleteConfirmToken');
    return (
      <Sheet
        open
        onClose={onClose}
        title={t('plant.deleteTitle', { name: plant.name })}
        footer={
          <>
            <button className="btn" onClick={onClose}>
              {t('common.cancel')}
            </button>
            <button className="btn danger" disabled={word.trim() !== token || busy} onClick={run}>
              {busy ? t('common.saving') : t('common.delete')}
            </button>
          </>
        }
      >
        <p className="small">{t('plant.deleteBody')}</p>
        {children.length > 0 && (
          <div className="banner" style={{ marginBlock: 12 }}>
            {t('plant.childrenWarning', { n: children.length })}
          </div>
        )}
        <TextField
          label={t('plant.deleteConfirmWord')}
          value={word}
          onChange={(e) => setWord(e.target.value)}
          placeholder={token}
        />
      </Sheet>
    );
  }

  return (
    <Confirm
      open
      busy={busy}
      title={
        confirm.kind === 'archive'
          ? t('plant.archiveTitle', { name: plant.name })
          : t('common.unarchive')
      }
      body={confirm.kind === 'archive' ? t('plant.archiveBody') : ''}
      confirmLabel={confirm.kind === 'archive' ? t('common.archive') : t('common.restore')}
      onConfirm={run}
      onClose={onClose}
    />
  );
}
