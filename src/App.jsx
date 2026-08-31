import { Component, useEffect } from 'react';
import { HashRouter, Routes, Route, NavLink, Navigate, useLocation } from 'react-router-dom';
import { useI18n } from './i18n/index.jsx';
import { useStore } from './data/store.jsx';
import { FIREBASE_CONFIGURED } from './firebase.js';
import { IconHome, IconLeaf, IconPlus, IconChart, IconGear, Logo } from './components/icons.jsx';
import { ToastProvider, useToast } from './components/ui.jsx';
import Auth from './screens/Auth.jsx';
import Home from './screens/Home.jsx';
import Jungle from './screens/Jungle.jsx';
import PlantDetail from './screens/PlantDetail.jsx';
import PlantForm from './screens/PlantForm.jsx';
import Insights from './screens/Insights.jsx';
import Settings from './screens/Settings.jsx';
import Join from './screens/Join.jsx';

export default function App() {
  return (
    <ErrorBoundary>
      <ToastProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </ToastProvider>
    </ErrorBoundary>
  );
}

/**
 * A render error should cost you one reload, not your evening. Data is safe
 * either way — it lives in Firestore and its local cache, not in component state.
 */
class ErrorBoundary extends Component {
  state = { error: null };

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('myJungle crashed', error, info);
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="auth-wrap">
        <div className="auth-card center">
          <Logo size={48} className="logo" />
          <h1>🌱</h1>
          <p className="sub" dir="auto">
            Something went wrong. Your data is safe.
          </p>
          <button className="btn primary block" onClick={() => window.location.reload()}>
            Reload
          </button>
          <pre
            className="tiny muted"
            style={{ marginBlockStart: 16, overflowX: 'auto', direction: 'ltr', textAlign: 'left' }}
          >
            {String(this.state.error?.message || this.state.error)}
          </pre>
        </div>
      </div>
    );
  }
}

function Shell() {
  const { t } = useI18n();
  const { user, ready, online, accessError, jungles, selectJungle } = useStore();

  if (!FIREBASE_CONFIGURED) return <NotConfigured />;
  if (user === undefined) return <Splash />;
  if (!user) return <Auth />;
  if (accessError) return <NoAccess jungles={jungles} onPick={selectJungle} />;
  if (!ready) return <Splash />;

  return (
    <div className="app">
      <a className="skip-link" href="#main">
        {t('a11y.skipToContent')}
      </a>
      <TabBar />
      <div className="main-col">
        <WriteErrorToast />
        {!online && <div className="offline-pill">{t('sync.offline')}</div>}
        <ScrollToTop />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/jungle" element={<Jungle />} />
          <Route path="/plant/:id" element={<PlantDetail />} />
          <Route path="/plant/:id/edit" element={<PlantForm />} />
          <Route path="/new" element={<PlantForm />} />
          <Route path="/insights" element={<Insights />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/join" element={<Join />} />
          <Route path="/join/:code" element={<Join />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </div>
  );
}

/** Writes are fire-and-forget, so a rejected one has to be reported here. */
function WriteErrorToast() {
  const { t } = useI18n();
  const toast = useToast();
  const { writeError, clearWriteError } = useStore();
  useEffect(() => {
    if (!writeError) return;
    toast(t('sync.saveFailed'), { type: 'error' });
    clearWriteError();
  }, [writeError, toast, t, clearWriteError]);
  return null;
}

function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function TabBar() {
  const { t } = useI18n();
  const items = [
    { to: '/', icon: IconHome, label: t('nav.home'), end: true },
    { to: '/jungle', icon: IconLeaf, label: t('nav.jungle') },
    { to: '/new', icon: IconPlus, label: t('nav.add'), fab: true },
    { to: '/insights', icon: IconChart, label: t('nav.insights') },
    { to: '/settings', icon: IconGear, label: t('nav.settings') },
  ];
  return (
    <nav className="tabbar" aria-label={t('a11y.mainNav')}>
      {items.map(({ to, icon: Icon, label, end, fab }) => (
        <NavLink
          key={to}
          to={to}
          end={end}
          className={({ isActive }) => `${isActive ? 'on' : ''}${fab ? ' fab-tab' : ''}`}
        >
          {fab ? (
            <span className="ico">
              <Icon />
            </span>
          ) : (
            <Icon />
          )}
          <span>{label}</span>
        </NavLink>
      ))}
    </nav>
  );
}

function Splash() {
  const { t } = useI18n();
  return (
    <div className="auth-wrap" role="status" aria-label={t('a11y.loadingApp')}>
      <div className="center">
        <Logo size={56} />
        <p className="muted small" style={{ marginBlockStart: 12 }}>
          {t('common.loading')}
        </p>
      </div>
    </div>
  );
}

function NoAccess({ jungles, onPick }) {
  const { t } = useI18n();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo size={48} className="logo" />
        <h1>{t('jungle.noAccess')}</h1>
        <p className="sub">{t('jungle.noAccessBody')}</p>
        <div className="col">
          {jungles.map((j) => (
            <button key={j.id} className="btn" onClick={() => onPick(j.id)}>
              {j.name}
            </button>
          ))}
          <a className="btn ghost" href="#/join">
            {t('jungle.join')}
          </a>
        </div>
      </div>
    </div>
  );
}

function NotConfigured() {
  const { t } = useI18n();
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo size={48} className="logo" />
        <h1>{t('auth.notConfigured')}</h1>
        <p className="sub">{t('auth.notConfiguredBody')}</p>
        <pre
          className="tile small"
          style={{ overflowX: 'auto', direction: 'ltr', textAlign: 'left' }}
        >
{`cp .env.example .env
# fill VITE_FB_* from Firebase console
npm run dev`}
        </pre>
      </div>
    </div>
  );
}
