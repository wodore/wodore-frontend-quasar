/**
 * Accommodation identity seed — the MVT/tile property mapping (moved
 * verbatim from the legacy usePlace.seedPlaceFromMap; owner 2026-10:
 * "we have this info from the mvt properties"). Enough for the panel
 * header to paint before the details request resolves.
 */
import { currentLocale } from '@services/locale';
import type { schemasWodore } from '@clients/index';

export type HutDetails = schemasWodore['HutSchemaDetails'];

/** Build the identity partial from tile properties (+ optional
 *  geometry-derived location — present on the explicit
 *  seedPlaceFromMap path, absent when seeding from a search row).
 *  Returns null when NOTHING maps (empty props) — a truthy empty
 *  object would be cached and painted as a phantom seed. */
export function hutSeedPartial(
  properties: Record<string, unknown>,
  location?: { lat: number; lon: number }
): Partial<HutDetails> | null {
  const localeName = String(properties[`name_${currentLocale()}`] ?? properties.name ?? '');
  const elevationRaw = properties.elevation;
  const ownerName = properties.owner_name;

  const seed: Partial<HutDetails> = {};
  if (localeName) seed.name = localeName;
  if (typeof properties.has_availability === 'boolean') {
    seed.has_availability = properties.has_availability;
  }
  if (elevationRaw !== undefined && elevationRaw !== null) {
    const elevation = Number(elevationRaw);
    if (!Number.isNaN(elevation)) seed.elevation = elevation;
  }
  if (typeof ownerName === 'string' && ownerName) {
    seed.owner = { name: ownerName } as HutDetails['owner'];
  }
  // Geometry-derived location: enables the weather read + forecast while
  // details load.
  if (location && Number.isFinite(location.lat) && Number.isFinite(location.lon)) {
    seed.location = location as HutDetails['location'];
  }
  if (typeof properties.type_standard_slug === 'string') {
    // Partial type: consumers guard on `.name`/`.symbol`, so badges still
    // wait for the full payload. The title avatar renders instantly from
    // `slug` (WdCategoryIcon derives 'accommodation.{slug}' → direct SVG
    // URL, module-cached); the payload's symbol URL takes over later.
    seed.type_open = {
      slug: properties.type_standard_slug,
      color:
        typeof properties.type_standard_color === 'string'
          ? properties.type_standard_color
          : undefined,
    } as HutDetails['type_open'];
  }
  return Object.keys(seed).length ? seed : null;
}
