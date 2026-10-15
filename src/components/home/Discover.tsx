import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Clock3, ChefHat, Link2, ImageIcon, FileText, PenLine, Sparkles, ArrowRight } from 'lucide-react';
import { effectiveTotalMinutes, type Recipe } from '../../types/recipe';
import { formatMinutes } from '../../lib/parsing/quantity';
import { courseStyle, hueStyle, type Hue } from '../../lib/courseColors';
import { useLibrary } from '../../lib/storage/LibraryContext';
import { storageErrorMessage } from '../../lib/storage/repository';
import { addSampleRecipes, removeSampleRecipes, SAMPLE_COUNT } from '../../lib/demo';
import { RecipeImage } from '../recipes/RecipeImage';
import { RecipeCard } from '../recipes/RecipeCard';
import { Button, ButtonLink } from '../ui/Button';
import { Walla, WallaHeadMark, WallaSays } from '../ui/Wordmark';
import { useToast } from '../ui/Toast';

export function greeting(date = new Date()): string {
  const h = date.getHours();
  if (h < 5) return 'Late-night snack?';
  if (h < 12) return 'Good morning!';
  if (h < 17) return 'Good afternoon!';
  return 'Good evening!';
}

function mealWord(date = new Date()): string {
  const h = date.getHours();
  if (h >= 5 && h < 11) return 'this morning?';
  if (h >= 11 && h < 15) return 'for lunch?';
  return 'tonight?';
}

export function HomeHello() {
  return (
    <header className="home__hello">
      <div>
        <p className="home__greeting">{greeting()}</p>
        <h1 className="home__title">
          What’s cooking <span className="home__title-accent">{mealWord()}</span>
        </h1>
      </div>
      <div className="home__walla">
        <Walla size={110} pose="wave" />
      </div>
    </header>
  );
}

const lc = (s: string) => s.toLowerCase();
const hasTag = (r: Recipe, ...tags: string[]) => r.customTags.some((t) => tags.map(lc).includes(lc(t)));

interface Category {
  label: string;
  hue: Hue;
  to: string;
  match: (r: Recipe) => boolean;
}

const CATEGORIES: Category[] = [
  { label: 'Weeknight wins', hue: 'orange', to: '/?tag=Weeknight', match: (r) => hasTag(r, 'Weeknight') },
  { label: 'Under 30 min', hue: 'mint', to: '/?time=30', match: (r) => (effectiveTotalMinutes(r) ?? Infinity) <= 30 },
  { label: 'Kid-approved', hue: 'butter', to: '/?tag=Kid-Friendly', match: (r) => hasTag(r, 'Kid-Friendly') },
  { label: 'Make-ahead', hue: 'sky', to: '/?tag=Make-Ahead', match: (r) => hasTag(r, 'Make-Ahead') },
  { label: 'Lunchbox', hue: 'lilac', to: '/?tag=Lunchbox', match: (r) => hasTag(r, 'Lunchbox') },
  { label: 'Breakfast', hue: 'butter', to: '/?course=Breakfast', match: (r) => lc(r.course) === 'breakfast' },
  { label: 'Sweet treats', hue: 'blush', to: '/?course=Dessert', match: (r) => lc(r.course) === 'dessert' },
  { label: 'Veggie', hue: 'mint', to: '/?diet=Vegetarian', match: (r) => r.dietaryTags.some((d) => lc(d) === 'vegetarian') }
];

/** Round photo bubbles for quick categories. Only categories with recipes are shown. */
export function CategoryBubbles({ recipes }: { recipes: Recipe[] }) {
  const cats = CATEGORIES.map((c) => ({ ...c, items: recipes.filter(c.match) })).filter((c) => c.items.length > 0);
  if (cats.length < 2) return null;
  return (
    <nav aria-label="Quick categories">
      <ul className="bubbles">
        {cats.map((c) => {
          const withPhoto = c.items.find((r) => r.heroImage);
          return (
            <li key={c.label}>
              <Link to={c.to} className="bubble" style={hueStyle(c.hue)}>
                <span className="bubble__img">
                  {withPhoto?.heroImage ? <BubblePhoto src={withPhoto.heroImage.thumb ?? withPhoto.heroImage.src} /> : <WallaHeadMark size={52} />}
                </span>
                <span>{c.label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

function BubblePhoto({ src }: { src: string }) {
  const [failed, setFailed] = useState(false);
  if (failed) return <WallaHeadMark size={52} />;
  return <img src={src} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} />;
}

function dayIndex(): number {
  const d = new Date();
  return d.getFullYear() * 400 + d.getMonth() * 31 + d.getDate();
}

function FeatureCard({ recipe, eyebrow, mini }: { recipe: Recipe; eyebrow: string; mini?: boolean }) {
  const total = effectiveTotalMinutes(recipe);
  return (
    <Link to={`/recipes/${recipe.id}`} className={`feature-card ${mini ? 'mini-feature' : ''}`} style={courseStyle(recipe.course)}>
      <RecipeImage image={recipe.heroImage} title={mini ? '' : recipe.title} course={recipe.course} />
      <div className="feature-card__body">
        <span className="feature-card__eyebrow">{eyebrow}</span>
        <h2 className="feature-card__title">{recipe.title}</h2>
        <p className="feature-card__meta">
          {total != null && (
            <span>
              <Clock3 size={16} aria-hidden="true" /> {formatMinutes(total)}
            </span>
          )}
          <span>{recipe.course}</span>
          {recipe.servings && !recipe.yieldText && <span>Serves {recipe.servings}</span>}
        </p>
        {!mini && (
          <span className="feature-card__cta">
            <ChefHat size={18} aria-hidden="true" /> Let’s cook
          </span>
        )}
      </div>
    </Link>
  );
}

/** "Tonight's pick" plus two smaller features. Changes daily, never random on reload. */
export function FeatureRow({ recipes }: { recipes: Recipe[] }) {
  if (recipes.length < 3) return null;
  const withPhotos = recipes.filter((r) => r.heroImage);
  const pool = withPhotos.length >= 3 ? withPhotos : recipes;
  const dinners = pool.filter((r) => lc(r.course) === 'dinner');
  const main = (dinners.length ? dinners : pool)[dayIndex() % (dinners.length || pool.length)];
  const rest = pool.filter((r) => r.id !== main.id);
  const quick = rest.find((r) => (effectiveTotalMinutes(r) ?? Infinity) <= 30) ?? rest[0];
  const sweet = rest.find((r) => r.id !== quick.id && ['dessert', 'baking', 'breakfast'].includes(lc(r.course))) ?? rest.find((r) => r.id !== quick.id);
  return (
    <section className="home__feature" aria-label="Featured recipes">
      <FeatureCard recipe={main} eyebrow="Tonight’s dinner idea" />
      <div className="home__side">
        <FeatureCard recipe={quick} eyebrow="Quick win" mini />
        {sweet && <FeatureCard recipe={sweet} eyebrow="Little treat" mini />}
      </div>
    </section>
  );
}

export function Shelf({ title, recipes, more }: { title: string; recipes: Recipe[]; more?: { to: string; label: string } }) {
  if (recipes.length === 0) return null;
  return (
    <section className="shelf" aria-label={title}>
      <div className="shelf__head">
        <h2 className="shelf__title">{title}</h2>
        {more && (
          <Link to={more.to} className="shelf__more">
            {more.label}
          </Link>
        )}
      </div>
      <ul className="shelf__track">
        {recipes.map((r) => (
          <li key={r.id}>
            <RecipeCard recipe={r} />
          </li>
        ))}
      </ul>
    </section>
  );
}

export function useSampleActions() {
  const { repo } = useLibrary();
  const toast = useToast();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const add = async () => {
    setBusy(true);
    try {
      const n = await addSampleRecipes(repo);
      toast.success(n ? `Walla added ${n} sample recipes. Have a look around!` : 'The sample recipes are already here.');
      navigate('/');
    } catch (err) {
      toast.error(storageErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    setBusy(true);
    try {
      const n = await removeSampleRecipes(repo);
      toast.success(`Removed ${n} sample recipes. Your own recipes weren’t touched.`);
    } catch (err) {
      toast.error(storageErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };
  return { add, remove, busy };
}

export function DemoBanner({ count }: { count: number }) {
  const { remove, busy } = useSampleActions();
  if (!count) return null;
  return (
    <div className="demo-banner" role="note">
      <WallaHeadMark size={40} />
      <p>
        You’re looking at {count} of Walla’s sample recipes. Explore, cook and scale them — then add your own.
      </p>
      <Button size="sm" variant="secondary" onClick={remove} disabled={busy}>
        Remove samples
      </Button>
    </div>
  );
}

export function FirstRun() {
  const { add, busy } = useSampleActions();
  return (
    <div className="page first-run">
      <section className="first-run__hero">
        <div className="first-run__intro">
          <h1 className="first-run__title">
            Every recipe, finally <em>in one place.</em>
          </h1>
          <p className="first-run__lede">
            Paste a link, snap a screenshot, or photograph Grandma’s card. Walla turns it into a clean, cookable recipe — and keeps it all on your device.
          </p>
          <div className="first-run__actions">
            <ButtonLink to="/add" variant="primary" size="lg">
              Add your first recipe
            </ButtonLink>
            <Button variant="secondary" size="lg" icon={<Sparkles size={18} />} onClick={add} disabled={busy}>
              {busy ? 'Adding…' : `Peek at ${SAMPLE_COUNT} sample recipes`}
            </Button>
          </div>
        </div>
        <div className="first-run__art">
          <WallaSays size={190} pose="wave">
            Hi, I’m Walla! Toss me any recipe and I’ll tidy it up.
          </WallaSays>
        </div>
      </section>
      <ul className="first-run__ways" aria-label="What you can bring">
        <li>
          <Link2 aria-hidden="true" />
          <div>
            <h2>A link</h2>
            <p>From that recipe site you found during nap time.</p>
          </div>
        </li>
        <li>
          <ImageIcon aria-hidden="true" />
          <div>
            <h2>A screenshot or photo</h2>
            <p>An Instagram post, a cookbook page, Mom’s handwritten card.</p>
          </div>
        </li>
        <li>
          <FileText aria-hidden="true" />
          <div>
            <h2>A PDF or document</h2>
            <p>The family recipe file that gets emailed around every holiday.</p>
          </div>
        </li>
        <li>
          <PenLine aria-hidden="true" />
          <div>
            <h2>Straight from memory</h2>
            <p>The dishes you’ve made a hundred times but never wrote down.</p>
          </div>
        </li>
      </ul>
      <p className="first-run__footnote">
        No account needed — recipes stay in this browser. Moving from another device? <Link to="/data">Restore a backup</Link> <ArrowRight size={14} aria-hidden="true" />
      </p>
    </div>
  );
}
