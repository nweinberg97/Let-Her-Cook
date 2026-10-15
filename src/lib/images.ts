import type { HeroImage } from '../types/recipe';

/**
 * Converts a photo the user chose to keep into compact, re-encoded images:
 * a display version (max 1400px) and a thumbnail (max 480px), as data URLs.
 * Re-encoding through a canvas also drops EXIF metadata such as GPS location.
 */
export async function makeStoredImage(file: Blob, alt: string | null): Promise<HeroImage> {
  const bitmap = await createImageBitmap(file).catch(() => {
    throw new Error('We couldn’t open that image. Try a JPG, PNG or WebP photo.');
  });
  try {
    const src = encode(bitmap, 1400, 0.82);
    const thumb = encode(bitmap, 480, 0.75);
    return { src, thumb, alt, credit: null, origin: 'local' };
  } finally {
    bitmap.close();
  }
}

function encode(bitmap: ImageBitmap, maxSide: number, quality: number): string {
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Image processing isn’t available in this browser.');
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  let url = canvas.toDataURL('image/webp', quality);
  if (!url.startsWith('data:image/webp')) url = canvas.toDataURL('image/jpeg', quality);
  canvas.width = 0;
  canvas.height = 0;
  return url;
}
