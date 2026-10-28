import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { BookOpen, FolderHeart, Heart, Clock3, Plus, ShieldCheck } from 'lucide-react';
import { useEffect, useRef } from 'react';
import { Walla, Wordmark } from '../ui/Wordmark';
import { ExitDemoButton } from '../home/Discover';
import { useLibrary } from '../../lib/storage/LibraryContext';

const NAV = [
  { to: '/', label: 'My recipes', short: 'Recipes', icon: BookOpen, end: true },
  { to: '/collections', label: 'Collections', short: 'Collections', icon: FolderHeart, end: false },
  { to: '/favorites', label: 'Favorites', short: 'Favorites', icon: Heart, end: true },
  { to: '/recent', label: 'Recently added', short: 'Recent', icon: Clock3, end: true }
];

export function AppShell() {
  const { recipes, collections } = useLibrary();
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  const favoriteCount = recipes.filter((r) => r.isFavorite).length;
  const sampleCount = recipes.filter((r) => r.isSample).length;

  // Move focus to the page on navigation so screen readers announce the new view.
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    mainRef.current?.focus({ preventScroll: true });
    window.scrollTo({ top: 0 });
  }, [location.pathname]);

  return (
    <div className="shell">
      <a href="#main" className="skip-link" onClick={(e) => { e.preventDefault(); mainRef.current?.focus(); }}>
        Skip to content
      </a>

      <aside className="sidebar" aria-label="Main navigation">
        <Link to="/" className="sidebar__brand" aria-label="Let ’Em Cook — my recipes">
          <Wordmark />
        </Link>

        <Link to="/add" className="btn btn--primary btn--md btn--block sidebar__add">
          <span className="btn__icon" aria-hidden="true">
            <Plus size={18} />
          </span>
          <span className="btn__label">Add recipe</span>
        </Link>
        {sampleCount > 0 && (
          <div className="sidebar__demo">
            <span>Demo mode</span>
            <ExitDemoButton variant="secondary" />
          </div>
        )}

        <nav aria-label="Library">
          <ul className="sidebar__nav">
            {NAV.map(({ to, label, icon: Icon, end }) => (
              <li key={to}>
                <NavLink to={to} end={end} className="sidebar__link">
                  <Icon size={18} aria-hidden="true" />
                  <span>{label}</span>
                  {to === '/' && recipes.length > 0 && <span className="sidebar__count">{recipes.length}</span>}
                  {to === '/favorites' && favoriteCount > 0 && <span className="sidebar__count">{favoriteCount}</span>}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {collections.length > 0 && (
          <nav aria-label="Your collections" className="sidebar__collections">
            <p className="sidebar__heading">Your collections</p>
            <ul>
              {collections.slice(0, 10).map((c) => (
                <li key={c.id}>
                  <NavLink to={`/collections/${c.id}`} className="sidebar__sublink">
                    {c.name}
                  </NavLink>
                </li>
              ))}
              {collections.length > 10 && (
                <li>
                  <Link to="/collections" className="sidebar__sublink sidebar__more">
                    All {collections.length} collections
                  </Link>
                </li>
              )}
            </ul>
          </nav>
        )}

        <div className="sidebar__walla">
          <Walla size={64} />
          <p>Tip: paste a recipe from anywhere and I’ll tidy it up!</p>
        </div>

        <div className="sidebar__footer">
          <NavLink to="/data" className="sidebar__link">
            <ShieldCheck size={18} aria-hidden="true" />
            <span>Backup &amp; privacy</span>
          </NavLink>
        </div>
      </aside>

      <header className="mobile-header">
        <Link to="/" aria-label="Let ’Em Cook — my recipes">
          <Wordmark size="sm" />
        </Link>
        <div className="mobile-header__actions">
          {sampleCount > 0 && <ExitDemoButton />}
          <Link to="/data" className="icon-btn icon-btn--ghost icon-btn--md" aria-label="Backup and privacy" title="Backup & privacy">
            <ShieldCheck size={20} aria-hidden="true" />
          </Link>
        </div>
      </header>

      <main id="main" ref={mainRef} tabIndex={-1} className="main">
        <Outlet />
      </main>

      <nav className="tabbar" aria-label="Main navigation">
        {NAV.slice(0, 2).map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__item">
            <Icon size={22} aria-hidden="true" />
            <span>{short}</span>
          </NavLink>
        ))}
        <Link to="/add" className="tabbar__add" aria-label="Add recipe">
          <Plus size={26} aria-hidden="true" />
          <span>Add</span>
        </Link>
        {NAV.slice(2).map(({ to, short, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className="tabbar__item">
            <Icon size={22} aria-hidden="true" />
            <span>{short}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
