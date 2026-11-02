/**
 * usePlace — PR1a COMPAT wrapper over the generalized `usePlaceDetail`
 * engine (OpenSpec `add-place-interactions`). Fetch and seed are owned
 * by the accommodation entry (`src/selection/entries/accommodation/`);
 * this module only maps the legacy slug-driven signature onto it.
 *
 * Public surface is unchanged for the PR1a consumers (WdContentPanel,
 * WdPlace* components, both map views' seedPlaceFromMap calls).
 */
import { computed, ref, type Ref } from 'vue';
import {
  stagePrebuiltSeed,
  usePlaceDetail,
  type PlaceError,
  type PlaceErrorKind,
} from '@composables/usePlaceDetail';
import { targetKey, type MapTarget } from '@selection/types';
import {
  accommodationEntry,
  hutSeedPartial,
  type HutDetails,
} from '@selection/entries/accommodation';

export type { PlaceError, PlaceErrorKind, HutDetails };
export { PlaceRequestError, toPlaceError } from '@composables/usePlaceDetail';

const hutTargetKey = (slug: string): string => targetKey({ source: 'geoplace', id: slug });

/** Seed a hut's identity from a map feature (tile properties + geometry).
 *  Compat shim over the engine's seed cache — map views keep calling it
 *  until the click pipeline lands (PR2). */
export function seedPlaceFromMap(
  slug: string,
  properties: Record<string, unknown>,
  location?: { lat: number; lon: number }
): void {
  if (!slug) return;
  const partial = hutSeedPartial(properties, location);
  if (partial) stagePrebuiltSeed(hutTargetKey(slug), partial);
}

/** Legacy signature: slug-driven place details. Internally a target for
 *  the generalized engine, with the accommodation entry bound
 *  explicitly. */
export function usePlace(slug: Ref<string | undefined>) {
  const target = computed<MapTarget | null>(() =>
    slug.value
      ? { key: hutTargetKey(slug.value), source: 'geoplace', id: slug.value, props: {} }
      : null
  );
  const entry = ref(accommodationEntry);
  const { detail, loading, error, refetch } = usePlaceDetail(target, { entry });

  const place = computed<HutDetails | undefined>(() =>
    detail.value ? (detail.value as HutDetails) : undefined
  );

  return { place, loading, error: error as Ref<PlaceError | null>, refetch };
}
