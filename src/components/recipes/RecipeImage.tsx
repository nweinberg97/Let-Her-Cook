import { useState } from 'react';
import type { HeroImage } from '../../types/recipe';
import { courseStyle } from '../../lib/courseColors';

/**
 * Shows the recipe's own photo, or — when there isn't one, or a linked photo
 * has disappeared — an index card with the title written on it. We never show
 * a stock or generated photo pretending to be the dish.
 */
export function RecipeImage({
  image,
  title,
  variant = 'card',
  course
}: {
  image: HeroImage | null;
  title: string;
  variant?: 'card' | 'hero';
  course?: string;
}) {
  const [failed, setFailed] = useState(false);
  const src = image ? (variant === 'card' ? image.thumb ?? image.src : image.src) : null;

  if (src && !failed) {
    return (
      <img
        className={`recipe-img recipe-img--${variant}`}
        src={src}
        alt={image?.alt ?? ''}
        loading={variant === 'card' ? 'lazy' : 'eager'}
        decoding="async"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }
  return <IndexCard title={title} variant={variant} course={course} />;
}

export function IndexCard({ title, variant = 'card', course }: { title: string; variant?: 'card' | 'hero'; course?: string }) {
  return (
    <div className={`index-card index-card--${variant}`} style={courseStyle(course)} aria-hidden="true">
      <span className="index-card__course">{course ?? ''}</span>
      <span className="index-card__title">{title || 'Untitled recipe'}</span>
    </div>
  );
}
