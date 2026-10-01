// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  IMAGE_SIZES,
  effectiveSize,
  variantUrl,
  orientationUrls,
  thumbhashFor,
  thumbhashStyleForSize,
} from '@/utils/imageVariants';
import type { HutImage } from '@composables/useHutImages';
import type { ImageVariantUrls } from 'src/types/geo';

const makeVariantUrls = (prefix: string): ImageVariantUrls => ({
  xs: `${prefix}-xs`,
  sm: `${prefix}-sm`,
  md: `${prefix}-md`,
  lg: `${prefix}-lg`,
  xl: `${prefix}-xl`,
});

const makeImage = (overrides: Partial<HutImage> = {}): HutImage =>
  ({
    id: 'img-1',
    is_portrait: false,
    ...overrides,
    urls: {
      square: makeVariantUrls('square'),
      landscape: makeVariantUrls('landscape'),
      portrait: makeVariantUrls('portrait'),
      original: { raw: 'original-raw', proxy: 'original-proxy' },
    },
  }) as unknown as HutImage;

describe('IMAGE_SIZES', () => {
  it('orders t-shirt sizes small to large', () => {
    expect(IMAGE_SIZES).toEqual(['xs', 'sm', 'md', 'lg', 'xl']);
  });
});

describe('effectiveSize', () => {
  it('returns the size itself on 1x displays', () => {
    window.devicePixelRatio = 1;
    expect(effectiveSize('md')).toBe('md');
  });

  it('steps one size up on retina and clamps at xl', () => {
    window.devicePixelRatio = 2;
    expect(effectiveSize('md')).toBe('lg');
    expect(effectiveSize('xl')).toBe('xl');
  });
});

describe('variantUrl', () => {
  it('returns the requested variant on 1x displays', () => {
    window.devicePixelRatio = 1;
    expect(variantUrl(makeVariantUrls('sq'), 'xs')).toBe('sq-xs');
    expect(variantUrl(makeVariantUrls('land'), 'md')).toBe('land-md');
  });

  it('returns the next size up on retina displays', () => {
    window.devicePixelRatio = 2;
    expect(variantUrl(makeVariantUrls('sq'), 'xs')).toBe('sq-sm');
  });

  it('falls back down the ladder when the target variant is missing', () => {
    window.devicePixelRatio = 1;
    const urls = makeVariantUrls('x');
    urls.md = '';
    expect(variantUrl(urls, 'md')).toBe('x-sm');
  });

  it('returns an empty string for missing url groups', () => {
    expect(variantUrl(undefined, 'md')).toBe('');
  });
});

describe('orientationUrls', () => {
  it('uses the portrait group for portrait images', () => {
    const image = makeImage({ is_portrait: true });
    expect(orientationUrls(image)).toBe(image.urls.portrait);
  });

  it('uses the landscape group otherwise, with portrait as fallback', () => {
    const landscape = makeImage({ is_portrait: false });
    expect(orientationUrls(landscape)).toBe(landscape.urls.landscape);

    landscape.urls.landscape = undefined as unknown as HutImage['urls']['landscape'];
    expect(orientationUrls(landscape)).toBe(landscape.urls.portrait);
  });
});

describe('thumbhashFor', () => {
  it('picks the hash matching aspect group and crop style', () => {
    const image = makeImage({
      thumbhashes: {
        thumb_square: 'a',
        thumb_landscape: 'b',
        thumb_portrait: 'c',
        preview_square: 'd',
        preview_landscape: 'e',
        preview_portrait: 'f',
      },
    });

    expect(thumbhashFor(image, 'square', 'focal')).toBe('a');
    expect(thumbhashFor(image, 'landscape', 'focal')).toBe('b');
    expect(thumbhashFor(image, 'portrait', 'focal')).toBe('c');
    expect(thumbhashFor(image, 'square', 'curated')).toBe('d');
    expect(thumbhashFor(image, 'orientation', 'curated')).toBe('e');
    expect(thumbhashFor({ ...image, is_portrait: true }, 'orientation', 'focal')).toBe('c');
  });

  it('returns an empty string when the image carries no hashes', () => {
    // The API always fills all six hashes (gray gradient placeholder);
    // an absent hashes object degrades gracefully to '' instead of crashing
    expect(thumbhashFor(makeImage(), 'square', 'focal')).toBe('');
    expect(thumbhashFor({ is_portrait: false }, 'square', 'focal')).toBe('');
  });
});

describe('thumbhashStyleForSize', () => {
  // Real ThumbHash of a solid-red 16x16 image (generated with the reference
  // encoder at https://github.com/evanw/thumbhash)
  const redHash = '1fsDBwBnaix4iHdyeJiHeIeIgMB3CHwH';

  it('returns a background style for a present hash', () => {
    const image = makeImage({
      thumbhashes: {
        thumb_square: redHash,
        thumb_landscape: redHash,
        thumb_portrait: redHash,
        preview_square: redHash,
        preview_landscape: redHash,
        preview_portrait: redHash,
      },
    });

    const style = thumbhashStyleForSize(image, 'square', 'xs');
    expect(style?.backgroundImage).toMatch(/^url\("data:image\/png;base64,/);
    expect(style?.backgroundSize).toBe('cover');
  });

  it('returns undefined when the image has no thumbhashes at all', () => {
    expect(thumbhashStyleForSize(makeImage(), 'square', 'xs')).toBeUndefined();
  });
});
