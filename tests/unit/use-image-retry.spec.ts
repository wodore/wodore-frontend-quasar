// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  useImageRetry,
  filterOutFailed,
  MAX_IMAGE_RETRIES,
} from '@composables/useImageRetry';

/** Fake <img> element recording src writes. */
function makeImg(src = 'http://img.test/a.jpg') {
  const el = {
    _src: src,
    writes: [] as string[],
    get src() {
      return el._src;
    },
    set src(value: string) {
      el._src = value;
      el.writes.push(value);
    },
    getAttribute: (name: string) => (name === 'src' ? el._src : null),
    setAttribute: (name: string, value: string) => {
      if (name === 'src') {
        el.src = value;
      }
    },
  };
  return el;
}

const errorEvent = (target: unknown) => ({ target }) as unknown as Event;

describe('useImageRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('re-assigns the same src on the 1s/3s/7s schedule', () => {
    const { handleError } = useImageRetry();
    const el = makeImg();

    expect(handleError('img-1', 'main', errorEvent(el))).toBe(false);
    vi.advanceTimersByTime(999);
    expect(el.writes).toHaveLength(0);
    vi.advanceTimersByTime(1);
    expect(el.writes).toEqual(['http://img.test/a.jpg']);

    expect(handleError('img-1', 'main', errorEvent(el))).toBe(false);
    vi.advanceTimersByTime(2999);
    expect(el.writes).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(el.writes).toHaveLength(2);

    expect(handleError('img-1', 'main', errorEvent(el))).toBe(false);
    vi.advanceTimersByTime(6999);
    expect(el.writes).toHaveLength(2);
    vi.advanceTimersByTime(1);
    expect(el.writes).toHaveLength(3);
    // Same URL every time - no cache-busting
    expect(el.writes.every(w => w === 'http://img.test/a.jpg')).toBe(true);
  });

  it('success clears pending retry state', () => {
    const { handleError, markLoaded } = useImageRetry();
    const el = makeImg();

    handleError('img-1', 'main', errorEvent(el));
    markLoaded('img-1', 'main');
    vi.advanceTimersByTime(60000);
    expect(el.writes).toHaveLength(0);

    // Counter reset: the next failure starts from retry 1 again
    expect(handleError('img-1', 'main', errorEvent(el))).toBe(false);
  });

  it('keeps retry counters per slot (main vs thumb)', () => {
    const { handleError } = useImageRetry();
    const main = makeImg();
    const thumb = makeImg();

    // Two errors on different slots of the same image id: both still retrying
    expect(handleError('img-1', 'main', errorEvent(main))).toBe(false);
    expect(handleError('img-1', 'thumb', errorEvent(thumb))).toBe(false);
    vi.advanceTimersByTime(1000);
    expect(main.writes).toHaveLength(1);
    expect(thumb.writes).toHaveLength(1);
  });

  it('marks the image failed after 4 total attempts', () => {
    const { handleError, failedImageIds } = useImageRetry();
    const el = makeImg();

    for (let attempt = 0; attempt < MAX_IMAGE_RETRIES; attempt++) {
      expect(handleError('img-1', 'main', errorEvent(el))).toBe(false);
      vi.advanceTimersByTime(7001);
    }
    expect(failedImageIds.value.has('img-1')).toBe(false);

    expect(handleError('img-1', 'main', errorEvent(el))).toBe(true);
    expect(failedImageIds.value.has('img-1')).toBe(true);
  });
});

describe('filterOutFailed', () => {
  it('excludes failed ids and keeps order', () => {
    const images = [{ id: 'a' }, { id: 'b' }, { id: 'c' }];
    expect(filterOutFailed(images, new Set(['b']))).toEqual([{ id: 'a' }, { id: 'c' }]);
    expect(filterOutFailed(images, new Set())).toEqual(images);
    expect(filterOutFailed(images, new Set(['a', 'b', 'c']))).toEqual([]);
  });
});
