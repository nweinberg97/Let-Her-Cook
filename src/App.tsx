import { createHashRouter, Outlet, RouterProvider } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { AppShell } from './components/layout/AppShell';
import { LibraryPage } from './pages/LibraryPage';
import { CollectionsPage } from './pages/CollectionsPage';
import { RecipePage } from './pages/RecipePage';
import { EditRecipePage } from './pages/EditRecipePage';
import { CookingPage } from './pages/CookingPage';
import { AddRecipePage } from './pages/AddRecipePage';
import { ReviewPage } from './pages/ReviewPage';
import { DataPage } from './pages/DataPage';
import { NotFound } from './pages/NotFound';
import { useLibrary } from './lib/storage/LibraryContext';
import { Wordmark } from './components/ui/Wordmark';

/** If the browser won't let us open storage at all, say so plainly instead of showing a broken app. */
function StorageGate() {
  const { status, reload } = useLibrary();
  if (status === 'error') {
    return (
      <div className="storage-error" role="alert">
        <Wordmark size="lg" />
        <AlertTriangle size={32} aria-hidden="true" />
        <h1>This browser isn’t letting Let ’Em Cook save recipes</h1>
        <p>
          Private or incognito windows, strict privacy settings, or a full disk can block site storage. Try a regular browser window, allow site data for this page, or free up some
          space — then reload.
        </p>
        <button type="button" className="btn btn--primary btn--md" onClick={reload}>
          <span className="btn__label">Try again</span>
        </button>
      </div>
    );
  }
  return <Outlet />;
}

const router = createHashRouter([
  {
    element: <StorageGate />,
    children: [
      { path: 'recipes/:id/cook', element: <CookingPage /> },
      {
        element: <AppShell />,
        children: [
          { index: true, element: <LibraryPage view="all" /> },
          { path: 'favorites', element: <LibraryPage view="favorites" /> },
          { path: 'recent', element: <LibraryPage view="recent" /> },
          { path: 'collections', element: <CollectionsPage /> },
          { path: 'collections/:id', element: <LibraryPage view="collection" /> },
          { path: 'recipes/:id', element: <RecipePage /> },
          { path: 'recipes/:id/edit', element: <EditRecipePage /> },
          { path: 'add', element: <AddRecipePage /> },
          { path: 'add/review', element: <ReviewPage /> },
          { path: 'data', element: <DataPage /> },
          { path: '*', element: <NotFound /> }
        ]
      }
    ]
  }
]);

export function App() {
  return <RouterProvider router={router} />;
}
