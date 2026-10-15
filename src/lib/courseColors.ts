import type { CSSProperties } from 'react';

export type Hue = 'tomato' | 'marigold' | 'herb' | 'blueberry' | 'fig' | 'grapefruit' | 'olive';

const COURSE_HUES: Record<string, Hue> = {
  breakfast: 'marigold',
  brunch: 'grapefruit',
  lunch: 'herb',
  dinner: 'tomato',
  snack: 'olive',
  dessert: 'fig',
  appetizer: 'grapefruit',
  'side dish': 'herb',
  drink: 'blueberry',
  'sauce & condiment': 'tomato',
  baking: 'marigold',
  other: 'olive'
};

const ROTATION: Hue[] = ['blueberry', 'fig', 'herb', 'marigold', 'grapefruit', 'tomato', 'olive'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Every course has a color; courses the user adds get a stable one from the palette. */
export function courseHue(course: string | null | undefined): Hue {
  const key = (course ?? 'other').toLowerCase();
  return COURSE_HUES[key] ?? ROTATION[hash(key) % ROTATION.length];
}

/** Sets --c / --c-ink / --c-wash for an element, so its accents follow the course color. */
export function hueStyle(hue: Hue): CSSProperties {
  return { '--c': `var(--${hue})`, '--c-ink': `var(--${hue}-ink)`, '--c-wash': `var(--${hue}-wash)` } as CSSProperties;
}

export function courseStyle(course: string | null | undefined): CSSProperties {
  return hueStyle(courseHue(course));
}
