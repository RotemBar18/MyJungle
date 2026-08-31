import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useI18n } from '../i18n/index.jsx';
import { IconBack, Logo } from './icons.jsx';

export function TopBar({ title, back, brand, actions }) {
  const { t } = useI18n();
  const nav = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header className={`appbar${scrolled ? ' scrolled' : ''}`}>
      {back && (
        <button
          className="btn icon"
          onClick={() => (window.history.length > 1 ? nav(-1) : nav('/'))}
          aria-label={t('common.back')}
        >
          {/* the arrow points at the start edge, so it flips with direction */}
          <IconBack className="flip-rtl" />
        </button>
      )}
      {brand ? (
        <span className="wordmark">
          <Logo className="mark" />
          myJungle
        </span>
      ) : (
        <span className="appbar-title">{title}</span>
      )}
      <span className="spacer" />
      {actions}
    </header>
  );
}
