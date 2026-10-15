import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/newsreader';
import '@fontsource-variable/newsreader/wght-italic.css';
import '@fontsource/atkinson-hyperlegible-next/400.css';
import '@fontsource/atkinson-hyperlegible-next/600.css';
import '@fontsource/atkinson-hyperlegible-next/700.css';
import './styles/tokens.css';
import './styles/base.css';
import './styles/components.css';
import './styles/pages.css';
import './styles/print.css';
import { App } from './App';
import { IndexedDbRepository } from './lib/storage/indexeddb';
import { LibraryProvider } from './lib/storage/LibraryContext';
import { ImportSessionProvider } from './lib/extraction/ImportSession';
import { ToastProvider } from './components/ui/Toast';

const repo = new IndexedDbRepository();

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
