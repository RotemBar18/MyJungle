import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import { TopBar } from '../components/topbar.jsx';
import { TextField, useToast, Bidi } from '../components/ui.jsx';
import { Logo } from '../components/icons.jsx';

/**
 * Landing point for an invite link (`#/join/CODE`) and the manual code entry.
 * Signing in happens first — the router keeps the hash, so the invite survives
 * the round trip through the auth screen.
 */
export default function Join() {
  const { code: codeParam } = useParams();
  const nav = useNavigate();
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();

  const [code, setCode] = useState(codeParam ? codeParam.toUpperCase() : '');
  const [invite, setInvite] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!codeParam) return;
    let alive = true;
    store
      .readInvite(codeParam)
      .then((res) => {
        if (!alive) return;
        if (res.error) setError(t(`jungle.joinErrors.${res.error}`));
        else setInvite(res);
      })
      .catch(() => alive && setError(t('jungle.joinErrors.generic')));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [codeParam]);

  const [join, busy] = useSubmit(
    async () => {
      setError(null);
      const res = await store.joinJungle(code.trim().toUpperCase());
      if (res.error) {
        setError(t(`jungle.joinErrors.${res.error}`));
        return;
      }
      toast(t('jungle.joined', { name: res.name || '' }));
      nav('/', { replace: true });
    },
    { onError: () => setError(t('jungle.joinErrors.generic')) },
  );

  return (
    <>
      <TopBar back title={t('jungle.joinTitle')} />
      <main className="content" id="main">
        <div className="card pad center" style={{ marginBlockStart: 12 }}>
          <Logo size={48} style={{ marginInline: 'auto', marginBlockEnd: 12 }} />
          {invite ? (
            <>
              <p className="small muted">{t('jungle.joinInvitedTo')}</p>
              <h2 style={{ fontSize: 22, marginBlock: 4 }}>
                <Bidi>{invite.jungleName}</Bidi>
              </h2>
              {invite.createdByName && (
                <p className="tiny muted">
                  <Bidi>{invite.createdByName}</Bidi>
                </p>
              )}
            </>
          ) : (
            <p className="small muted">{t('jungle.joinBody')}</p>
          )}

          {error && (
            <div className="banner err" style={{ marginBlockStart: 14, textAlign: 'start' }} role="alert">
              {error}
            </div>
          )}

          <div style={{ marginBlockStart: 18, textAlign: 'start' }}>
            <TextField
              label={t('jungle.joinCode')}
              value={code}
              dir="ltr"
              autoCapitalize="characters"
              spellCheck={false}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
            />
            <button className="btn primary block" onClick={join} disabled={busy || code.trim().length < 4}>
              {busy ? t('jungle.joining') : t('jungle.joinBtn')}
            </button>
          </div>
        </div>
      </main>
    </>
  );
}
