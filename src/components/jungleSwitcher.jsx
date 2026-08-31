import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { useStore, useSubmit } from '../data/store.jsx';
import { Sheet, Confirm, TextField, useToast, Bidi, Badge } from './ui.jsx';
import { ListRow } from './plant.jsx';
import { IconChevron, IconPlus, IconCheck } from './icons.jsx';

/** The button in the app bar that shows which jungle you are looking at. */
export function JungleChip({ onClick }) {
  const { t } = useI18n();
  const { jungle, jungles, members } = useStore();
  if (!jungle) return null;
  return (
    <button className="chip" onClick={onClick} aria-label={t('jungle.switch')}>
      <Bidi>{jungle.name}</Bidi>
      {members.length > 1 && <span className="tiny muted">· {members.length}</span>}
      {jungles.length > 1 && <IconChevron className="flip-rtl" width={13} height={13} />}
    </button>
  );
}

export function JungleSheet({ open, onClose }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const store = useStore();
  const toast = useToast();
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');

  const [create, busy] = useSubmit(async () => {
    if (!name.trim()) return;
    await store.createJungle(name.trim());
    toast(t('jungle.created'));
    setName('');
    setCreating(false);
    onClose();
    nav('/');
  });

  return (
    <Sheet open={open} onClose={onClose} title={t('jungle.title')}>
      <div className="list">
        {store.jungles.map((j) => (
          <button
            key={j.id}
            className="list-row"
            onClick={() => {
              store.selectJungle(j.id);
              onClose();
              nav('/');
            }}
          >
            <span className="lead" aria-hidden="true">
              🌿
            </span>
            <span className="txt">
              <Bidi as="b">{j.name}</Bidi>
              <small>{t(`jungle.roles.${j.role}`)}</small>
            </span>
            {j.id === store.jungleId && <IconCheck width={18} height={18} style={{ color: 'var(--green)' }} />}
          </button>
        ))}
      </div>

      {creating ? (
        <div style={{ marginBlockStart: 16 }}>
          <p className="small muted" style={{ marginBlockEnd: 10 }}>
            {t('jungle.createBody')}
          </p>
          <TextField
            label={t('jungle.name')}
            placeholder={t('jungle.namePlaceholder')}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <div className="row" style={{ gap: 8 }}>
            <button className="btn grow" onClick={() => setCreating(false)}>
              {t('common.cancel')}
            </button>
            <button className="btn primary grow" onClick={create} disabled={busy || !name.trim()}>
              {t('common.save')}
            </button>
          </div>
        </div>
      ) : (
        <div className="col" style={{ marginBlockStart: 16 }}>
          <button className="btn" onClick={() => setCreating(true)}>
            <IconPlus /> {t('jungle.create')}
          </button>
          <button
            className="btn ghost"
            onClick={() => {
              onClose();
              nav('/join');
            }}
          >
            {t('jungle.join')}
          </button>
        </div>
      )}
    </Sheet>
  );
}

/** Members list, invite links, leaving — the sharing surface in Settings. */
export function MembersPanel() {
  const { t } = useI18n();
  const store = useStore();
  const toast = useToast();
  const [invite, setInvite] = useState(null);
  const [confirm, setConfirm] = useState(null);
  const [renaming, setRenaming] = useState(false);
  const [name, setName] = useState(store.jungle?.name || '');

  const link = invite ? `${location.origin}${location.pathname}#/join/${invite}` : '';

  const [makeInvite, busyInvite] = useSubmit(
    async () => setInvite(await store.createInvite()),
    { onError: () => toast(t('common.error'), { type: 'error' }) },
  );

  const [rename, busyRename] = useSubmit(async () => {
    await store.renameJungle(name.trim());
    setRenaming(false);
    toast(t('jungle.renamed'));
  });

  const [confirmRun, busyConfirm] = useSubmit(async () => {
    if (confirm.kind === 'leave') {
      await store.leaveJungle();
      toast(t('jungle.left'));
    } else if (confirm.kind === 'remove') {
      await store.removeMember(confirm.member.id);
      toast(t('jungle.removed'));
    }
    setConfirm(null);
  });

  const share = async () => {
    const text = `${t('jungle.shareText')} — ${store.jungle?.name}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: 'myJungle', text, url: link });
        return;
      } catch {
        /* user dismissed the share sheet */
      }
    }
    try {
      await navigator.clipboard.writeText(link);
      toast(t('common.copied'));
    } catch {
      toast(t('common.error'), { type: 'error' });
    }
  };

  return (
    <>
      <div className="card pad">
        <div className="row-between" style={{ marginBlockEnd: 12 }}>
          <div>
            <div className="lbl">{t('jungle.current')}</div>
            <Bidi as="b" style={{ fontSize: 17 }}>
              {store.jungle?.name}
            </Bidi>
          </div>
          {store.isOwner && !renaming && (
            <button
              className="btn sm"
              onClick={() => {
                setName(store.jungle?.name || '');
                setRenaming(true);
              }}
            >
              {t('jungle.rename')}
            </button>
          )}
        </div>

        {renaming && (
          <>
            <TextField label={t('jungle.name')} value={name} onChange={(e) => setName(e.target.value)} />
            <div className="row" style={{ gap: 8, marginBlockEnd: 14 }}>
              <button className="btn grow" onClick={() => setRenaming(false)}>
                {t('common.cancel')}
              </button>
              <button className="btn primary grow" onClick={rename} disabled={busyRename || !name.trim()}>
                {t('common.save')}
              </button>
            </div>
          </>
        )}

        <div className="lbl" style={{ marginBlockEnd: 6 }}>
          {t('jungle.membersCount', { n: store.members.length })}
        </div>
        <div className="list">
          {store.members.map((m) => (
            <div className="list-row" key={m.id}>
              <span className="lead" aria-hidden="true">
                {m.photoURL ? (
                  <img
                    src={m.photoURL}
                    alt=""
                    style={{ width: 28, height: 28, borderRadius: '50%' }}
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  '👤'
                )}
              </span>
              <span className="txt">
                <Bidi as="b">
                  {m.displayName || m.email || m.id.slice(0, 6)}
                  {m.id === store.uid ? ` (${t('jungle.you')})` : ''}
                </Bidi>
                <small>{t(`jungle.roles.${m.role}`)}</small>
              </span>
              {store.isOwner && m.id !== store.uid && (
                <button className="btn sm danger" onClick={() => setConfirm({ kind: 'remove', member: m })}>
                  {t('jungle.removeMember')}
                </button>
              )}
            </div>
          ))}
        </div>

        <p className="small muted" style={{ marginBlockStart: 14 }}>
          {t('jungle.inviteBody')}
        </p>

        {invite ? (
          <div style={{ marginBlockStart: 12 }}>
            <div className="lbl">{t('jungle.inviteCode')}</div>
            <div
              className="tile center"
              style={{ fontSize: 22, fontWeight: 800, letterSpacing: 2, direction: 'ltr' }}
            >
              {invite}
            </div>
            <div className="row" style={{ gap: 8, marginBlockStart: 10 }}>
              <button className="btn primary grow" onClick={share}>
                {t('jungle.share')}
              </button>
              <button
                className="btn"
                onClick={async () => {
                  await store.revokeInvite(invite);
                  setInvite(null);
                  toast(t('jungle.revoked'));
                }}
              >
                {t('jungle.revoke')}
              </button>
            </div>
            <p className="tiny muted" style={{ marginBlockStart: 8, overflowWrap: 'anywhere', direction: 'ltr' }}>
              {link}
            </p>
            <p className="tiny muted">{t('jungle.inviteExpires')}</p>
          </div>
        ) : (
          <button className="btn block" style={{ marginBlockStart: 12 }} onClick={makeInvite} disabled={busyInvite}>
            {t('jungle.inviteCreate')}
          </button>
        )}

        <button
          className="btn danger block"
          style={{ marginBlockStart: 14 }}
          onClick={() => setConfirm({ kind: 'leave' })}
        >
          {t('jungle.leave')}
        </button>
      </div>

      <Confirm
        open={!!confirm}
        busy={busyConfirm}
        danger
        title={
          confirm?.kind === 'leave'
            ? t('jungle.leaveTitle', { name: store.jungle?.name || '' })
            : t('jungle.removeMemberTitle', {
                name: confirm?.member?.displayName || confirm?.member?.email || '',
              })
        }
        body={
          confirm?.kind === 'leave'
            ? `${t('jungle.leaveBody')}${store.isOwner ? ` ${t('jungle.leaveOwnerWarn')}` : ''}`
            : t('jungle.removeMemberBody')
        }
        confirmLabel={confirm?.kind === 'leave' ? t('jungle.leave') : t('jungle.removeMember')}
        onConfirm={confirmRun}
        onClose={() => setConfirm(null)}
      />
    </>
  );
}
