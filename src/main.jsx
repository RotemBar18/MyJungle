import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './styles.css';
import App from './App.jsx';
import { I18nProvider } from './i18n/index.jsx';
import { StoreProvider } from './data/store.jsx';
import { AiProvider } from './components/aiSettings.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <I18nProvider>
      <StoreProvider>
        <AiProvider>
          <App />
        </AiProvider>
      </StoreProvider>
    </I18nProvider>
  </StrictMode>,
);
