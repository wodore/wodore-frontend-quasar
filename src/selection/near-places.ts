/**
 * Near-place → target mapping (what's-here). A tap that hits no
 * interactive layer probes `/v1/geoplaces/near` (no zoom, no category,
 * ~50 m radius); the rows map onto place-framework targets and open
 * through the selection store exactly like symbol clicks:
 *
 * - one result: opens the row's entry surface directly (accommodation
 *   kinds → the hut details view; everything else → the amenity popup),
 * - several: the popup shell's candidate list (the disambiguation
 *   switcher built for stacked clicks — `openFromMap` sets candidates).
 *
 * Pure mapping — the adapter (WdMapView) owns the request lifecycle
 * (single-flight, latest wins) and the focus-mode fallthrough.
 */
import { targetKey, type MapTarget, type Presentation } from './types';
import type { NearPlace } from '@services/cluster-members';
import { accommodationEntry } from './entries/accommodation';
import { amenityEntry } from './entries/amenity';

/** Owning entry for a near row: accommodation kinds open the hut
 *  details view (the 404→geoplace wrap), everything else the amenity
 *  popup (generic content, geoplace-detail enrichment). */
export function entryForNearPlace(place: NearPlace): Presentation {
  const parent = place.identifier?.split('.')[0];
  return parent === 'accommodation' ? accommodationEntry : amenityEntry;
}

/** Map one near row to a place target anchored at the tap position
 *  (row positions are unknown client-side — the popup re-anchors once
 *  real tile data is available). */
export function nearPlaceTarget(place: NearPlace, anchor: { lat: number; lon: number }): MapTarget {
  return {
    key: targetKey({ source: 'geoplace', id: place.slug }),
    source: 'geoplace',
    id: place.slug,
    location: { lat: anchor.lat, lon: anchor.lon },
    props: {
      slug: place.slug,
      name: place.name,
      color: place.color,
      parent_color: place.parentColor,
      category_identifier: place.identifier,
      elevation: place.elevation ?? undefined,
    },
  };
}
