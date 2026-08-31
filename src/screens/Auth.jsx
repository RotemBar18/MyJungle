import { useState } from 'react';
import { signInWithPopup, signInWithRedirect } from 'firebase/auth';
import { auth, googleProvider } from '../firebase.js';
import { useI18n, LANGS } from '../i18n/index.jsx';
import { useToast } from '../components/ui.jsx';
import { Logo } from '../components/icons.jsx';

const GoogleMark = () => (
  <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#4285F4" d="M45 24.5c0-1.6-.1-3.1-.4-4.5H24v8.5h11.8c-.5 2.7-2 5-4.4 6.6v5.5h7.1C42.6 36.7 45 31.1 45 24.5z" />
    <path fill="#34A853" d="M24 46c6 0 11-2 14.5-5.4l-7.1-5.5c-2 1.3-4.5 2.1-7.4 2.1-5.7 0-10.5-3.8-12.2-9H4.5v5.7C8 41.1 15.4 46 24 46z" />
    <path fill="#FBBC05" d="M11.8 28.2c-.4-1.3-.7-2.7-.7-4.2s.3-2.9.7-4.2v-5.7H4.5A22 22 0 0 0 2 24c0 3.6.9 6.9 2.5 9.9l7.3-5.7z" />
    <path fill="#EA4335" d="M24 10.8c3.2 0 6.1 1.1 8.4 3.3l6.3-6.3C35 4.1 30 2 24 2 15.4 2 8 6.9 4.5 14.1l7.3 5.7c1.7-5.2 6.5-9 12.2-9z" />
  </svg>
);

/**
 * Google is the only sign-in method. One button, no password to forget, and the
 * account already carries a name and avatar — which is what the members list of a
 * shared jungle wants to show anyway.
 */
export default function Auth() {
  const { t, lang, setLang } = useI18n();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const message = (err) => {
    const key = `auth.errors.${err?.code}`;
    return t(key) === key ? t('auth.errors.default') : t(key);
  };

  const signIn = async () => {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (err) {
      // In-app browsers (Instagram, some mail clients) and strict pop-up
      // blockers cannot open a popup at all; the redirect flow always works.
      if (
        [
          'auth/popup-blocked',
          'auth/operation-not-supported-in-this-environment',
          'auth/cancelled-popup-request',
        ].includes(err.code)
      ) {
        toast(t('auth.popupBlocked'));
        await signInWithRedirect(auth, googleProvider);
        return;
      }
      if (err.code !== 'auth/popup-closed-by-user') setError(message(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <Logo size={54} className="logo" />
        <h1>{t('auth.welcome')}</h1>
        <p className="sub">{t('auth.subtitle')}</p>

        {error && (
          <div className="banner err" style={{ marginBlockEnd: 14 }} role="alert">
            {error}
          </div>
        )}

        <button className="btn primary block" onClick={signIn} disabled={busy}>
          <GoogleMark />
          {busy ? t('common.loading') : t('auth.google')}
        </button>

        <p className="tiny muted center" style={{ marginBlockStart: 16, lineHeight: 1.6 }}>
          {t('auth.privacy')}
        </p>

        <div className="center" style={{ marginBlockStart: 20 }}>
          <div className="lang-toggle">
            {LANGS.map((l) => (
              <button
                key={l.id}
                type="button"
                className={lang === l.id ? 'on' : ''}
                onClick={() => setLang(l.id)}
              >
                {l.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
