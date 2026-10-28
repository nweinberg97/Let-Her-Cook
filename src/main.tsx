import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/bricolage-grotesque';
import '@fontsource-variable/plus-jakarta-sans';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/walla-feed.css';
import './styles/print.css';
import { App } from './App';
import { IndexedDbRepository } from './lib/storage/indexeddb';
import { LibraryProvider } from './lib/storage/LibraryContext';
import { ImportSessionProvider } from './lib/extraction/ImportSession';
import { ToastProvider } from './components/ui/Toast';
import { registerSW } from 'virtual:pwa-register';
import { initNativeShell, isNativeApp } from './lib/native';

const repo = new IndexedDbRepository();

// Offline caching for the website. The iPhone app already has every file
// built in, and iOS apps don't use service workers.
if (!isNativeApp) registerSW({ immediate: true });
void initNativeShell();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ToastProvider>
      <LibraryProvider repo={repo}>
        <ImportSessionProvider>
          <App />
        </ImportSessionProvider>
      </LibraryProvider>
    </ToastProvider>
  </StrictMode>
);
