/**
 * Amenity detail fetch + wire mapping (shared by the amenity entry's
 * `fetch` and the popup's enrichment request).
 *
 * Data source: the unified geoplace detail endpoint `/v1/geo/places/{slug}`
 * (GeoPlaceDetailSchema). Amenity overlay tiles carry only identity-lite
 * props (slug, name at label zooms, colors, importance, count) — the
 * detail fills in the localized name, elevation and the kind (identifier
 * + symbol URL) for the popup icon. `elevation` / `category_identifier`
 * tile properties (backend task) remain the INSTANT path; this fetch is
 * the authoritative overwrite.
 */
import { clientWodore, type schemasWodore } from '@clients/index';
import { PlaceRequestError } from '@composables/usePlaceDetail';

/** The popup-relevant projection of a geoplace detail. */
export interface AmenityDetail {
  slug: string;
  name: string;
  elevation?: number | null;
  description?: string | null;
  location?: { lat: number; lon: number };
  kind?: {
    identifier: string;
    slug: string;
    color?: string | null;
    name?: string | null;
    symbol?: { color?: string | null } | null;
  } | null;
}

type GeoPlaceDetail = schemasWodore['GeoPlaceDetailSchema'];

/** Map the wire schema onto the popup projection (partial-safe). */
export function amenityDetailFromGeoPlace(geo: GeoPlaceDetail): AmenityDetail {
  const kind = geo.kind;
  return {
    slug: geo.slug,
    name: geo.name,
    elevation: geo.elevation ?? null,
    description: geo.description ?? null,
    location: geo.location ? { lat: geo.location.lat, lon: geo.location.lon } : undefined,
    kind: kind
      ? {
          identifier: kind.identifier,
          slug: kind.slug,
          color: kind.color ?? null,
          name: kind.name ?? null,
          symbol: kind.symbol ? { color: kind.symbol.color ?? null } : null,
        }
      : null,
  };
}

/** Fetch one amenity's detail (typed client; same error contract as the
 *  accommodation entry — PlaceRequestError for http/offline states). */
export async function fetchAmenityDetail(ctx: {
  id: string;
  lang: string;
  signal?: AbortSignal;
}): Promise<AmenityDetail> {
  const {
    data,
    error: apiError,
    response,
  } = await clientWodore.GET('/v1/geo/places/{slug}', {
    params: { path: { slug: ctx.id }, query: { lang: ctx.lang } },
    signal: ctx.signal,
  });
  const status = response?.status ?? 0;
  if (apiError) {
    throw new PlaceRequestError({ kind: 'http', status }, `Failed to fetch place "${ctx.id}"`);
  }
  if (!data) {
    throw new PlaceRequestError(
      { kind: 'http', status: status || 404 },
      `No data returned for place "${ctx.id}"`
    );
  }
  return amenityDetailFromGeoPlace(data);
}
