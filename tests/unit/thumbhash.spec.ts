// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest';
import {
  thumbHashToRGBA,
  thumbHashToApproximateAspectRatio,
  thumbhashDataUrl,
} from '@/utils/thumbhash';

// Real hashes generated with the reference encoder
// (https://github.com/evanw/thumbhash, js/thumbhash.js)
const RED_SQUARE_16 = '1fsDBwBnaix4iHdyeJiHeIeIgMB3CHwH'; // solid red 16x16
const BLUE_LANDSCAPE_24x16 = 'FQACBYBNSW+Hh4iIiId4h/SJCQAA'; // solid blue 24x16

// Backend default placeholder hashes (unassessed images) — gray gradient,
// aspect-correct per group (server/apps/geometries/schemas/_images.py)
const GRAY_SQUARE = 'IQgGBwB4eIiPiId4iJiIeIh4BwAAAAAA';
const GRAY_LANDSCAPE = 'IQgGBYB4eHiPiIeIiJiIdwAAAAAA';
const GRAY_PORTRAIT = 'IQgGBQB4eI+HeIiIh4eIdwAAAAAA';

const bytes = (hash: string): Uint8Array => {
  const binary = atob(hash);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
};

describe('thumbHashToApproximateAspectRatio', () => {
  it('recovers the approximate aspect ratio', () => {
    expect(thumbHashToApproximateAspectRatio(bytes(RED_SQUARE_16))).toBeCloseTo(1, 0);
    expect(thumbHashToApproximateAspectRatio(bytes(BLUE_LANDSCAPE_24x16))).toBeCloseTo(1.5, 0);
  });
});

describe('thumbHashToRGBA', () => {
  it('decodes to a ~32px image matching the hash aspect', () => {
    const square = thumbHashToRGBA(bytes(RED_SQUARE_16));
    expect(square.w).toBe(32);
    expect(square.h).toBe(32);
    expect(square.rgba).toHaveLength(32 * 32 * 4);

    const landscape = thumbHashToRGBA(bytes(BLUE_LANDSCAPE_24x16));
    expect(landscape.w).toBe(32);
    expect(landscape.h).toBeGreaterThan(15);
    expect(landscape.h).toBeLessThan(32);

    // Solid-color input decodes back to (approximately) that color
    const center = ((landscape.w * landscape.h) / 2) * 4;
    expect(landscape.rgba[center]!).toBeLessThan(80); // r
    expect(landscape.rgba[center + 2]!).toBeGreaterThan(180); // b
  });
});

describe('thumbhashDataUrl', () => {
  it('produces a PNG data URL', () => {
    const url = thumbhashDataUrl(RED_SQUARE_16);
    expect(url).toMatch(/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/);
  });

  it('is memoized per hash', () => {
    expect(thumbhashDataUrl(RED_SQUARE_16)).toBe(thumbhashDataUrl(RED_SQUARE_16));
  });

  it('returns null for missing or malformed hashes', () => {
    expect(thumbhashDataUrl(null)).toBeNull();
    expect(thumbhashDataUrl(undefined)).toBeNull();
    expect(thumbhashDataUrl('')).toBeNull();
    expect(thumbhashDataUrl('!!!not-base64!!!')).toBeNull();
  });
});

describe('backend default placeholder hashes', () => {
  it('decode to aspect-correct gray gradients', () => {
    const square = thumbHashToRGBA(bytes(GRAY_SQUARE));
    expect(square.w).toBe(32);
    expect(square.h).toBe(32);

    const landscape = thumbHashToRGBA(bytes(GRAY_LANDSCAPE));
    expect(landscape.w / landscape.h).toBeGreaterThan(1.3);

    const portrait = thumbHashToRGBA(bytes(GRAY_PORTRAIT));
    expect(portrait.w / portrait.h).toBeLessThan(0.75);

    // All three produce valid data URLs (used directly as loading backgrounds)
    for (const hash of [GRAY_SQUARE, GRAY_LANDSCAPE, GRAY_PORTRAIT]) {
      expect(thumbhashDataUrl(hash)).toMatch(/^data:image\/png;base64,/);
    }
  });
});
