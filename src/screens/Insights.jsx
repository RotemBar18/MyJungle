import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { EmptyState, Bidi } from '../components/ui.jsx';
import { BarRow, Spark } from '../components/chart.jsx';
import { buildInsights, summarize } from '../lib/insights.js';

export default function Insights() {
  const { t, length, days } = useI18n();
  const { plants, events, stats, attention } = useStore();

  const sum = useMemo(() => summarize(plants, stats, events), [plants, stats, events]);
  const cards = useMemo(
    () => buildInsights({ plants, stats, lengthFmt: (v) => length(v) }),
    [plants, stats, length],
  );

  const tiles = [
    { v: sum.plants, l: t('insights.totalPlants') },
    { v: sum.cuttings, l: t('insights.totalCuttings') },
    { v: attention.size, l: t('insights.needAttention') },
    { v: sum.openIssues, l: t('insights.openIssues') },
    { v: sum.waterThisWeek, l: t('insights.waterThisWeek') },
    { v: sum.waterThisMonth, l: t('insights.waterThisMonth') },
    { v: sum.addedThisMonth, l: t('insights.addedThisMonth') },
    { v: sum.avgInterval ? days(sum.avgInterval) : '—', l: t('insights.avgInterval') },
  ];

  const maxRoom = Math.max(1, ...sum.rooms.map(([, n]) => n));

  return (
    <>
      <TopBar title={t('insights.title')} />
      <main className="content" id="main">
        <div className="page-head">
          <h2>{t('insights.title')}</h2>
          <p>{t('insights.subtitle')}</p>
        </div>

        <div className="stat-grid">
          {tiles.map((x, i) => (
            <div className="stat" key={i}>
              <b>{x.v}</b>
              <span>{x.l}</span>
            </div>
          ))}
        </div>
        {sum.avgInterval != null && (
          <p className="tiny muted" style={{ marginBlockStart: 8 }}>
            {t('insights.acrossPlants', { n: sum.intervalSample })}
          </p>
        )}

        <section className="section">
          <div className="section-head">
            <h3>{t('insights.personal')}</h3>
          </div>
          {cards.length === 0 ? (
            <EmptyState emoji="📊" title={t('common.notEnoughData')} body={t('insights.noneYet')} />
          ) : (
            <div className="col" style={{ gap: 10 }}>
              {cards.map((c) => (
                <Link
                  key={c.id}
                  to={`/plant/${c.plantId}`}
                  className="insight"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <span className="ic" aria-hidden="true">
                    {c.icon}
                  </span>
                  <span>
                    <Bidi as="span" className="txt">
                      {t(`insights.cards.${c.key}`, {
                        ...c.vars,
                        issue: c.vars.issue ? t(`enum.healthIssue.${c.vars.issue}`) : undefined,
                      })}
                    </Bidi>
                    <span className="ev" style={{ display: 'block' }}>
                      {t('insights.evidence', { n: c.evidence })}
                    </span>
                  </span>
                </Link>
              ))}
            </div>
          )}
        </section>

        {sum.rooms.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h3>{t('insights.perRoom')}</h3>
            </div>
            <div className="card pad">
              {sum.rooms.map(([room, n]) => (
                <BarRow key={room || 'none'} label={room || t('insights.noRoom')} value={n} max={maxRoom} />
              ))}
            </div>
          </section>
        )}

        <section className="section">
          <div className="section-head">
            <h3>{t('insights.activity')}</h3>
          </div>
          <div className="card pad">
            <Spark values={sum.weeks} label={t('insights.activity')} />
          </div>
        </section>
      </main>
    </>
  );
}
