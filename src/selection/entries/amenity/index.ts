/**
 * Amenity entry — the ten amenity-subtree overlays (restaurant, …,
 * automotive): geoplace symbols on catalog-driven styles. Minimal popup
 * (name, type icon, elevation) via the place framework; the popup paints
 * instantly from tile properties and enriches from the geoplace detail
 * (fetch below) — tiles carry no `elevation`/`category_identifier` until
 * the backend tile-fields PR lands, and no localized name below the
 * style's label zoom.
 *
 * Claim-based resolution: map clicks know the entry from the layer
 * claim (tile props carry no taxonomy); the MatchSpec serves search
 * rows and probe payloads (domain 'amenity' — must sit AFTER the
 * accommodation entry so accommodation-kind rows keep their detail).
 */
import { definePresentation } from '@selection/types';
import { AMENITY_LAYERS } from '@selection/map-layer-ids';
import { fetchAmenityDetail, type AmenityDetail } from './fetch';

export type { AmenityDetail } from './fetch';

export const amenityEntry = definePresentation<AmenityDetail>({
  id: 'amenity',
  match: { source: 'geoplace', domain: 'amenity' },
  capabilities: ['popup'],
  // Transport grammar: the popup renders icon + type eyebrow + NAME
  // itself — the shell must not sit a detached name strip above the
  // card (owner review 2026-11).
  popupOwnsTitle: true,
  surfaces: () => import('./surfaces'),
  fetch: ctx => fetchAmenityDetail({ id: ctx.id, lang: ctx.lang, signal: ctx.signal }),
  mapLayers: AMENITY_LAYERS.map(({ layer, minZoom }) => ({
    layer,
    minZoom,
    idProp: 'slug',
  })),
});
