import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANGS } from '../i18n/index.jsx';
import { useStore } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { Segmented, Confirm, useToast, EmptyState, Bidi, Sheet } from '../components/ui.jsx';
import { ListRow } from '../components/plant.jsx';
import { MembersPanel, JungleSheet } from '../components/jungleSwitcher.jsx';
import { AiPanel } from '../components/aiSettings.jsx';

export default function Settings() {
  const { t, lang, setLang, units, setUnits, theme, setTheme } = useI18n();
  const store = useStore();
  const [signOutOpen, setSignOutOpen] = useState(false);
  const [archiveOpen, setArchiveOpen] = useState(false);
  const [switcher, setSwitcher] = useState(false);

  // Preferences live on the user document too, so a new device inherits them.
  useEffect(() => {
    const p = store.profile?.prefs;
    if (!p) return;
    if (p.lang && p.lang !== lang) setLang(p.lang);
    if (p.units && p.units !== units) setUnits(p.units);
    if (p.theme && p.theme !== theme) setTheme(p.theme);
    // Runs only when the remote profile arrives.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store.profile?.prefs]);

  const persist = (patch) => store.saveProfile({ prefs: { lang, units, theme, ...patch } });

  const archived = store.plants.filter((p) => p.status !== 'active');

  return (
    <>
      <TopBar title={t('settings.title')} />
      <main className="content" id="main">
        <div className="page-head">
          <h2>{t('settings.title')}</h2>
          <p>
            {t('auth.signedInAs')}{' '}
            <Bidi>{store.user?.displayName || store.user?.email}</Bidi>
          </p>
        </div>

        <section className="section">
          <div className="section-head">
            <h3>{t('ai.title')}</h3>
          </div>
          <AiPanel />
        </section>

        <section className="section">
          <div className="section-head">
            <h3>{t('jungle.title')}</h3>
            <button className="link" onClick={() => setSwitcher(true)}>
              {t('jungle.switch')}
            </button>
          </div>
          <MembersPanel />
        </section>

        <section className="section">
          <div className="section-head">
            <h3>{t('settings.appearance')}</h3>
          </div>
          <div className="card pad">
            <Segmented
              label={t('settings.language')}
              value={lang}
              onChange={(v) => {
                setLang(v);
                persist({ lang: v });
              }}
              options={LANGS.map((l) => ({ value: l.id, label: l.label }))}
            />
            <Segmented
              label={t('settings.units')}
              value={units}
              onChange={(v) => {
                setUnits(v);
                persist({ units: v });
              }}
              options={[
                { value: 'metric', label: t('settings.unitMetric') },
                { value: 'imperial', label: t('settings.unitImperial') },
              ]}
            />
            <Segmented
              label={t('settings.theme')}
              value={theme}
              onChange={(v) => {
                setTheme(v);
                persist({ theme: v });
              }}
              options={[
                { value: 'system', label: t('settings.themeSystem') },
                { value: 'light', label: t('settings.themeLight') },
                { value: 'dark', label: t('settings.themeDark') },
              ]}
            />
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h3>{t('settings.archiveTitle')}</h3>
          </div>
          <div className="list">
            <ListRow
              lead="📦"
              title={t('settings.archiveCount', { n: archived.length })}
              onClick={() => setArchiveOpen(true)}
            />
          </div>
        </section>

        <section className="section">
          <div className="section-head">
            <h3>{t('settings.account')}</h3>
          </div>
          <div className="list">
            <ListRow lead="🚪" title={t('auth.signOut')} onClick={() => setSignOutOpen(true)} />
          </div>
          <p className="tiny muted" style={{ marginBlockStart: 12 }}>
            {t('settings.aboutBody')} {t('settings.storageNote')}
          </p>
          <p className="tiny muted">
            {t('common.version')} 1.0 · {store.online ? t('sync.synced') : t('sync.offline')}
            {store.pending > 0 && ` · ${t('sync.pending', { n: store.pending })}`}
          </p>
        </section>
      </main>

      <Confirm
        open={signOutOpen}
        title={t('settings.signOutConfirm')}
        confirmLabel={t('auth.signOut')}
        onConfirm={() => store.signOut()}
        onClose={() => setSignOutOpen(false)}
      />

      <JungleSheet open={switcher} onClose={() => setSwitcher(false)} />

      <Sheet open={archiveOpen} onClose={() => setArchiveOpen(false)} title={t('settings.archiveTitle')}>
        {archived.length === 0 ? (
          <EmptyState emoji="📦" title={t('settings.archiveEmpty')} />
        ) : (
          <div className="list">
            {archived.map((p) => (
              <ListRow
                key={p.id}
                to={`/plant/${p.id}`}
                lead="🪴"
                title={p.name}
                subtitle={t(`enum.plantStatus.${p.status}`)}
              />
            ))}
          </div>
        )}
      </Sheet>
    </>
  );
}
