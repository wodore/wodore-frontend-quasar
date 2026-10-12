import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';

import hybridOverlayLayers from '@assets/map-styles/satellite-hybrid-overlay.json';
import { getRasterStyle } from './raster';

/**
 * Hybrid satellite style: the world_satellite raster facade beneath a
 * street/place-name overlay rendered from the OpenFreeMap planet source
 * (OpenMapTiles schema) — the same vector data family as the
 * wd-outdoor-base-ofm style. Restores the "hybrid" look the former
 * MapTiler satellite basemap provided (streets + town labels over the
 * imagery) without the key-metered dependency.
 *
 * The overlay layer definitions live in
 * src/assets/map-styles/satellite-hybrid-overlay.json: they are derived
 * from wd-outdoor-base-ofm (tile_server styles in wodore-backend) —
 * same filters, zoom ramps and layout — with colors re-tuned for
 * readability on aerial imagery: dark translucent casings, white and
 * yellow road fills, white labels with a dark halo (the ofm palette is
 * designed for light map backgrounds and disappears on photos).
 * Tunnels (invisible on imagery), rail, trails, service tracks and
 * road-name labels are deliberately left out to keep the overlay lean;
 * hut overlay layers still render above everything.
 */
export interface SatelliteHybridArgs {
  /** Raster tile templates (world_satellite facade). */
  tiles: string[];
  attribution: string;
  /** Raster source maxzoom (the facade stops at z19). */
  sourceMaxZoom?: number;
  /** OpenMapTiles-schema vector TileJSON (OpenFreeMap planet). */
  vectorUrl: string;
  /** Glyph endpoint serving the Noto Sans family (Regular/Bold/Italic). */
  glyphs: string;
  /** Sprite for the settlement dots on the place labels (ofm sprite). */
  spriteUrl: string;
}

/** Compose the hybrid satellite style: raster imagery beneath the
 *  street/place overlay from the vector source. */
export function getSatelliteHybridStyle({
  tiles,
  attribution,
  sourceMaxZoom,
  vectorUrl,
  glyphs,
  spriteUrl,
}: SatelliteHybridArgs): StyleSpecification {
  const style = getRasterStyle({
    name: 'satellite-raster',
    tiles,
    attribution,
    suffix: '',
    sourceMaxZoom,
  });
  style.name = 'satellite-hybrid';
  // Label fonts: the overlay layers use Noto Sans Regular/Bold/Italic
  style.glyphs = glyphs;
  // Settlement dots on the place labels (circle_11_black, scaled 0.2) —
  // id must not collide with the hut overlay sprite ('wd')
  style.sprite = [{ id: 'ofm-satellite', url: spriteUrl }];
  style.sources.openmaptiles = { type: 'vector', url: vectorUrl };
  style.layers.push(...(hybridOverlayLayers as LayerSpecification[]));
  return style;
}
