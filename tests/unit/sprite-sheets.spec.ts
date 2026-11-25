/**
 * Sprite sheets shared between sprite ids (utils/sprite-sheets.ts).
 *
 * MapLibre admits one sprite id per URL and rejects map.addSprite silently
 * on a conflict; the backend's basemap presence packs and the overlays
 * that replace or accompany them name the same sheets (transport's
 * `wd-transport` ‖ `wd-basemap-transport`, huts' `wd-sdf` ‖ the
 * accommodations presence). Evicting the holder would cost a visible
 * layer its sheet (huts is on by default), so the sheet is shared.
 */
import { describe, it, expect, vi, afterEach } from 'vitest';
import type { StyleImage, StyleImageMetadata, StyleImageSource } from 'maplibre-gl';
import { shareSpriteImages } from '@stores/map/utils/sprite-sheets';

/** A StyleImage with an RGBAImage-shaped pixel block (the public surface of MapLibre's class). */
function image(tag: string): StyleImage {
  const data = {
    width: 1,
    height: 1,
    data: new Uint8Array([0, 0, 0, tag.charCodeAt(0)]),
    resize: () => {},
    replace: () => {},
    clone: () => data,
    setPixel: () => {},
  };
  return { data, pixelRatio: 1, sdf: true };
}

/** A MapLibre-like image store: images keyed by name, sheets keyed by sprite id. */
function fakeMap(sheets: Record<string, string[]>) {
  const images = new Map<string, StyleImage>();
  const added: Array<[string, StyleImage]> = [];
  let rejectDuplicates = false;
  for (const [id, names] of Object.entries(sheets)) {
    for (const name of names) images.set(`${id}:${name}`, image(name));
  }
  return {
    images,
    added,
    rejectDuplicateIds: () => (rejectDuplicates = true),
    map: {
      listImages: () => [...images.keys()],
      hasImage: (id: string) => images.has(id),
      getImage: (id: string) => images.get(id),
      // MapLibre's signature: raw pixel source + metadata → a new StyleImage
      addImage: (id: string, source: StyleImageSource, options?: Partial<StyleImageMetadata>) => {
        if (rejectDuplicates && images.has(id)) throw new Error(`Image id ${id} already exist`);
        const img: StyleImage = {
          data: source as StyleImage['data'],
          pixelRatio: 1,
          sdf: false,
          ...options,
        };
        added.push([id, img]);
        images.set(id, img);
      },
    },
  };
}

afterEach(() => vi.useRealTimers());

describe('shareSpriteImages', () => {
  it('registers the loaded sheet under the new id too — same pixel blocks and metadata, the holder untouched', async () => {
    const f = fakeMap({ 'wd-basemap-transport': ['mono/bus', 'mono/train'], other: ['x'] });
    f.rejectDuplicateIds(); // MapLibre throws on duplicate ids: nothing must be re-added
    await expect(shareSpriteImages(f.map, 'wd-basemap-transport', 'wd-transport')).resolves.toBe(
      true
    );
    expect(f.added.map(([id]) => id)).toEqual(['wd-transport:mono/bus', 'wd-transport:mono/train']);
    const [id, shared] = f.added[0]!;
    expect(id).toBe('wd-transport:mono/bus');
    const holder = f.images.get('wd-basemap-transport:mono/bus')!;
    // the pixel block is shared, not copied, and the SDF flag survives
    expect(shared!.data).toBe(holder.data);
    expect(shared!.sdf).toBe(true);
    expect(f.images.has('wd-basemap-transport:mono/bus')).toBe(true); // nothing evicted
    expect(f.images.has('other:x')).toBe(true); // other sheets are not this sheet
  });

  it('is idempotent: a second share adds nothing and resolves at once', async () => {
    const f = fakeMap({ presence: ['a', 'b'] });
    await shareSpriteImages(f.map, 'presence', 'overlay');
    await shareSpriteImages(f.map, 'presence', 'overlay');
    expect(f.added).toHaveLength(2);
  });

  it('completes a partially shared sheet', async () => {
    const f = fakeMap({ presence: ['a', 'b'] });
    f.images.set('overlay:a', image('a'));
    await shareSpriteImages(f.map, 'presence', 'overlay');
    expect(f.added.map(([id]) => id)).toEqual(['overlay:b']);
  });

  it('waits while the holder sheet is still loading, then shares', async () => {
    vi.useFakeTimers();
    const f = fakeMap({}); // nothing registered yet
    const done = vi.fn();
    const promise = shareSpriteImages(f.map, 'wd-sdf-accommodations', 'wd-sdf').then(done);
    // the sheet finishes loading during the backoff poll
    setTimeout(() => {
      f.images.set('wd-sdf-accommodations:mono/hut', image('h'));
    }, 300);
    await vi.advanceTimersByTimeAsync(1000);
    await promise;
    expect(done).toHaveBeenCalledWith(true);
    expect(f.images.has('wd-sdf:mono/hut')).toBe(true);
  });

  it('gives up after the timeout when the sheet never loads', async () => {
    vi.useFakeTimers();
    const f = fakeMap({});
    const promise = shareSpriteImages(f.map, 'missing', 'overlay', 2000);
    await vi.advanceTimersByTimeAsync(2500);
    await expect(promise).resolves.toBe(false);
    expect(f.added).toEqual([]);
  });
});
