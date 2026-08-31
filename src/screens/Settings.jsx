import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useI18n, LANGS } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { Segmented, Confirm, useToast, EmptyState, Bidi, Sheet } from '../components/ui.jsx';
import { ListRow } from '../components/plant.jsx';
import { MembersPanel, JungleSheet } from '../components/jungleSwitcher.jsx';
import { IconDownload, IconUpload } from '../components/icons.jsx';
import { buildBackup, downloadJson, backupFilename, restoreBackup } from '../lib/backup.js';
import {
  readBundledSource,
  readFileSource,
  readLocalStorageSource,
  runMigration,
} from '../lib/migrate.js';

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

        <Migration />

        <BackupSection />

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

/* --------------------------------------------------------------- migration */

function Migration() {
  const { t, fmtDate } = useI18n();
  const store = useStore();
  const toast = useToast();
  const fileRef = useRef(null);
  const [progress, setProgress] = useState(null);
  const [result, setResult] = useState(null);

  const already = store.jungle?.migration;

  const doImport = async (legacyPlants, source) => {
    if (!legacyPlants?.length) {
      toast(t('settings.importBad'), { type: 'error' });
      return;
    }
    setProgress({ done: 0, total: legacyPlants.length });
    try {
      const res = await runMigration({
        jungleId: store.jungleId,
        legacyPlants,
        source,
        existingPlants: store.plants,
        uploadPhoto: (plantId, blob) => store.uploadPhoto(plantId, blob),
        onProgress: (done, total) => setProgress({ done, total }),
      });
      setResult(res);
      toast(t('settings.migrateDone', res));
    } catch (err) {
      console.error(err);
      toast(t('settings.migrateFailed'), { type: 'error' });
    } finally {
      setProgress(null);
    }
  };

  const [importBundled, busy] = useSubmit(async () => {
    // Prefer whatever the old app left in this browser; fall back to the copy
    // of the collection shipped with myJungle.
    const local = readLocalStorageSource();
    const legacy = local || (await readBundledSource());
    await doImport(legacy, local ? 'localStorage' : 'bundled');
  });

  return (
    <section className="section">
      <div className="section-head">
        <h3>{t('settings.migrateTitle')}</h3>
      </div>
      <div className="card pad">
        <p className="small muted">{t('settings.migrateBody')}</p>
        {already?.done && (
          <p className="tiny" style={{ marginBlockStart: 8, color: 'var(--green)' }}>
            ✓ {t('settings.migrateAlready', { date: fmtDate(already.at) })}
          </p>
        )}
        {progress && (
          <div style={{ marginBlockStart: 12 }}>
            <div className="progress">
              <i style={{ inlineSize: `${Math.round((progress.done / progress.total) * 100)}%` }} />
            </div>
            <p className="tiny muted" style={{ marginBlockStart: 6 }}>
              {t('settings.migrateWorking', progress)}
            </p>
          </div>
        )}
        {result && (
          <div className="banner info" style={{ marginBlockStart: 12 }}>
            {t('settings.migrateDone', result)}
          </div>
        )}
        <div className="row" style={{ gap: 8, marginBlockStart: 14, flexWrap: 'wrap' }}>
          <button className="btn primary" onClick={importBundled} disabled={busy || !!progress}>
            {t('settings.migrateBtn')}
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} disabled={!!progress}>
            {t('settings.migrateFile')}
          </button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept=".json,.html,application/json,text/html"
          hidden
          onChange={async (e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (!f) return;
            const legacy = await readFileSource(f);
            await doImport(legacy, 'file');
          }}
        />
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ backup */

function BackupSection() {
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();
  const fileRef = useRef(null);
  const [restoring, setRestoring] = useState(null);

  const [exportNow, busy] = useSubmit(async () => {
    const data = await buildBackup(store);
    downloadJson(data, backupFilename());
    toast(t('settings.exportDone'));
  });

  const onFile = async (e) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      setRestoring({ done: 0, total: 1 });
      const res = await restoreBackup(store.jungleId, data, (done, total) => setRestoring({ done, total }));
      toast(t('settings.importDone', res));
    } catch (err) {
      console.error(err);
      toast(t('settings.importBad'), { type: 'error' });
    } finally {
      setRestoring(null);
    }
  };

  return (
    <section className="section">
      <div className="section-head">
        <h3>{t('settings.data')}</h3>
      </div>
      <div className="card pad">
        <p className="small muted">{t('settings.exportBody')}</p>
        <button className="btn block" style={{ marginBlockStart: 12 }} onClick={exportNow} disabled={busy}>
          <IconDownload /> {t('settings.exportBtn')}
        </button>

        <hr style={{ border: 0, borderTop: '1px solid var(--line)', margin: '16px 0' }} />

        <p className="small muted">{t('settings.importBody')}</p>
        {restoring && (
          <p className="tiny muted" style={{ marginBlockStart: 8 }}>
            {t('settings.importWorking')}
          </p>
        )}
        <button
          className="btn block"
          style={{ marginBlockStart: 12 }}
          onClick={() => fileRef.current?.click()}
          disabled={!!restoring}
        >
          <IconUpload /> {t('settings.importBtn')}
        </button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={onFile} />
      </div>
    </section>
  );
}
