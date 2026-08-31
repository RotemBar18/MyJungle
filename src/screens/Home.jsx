import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { AttentionRow, PlantCard } from '../components/plant.jsx';
import { EmptyState, Bidi, Badge } from '../components/ui.jsx';
import { useQuickLog } from '../components/eventSheet.jsx';
import { IconSearch } from '../components/icons.jsx';
import { JungleChip, JungleSheet } from '../components/jungleSwitcher.jsx';
import { eventType } from '../lib/domain.js';

const greetingKey = () => {
  const h = new Date().getHours();
  if (h < 5) return 'home.greetingNight';
  if (h < 12) return 'home.greetingMorning';
  if (h < 18) return 'home.greetingDay';
  return 'home.greetingEvening';
};

export default function Home() {
  const { t, relTime } = useI18n();
  const { plants, events, stats, attention } = useStore();
  const [openQuickLog, quickLogSheet] = useQuickLog();
  const [showAll, setShowAll] = useState(false);
  const [switcher, setSwitcher] = useState(false);

  const active = useMemo(() => plants.filter((p) => p.status === 'active'), [plants]);

  const needsAttention = useMemo(
    () =>
      active
        .map((p) => ({ plant: p, a: attention.get(p.id) }))
        .filter((x) => x.a)
        .sort((a, b) => b.a.score - a.a.score),
    [active, attention],
  );

  const recent = useMemo(() => {
    const byId = new Map(plants.map((p) => [p.id, p]));
    return events
      .slice(0, 8)
      .map((e) => ({ e, p: byId.get(e.plantId) }))
      .filter((x) => x.p);
  }, [events, plants]);

  const shown = showAll ? needsAttention : needsAttention.slice(0, 5);

  return (
    <>
      <TopBar
        brand
        actions={
          <>
            <JungleChip onClick={() => setSwitcher(true)} />
            <Link className="btn icon" to="/jungle" aria-label={t('common.search')}>
              <IconSearch />
            </Link>
          </>
        }
      />
      <main className="content" id="main">
        <div className="page-head">
          <h2>{t(greetingKey())}</h2>
          <p>{t('home.subtitle', { n: active.length })}</p>
        </div>

        <section className="section" aria-labelledby="att-h">
          <div className="section-head">
            <h3 id="att-h">{t('home.attention')}</h3>
            {needsAttention.length > 5 && (
              <button className="link" onClick={() => setShowAll((v) => !v)}>
                {showAll ? t('common.showLess') : t('common.seeAll')}
              </button>
            )}
          </div>

          {shown.length === 0 ? (
            <EmptyState
              emoji="🌿"
              title={t('home.attentionEmptyTitle')}
              body={active.length ? t('home.attentionEmpty') : t('plants.emptyBody')}
              action={
                active.length === 0 && (
                  <Link className="btn primary" to="/new">
                    {t('plants.addPlant')}
                  </Link>
                )
              }
            />
          ) : (
            <div className="att-list">
              {shown.map(({ plant, a }) => (
                <AttentionRow
                  key={plant.id}
                  plant={plant}
                  stats={stats.get(plant.id)}
                  attention={a}
                  onQuickLog={openQuickLog}
                />
              ))}
            </div>
          )}
          <p className="tiny muted" style={{ marginBlockStart: 10 }}>
            💡 {t('care.checkNotWater')}
          </p>
        </section>

        {recent.length > 0 && (
          <section className="section" aria-labelledby="rec-h">
            <div className="section-head">
              <h3 id="rec-h">{t('home.recent')}</h3>
            </div>
            <div className="list">
              {recent.map(({ e, p }) => (
                <Link
                  key={e.id}
                  to={`/plant/${p.id}`}
                  className="list-row"
                  style={{ color: 'inherit', textDecoration: 'none' }}
                >
                  <span className="lead" aria-hidden="true">
                    {eventType(e.type).icon}
                  </span>
                  <span className="txt">
                    <Bidi as="b">{p.name}</Bidi>
                    <small>
                      {t(`enum.eventType.${e.type}`)} · {relTime(e.at)}
                    </small>
                  </span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="section" aria-labelledby="jungle-h">
          <div className="section-head">
            <h3 id="jungle-h">{t('home.myJungle')}</h3>
            <Link className="link" to="/jungle">
              {t('common.seeAll')}
            </Link>
          </div>
          <div className="plant-grid">
            {active.slice(0, 6).map((p) => (
              <PlantCard key={p.id} plant={p} stats={stats.get(p.id)} onQuickLog={openQuickLog} />
            ))}
          </div>
          {active.length === 0 && (
            <EmptyState
              emoji="🪴"
              title={t('plants.empty')}
              body={t('plants.emptyBody')}
              action={
                <Link className="btn primary" to="/new">
                  {t('plants.addPlant')}
                </Link>
              }
            />
          )}
        </section>
      </main>
      {quickLogSheet}
      <JungleSheet open={switcher} onClose={() => setSwitcher(false)} />
    </>
  );
}
