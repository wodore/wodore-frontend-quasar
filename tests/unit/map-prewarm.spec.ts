import { describe, it, expect } from 'vitest';
import { styleAssetUrls, spriteVariantUrl } from '@services/map-prewarm';
import type { StyleSpecification } from 'maplibre-gl';

/** Staged-map prewarm URL grammar: MapLibre loads `sprite.json` /
 *  `sprite@2x.json` with the suffix BEFORE the query string. */
describe('map-prewarm styleAssetUrls', () => {
  it('warms TileJSON urls and sprite variants with the suffix before the query', () => {
    const style = {
      version: 8,
      sources: {
        mtk: { type: 'vector', url: 'https://tiles.example.com/mtk.json?v=abc' },
        dem: { type: 'raster-dem', tiles: ['https://dem.example.com/{z}/{x}/{y}.webp'] },
      },
      sprite: [
        { id: 'sdf', url: 'https://icons.example.com/sprite?v=02200ad9' },
        { id: 'wd-maps', url: 'https://tiles.example.com/sprite/wd-maps' },
      ],
    } as unknown as StyleSpecification;

    expect(styleAssetUrls(style)).toEqual([
      'https://tiles.example.com/mtk.json?v=abc',
      'https://icons.example.com/sprite.json?v=02200ad9',
      'https://icons.example.com/sprite@2x.json?v=02200ad9',
      'https://tiles.example.com/sprite/wd-maps.json',
      'https://tiles.example.com/sprite/wd-maps@2x.json',
    ]);
  });

  it('spriteVariantUrl never glues the suffix onto the query value', () => {
    expect(spriteVariantUrl('https://x.example/sprite?a=1', '.json')).toBe(
      'https://x.example/sprite.json?a=1'
    );
    expect(spriteVariantUrl('https://x.example/sprite', '@2x.json')).toBe(
      'https://x.example/sprite@2x.json'
    );
  });
});
