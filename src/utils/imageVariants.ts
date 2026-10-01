import type { HutImage } from '@composables/useHutImages';
import type { ImageThumbhashes, ImageVariantUrls } from 'src/types/geo';
import { thumbhashDataUrl } from './thumbhash';

/**
 * T-shirt size keys, ordered small → large (long edge):
 * xs ~200px · sm ~400px · md ~1200px · lg ~2000px · xl ~4000px.
 * xs/sm are focal-cropped (zoomed), md–xl use the curated crop.
 */
export const IMAGE_SIZES = ['xs', 'sm', 'md', 'lg', 'xl'] as const;

export type ImageSize = (typeof IMAGE_SIZES)[number];

const isRetina = (): boolean =>
  typeof window !== 'undefined' && (window.devicePixelRatio || 1) > 1;

/** The size actually served for `size`: the next size up on HiDPI, clamped at xl. */
export function effectiveSize(size: ImageSize): ImageSize {
  const index = IMAGE_SIZES.indexOf(size);
  return IMAGE_SIZES[Math.min(index + (isRetina() ? 1 : 0), IMAGE_SIZES.length - 1)];
}

/**
 * Pick the URL for `size` from one aspect group. HiDPI devices
 * (devicePixelRatio > 1) get the next size up, clamped at xl —
 * e.g. xs → sm on retina, matching the thumb@2x → sm mapping.
 * Falls back down the size ladder when a variant is missing.
 */
export function variantUrl(urls: ImageVariantUrls | null | undefined, size: ImageSize): string {
  if (!urls) return '';

  const target = effectiveSize(size);
  const index = IMAGE_SIZES.indexOf(size);

  // Retina target first, then the requested size, then the next smaller ones
  const candidates = [target, size, ...IMAGE_SIZES.slice(0, index).reverse()];
  for (const key of candidates) {
    const url = urls[key];
    if (url) return url;
  }
  return '';
}

/**
 * The aspect-group URLs matching the image's own orientation:
 * urls.portrait when `is_portrait`, else urls.landscape (either group is a
 * defensive fallback — the API always provides both).
 */
export function orientationUrls(
  image: Pick<HutImage, 'urls' | 'is_portrait'>
): ImageVariantUrls | undefined {
  if (!image.urls) return undefined;
  return image.is_portrait ? (image.urls.portrait ?? image.urls.landscape) : (image.urls.landscape ?? image.urls.portrait);
}

export type ThumbhashAspect = 'square' | 'landscape' | 'portrait' | 'orientation';
export type ThumbhashCrop = 'focal' | 'curated';

/**
 * The ThumbHash placeholder matching a rendering context:
 * `focal` hashes match xs/sm URLs (zoomed crop), `curated` ones match md+
 * URLs. `aspect: 'orientation'` picks landscape/portrait via `is_portrait`.
 * Returns null when the image has no hash for that context yet.
 */
export function thumbhashFor(
  image: Pick<HutImage, 'thumbhashes' | 'is_portrait'>,
  aspect: ThumbhashAspect,
  crop: ThumbhashCrop
): string | null {
  const hashes = image.thumbhashes;
  if (!hashes) return null;
  const group = aspect === 'orientation' ? (image.is_portrait ? 'portrait' : 'landscape') : aspect;
  const key = `${crop === 'focal' ? 'thumb' : 'preview'}_${group}` as keyof ImageThumbhashes;
  return hashes[key] ?? null;
}

/**
 * Inline CSS style placing the decoded ThumbHash as an instant blurred
 * background behind the image (covered by the image once it loads).
 * Returns undefined when no placeholder is available.
 */
export function thumbhashStyle(
  image: Pick<HutImage, 'thumbhashes' | 'is_portrait'>,
  aspect: ThumbhashAspect,
  crop: ThumbhashCrop
): Record<string, string> | undefined {
  const url = thumbhashDataUrl(thumbhashFor(image, aspect, crop));
  if (!url) return undefined;
  return {
    backgroundImage: `url("${url}")`,
    backgroundSize: 'cover',
    backgroundPosition: 'center',
  };
}

/**
 * thumbhashStyle with the crop style derived from the size actually served
 * (effectiveSize): xs/sm use focal-cropped hashes, md+ curated ones.
 */
export function thumbhashStyleForSize(
  image: Pick<HutImage, 'thumbhashes' | 'is_portrait'>,
  aspect: ThumbhashAspect,
  size: ImageSize
): Record<string, string> | undefined {
  const eff = effectiveSize(size);
  const crop: ThumbhashCrop = eff === 'xs' || eff === 'sm' ? 'focal' : 'curated';
  return thumbhashStyle(image, aspect, crop);
}
