import type { CSSProperties } from 'react';

export type Hue = 'orange' | 'butter' | 'mint' | 'sky' | 'lilac' | 'blush';

const COURSE_HUES: Record<string, Hue> = {
  breakfast: 'butter',
  brunch: 'blush',
  lunch: 'mint',
  dinner: 'orange',
  snack: 'lilac',
  dessert: 'blush',
  appetizer: 'lilac',
  'side dish': 'mint',
  drink: 'sky',
  'sauce & condiment': 'orange',
  baking: 'butter',
  other: 'sky'
};

export const HUES: Hue[] = ['orange', 'butter', 'mint', 'sky', 'lilac', 'blush'];

export function hashString(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

/** Every course has a color; courses the user adds get a stable one from the palette. */
export function courseHue(course: string | null | undefined): Hue {
  const key = (course ?? 'other').toLowerCase();
  return COURSE_HUES[key] ?? HUES[hashString(key) % HUES.length];
}

export function hueStyle(hue: Hue): CSSProperties {
  return { '--c': `var(--${hue})`, '--c-ink': `var(--${hue}-ink)`, '--c-wash': `var(--${hue}-wash)` } as CSSProperties;
}

export function courseStyle(course: string | null | undefined): CSSProperties {
  return hueStyle(courseHue(course));
}

export function textHueStyle(text: string): CSSProperties {
  return hueStyle(HUES[hashString(text.toLowerCase()) % HUES.length]);
}
