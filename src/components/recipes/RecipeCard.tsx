import { Link } from 'react-router-dom';
import { Heart, Clock3 } from 'lucide-react';
import { effectiveTotalMinutes, type Recipe } from '../../types/recipe';
import { formatMinutes } from '../../lib/parsing/quantity';
import { highlightSegments } from '../../lib/search';
import { RecipeImage } from './RecipeImage';
import { courseStyle } from '../../lib/courseColors';
import { useLibrary } from '../../lib/storage/LibraryContext';
import { useToast } from '../ui/Toast';
import { storageErrorMessage } from '../../lib/storage/repository';
import { haptic } from '../../lib/native';

export function RecipeCard({ recipe, query = '' }: { recipe: Recipe; query?: string }) {
  const { repo } = useLibrary();
  const toast = useToast();
  const total = effectiveTotalMinutes(recipe);
  const segments = highlightSegments(recipe.title, query);

  const toggleFavorite = async () => {
    try {
      await repo.updateRecipe(recipe.id, { isFavorite: !recipe.isFavorite });
      void haptic(recipe.isFavorite ? 'tap' : 'success');
    } catch (err) {
      toast.error(storageErrorMessage(err));
    }
  };

  return (
    <article className="recipe-card" style={courseStyle(recipe.course)}>
      <Link to={`/recipes/${recipe.id}`} className="recipe-card__link">
        <div className="recipe-card__media">
          <RecipeImage image={recipe.heroImage} title={recipe.title} course={recipe.course} />
          {recipe.isSample && <span className="recipe-card__badge">Sample</span>}
        </div>
        <div className="recipe-card__body">
          <h3 className="recipe-card__title">
            {segments.map((s, i) => (s.match ? <mark key={i}>{s.text}</mark> : <span key={i}>{s.text}</span>))}
          </h3>
          <p className="recipe-card__meta">
            <span className="recipe-card__course">{recipe.course}</span>
            {recipe.cuisine && <span>{recipe.cuisine}</span>}
            {total != null && (
              <span className="recipe-card__time">
                <Clock3 size={14} aria-hidden="true" />
                <span className="visually-hidden">Total time </span>
                {formatMinutes(total)}
              </span>
            )}
          </p>
        </div>
      </Link>
      <button
        type="button"
        className={`fav-toggle ${recipe.isFavorite ? 'is-on' : ''}`}
        aria-pressed={recipe.isFavorite}
        aria-label={recipe.isFavorite ? `Remove ${recipe.title} from favorites` : `Add ${recipe.title} to favorites`}
        onClick={toggleFavorite}
      >
        <Heart size={18} aria-hidden="true" fill={recipe.isFavorite ? 'currentColor' : 'none'} />
      </button>
    </article>
  );
}
