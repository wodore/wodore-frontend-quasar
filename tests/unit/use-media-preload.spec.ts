// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ref } from 'vue';
import { useMediaPreload, RETRY_DELAYS_MS, getRetryDelayMs } from '@composables/useMediaPreload';
import type { HutImage } from '@composables/useHutImages';
import type { ImageVariantUrls } from 'src/types/geo';

const makeVariantUrls = (prefix: string): ImageVariantUrls => ({
  xs: `${prefix}-xs`,
  sm: `${prefix}-sm`,
  md: `${prefix}-md`,
  lg: `${prefix}-lg`,
  xl: `${prefix}-xl`,
});

/** Minimal image fixture — only fields the composable reads. */
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

class FakeImage {
  static instances: FakeImage[] = [];
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  src = '';

  constructor() {
    FakeImage.instances.push(this);
  }
}

describe('retry schedule', () => {
  it('uses the 1s/3s/7s schedule and clamps beyond it', () => {
    expect(RETRY_DELAYS_MS).toEqual([1000, 3000, 7000]);
    expect(getRetryDelayMs(0)).toBe(1000);
    expect(getRetryDelayMs(1)).toBe(3000);
    expect(getRetryDelayMs(2)).toBe(7000);
    expect(getRetryDelayMs(5)).toBe(7000);
  });
});

describe('useMediaPreload.preloadImage', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    FakeImage.instances = [];
    vi.stubGlobal('Image', FakeImage);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  const setup = () => useMediaPreload(ref([makeImage()]), ref(0));

  it('retries with the fixed schedule and succeeds on a later attempt', () => {
    const { preloadedUrls, preloadImage } = setup();

    preloadImage('http://img.test/a.jpg');

    // Attempt 1 fails -> retry after 1s
    FakeImage.instances[0].onerror?.();
    expect(FakeImage.instances).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(FakeImage.instances).toHaveLength(2);

    // Attempt 2 fails -> retry after 3s
    FakeImage.instances[1].onerror?.();
    vi.advanceTimersByTime(2999);
    expect(FakeImage.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeImage.instances).toHaveLength(3);

    // Attempt 3 succeeds -> marked preloaded, no further attempts
    FakeImage.instances[2].onload?.();
    expect(preloadedUrls.value.has('http://img.test/a.jpg')).toBe(true);
    vi.advanceTimersByTime(60000);
    expect(FakeImage.instances).toHaveLength(3);
  });

  it('gives up after maxRetries exhausted attempts', () => {
    const { preloadImage } = setup();
    preloadImage('http://img.test/b.jpg', { maxRetries: 3 });

    // Retry 1 after 1s
    FakeImage.instances[0].onerror?.();
    vi.advanceTimersByTime(999);
    expect(FakeImage.instances).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(FakeImage.instances).toHaveLength(2);

    // Retry 2 after 3s
    FakeImage.instances[1].onerror?.();
    vi.advanceTimersByTime(2999);
    expect(FakeImage.instances).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(FakeImage.instances).toHaveLength(3);

    // Retry 3 after 7s
    FakeImage.instances[2].onerror?.();
    vi.advanceTimersByTime(6999);
    expect(FakeImage.instances).toHaveLength(3);
    vi.advanceTimersByTime(1);
    expect(FakeImage.instances).toHaveLength(4);

    // Final attempt fails -> no further retries
    FakeImage.instances[3].onerror?.();
    vi.advanceTimersByTime(60000);
    expect(FakeImage.instances).toHaveLength(4);
  });
});

describe('useMediaPreload source picking', () => {
  beforeEach(() => {
    vi.stubGlobal('devicePixelRatio', 1);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const stubSmallScreen = () => {
    vi.stubGlobal('innerWidth', 800);
    vi.stubGlobal('innerHeight', 600);
  };

  const stubLargeScreen = () => {
    vi.stubGlobal('innerWidth', 1920);
    vi.stubGlobal('innerHeight', 1400);
  };

  it('picks the portrait variant when the image is portrait', () => {
    const portrait = makeImage({ id: 'p', is_portrait: true });
    const { getGalleryImageUrl } = useMediaPreload(ref([portrait]), ref(0));

    // Small screen -> md size, from the portrait orientation block
    stubSmallScreen();
    expect(getGalleryImageUrl(portrait)).toBe('portrait-md');
  });

  it('falls back to landscape variants for portrait images without portrait urls', () => {
    const portrait = makeImage({ id: 'p-no-portrait', is_portrait: true });
    portrait.urls.portrait = undefined as unknown as HutImage['urls']['portrait'];
    const { getGalleryImageUrl } = useMediaPreload(ref([portrait]), ref(0));

    // Small screen -> md; no portrait urls present, so the landscape
    // block is used as fallback
    stubSmallScreen();
    expect(getGalleryImageUrl(portrait)).toBe('landscape-md');
  });

  it('falls back through smaller sizes when a variant is missing', () => {
    const image = makeImage();
    image.urls.landscape.md = '';
    const { getGalleryImageUrl } = useMediaPreload(ref([image]), ref(0));

    stubSmallScreen();
    expect(getGalleryImageUrl(image)).toBe('landscape-sm');
  });

  it('uses lg on large screens (medium -> md, large -> lg)', () => {
    const image = makeImage();
    const { getGalleryImageUrl } = useMediaPreload(ref([image]), ref(0));

    stubLargeScreen();
    expect(getGalleryImageUrl(image)).toBe('landscape-lg');
  });

  it('serves the next size up for retina displays', () => {
    vi.stubGlobal('devicePixelRatio', 2);
    const image = makeImage();
    const { getGalleryImageUrl, getThumbnailUrl, getPreviewImageUrl } = useMediaPreload(
      ref([image]),
      ref(0)
    );

    stubSmallScreen();
    // md -> lg on retina
    expect(getGalleryImageUrl(image)).toBe('landscape-lg');
    // square thumb xs -> sm on retina
    expect(getThumbnailUrl(image)).toBe('square-sm');
    // preview sm -> md on retina
    expect(getPreviewImageUrl(image)).toBe('landscape-md');
  });

  it('clamps the retina bump at xl', () => {
    vi.stubGlobal('devicePixelRatio', 3);
    const image = makeImage();
    const { getGalleryImageUrl } = useMediaPreload(ref([image]), ref(0));

    stubLargeScreen();
    // lg + retina bump -> xl (there is nothing beyond xl)
    expect(getGalleryImageUrl(image)).toBe('landscape-xl');
  });

  it('uses the orientation group for preview urls of portrait images', () => {
    const portrait = makeImage({ id: 'p-preview', is_portrait: true });
    const { getPreviewImageUrl } = useMediaPreload(ref([portrait]), ref(0));

    expect(getPreviewImageUrl(portrait)).toBe('portrait-sm');
  });
});
