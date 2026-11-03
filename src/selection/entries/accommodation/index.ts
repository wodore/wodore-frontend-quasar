/**
 * Accommodation entry (huts) — first-scope custom detail. The fetch and
 * seed are the legacy usePlace behavior, moved here verbatim (D4: keeps
 * `/v1/huts/{slug}` + `HutSchemaDetails`; the huts→geoplace backend swap
 * is entry-local). Map clicks resolve to this entry via the wd-huts
 * LAYER CLAIM (claim-based resolution — no kind/domain tile props
 * needed); MatchSpec serves search rows and probe payloads.
 */
import { definePresentation } from '@selection/types';
import { consumePrefetchedHut } from '@services/hut-prefetch';
import { clientWodore } from '@clients/index';
import { PlaceRequestError } from '@composables/usePlaceDetail';
import {
  MIN_HUT_CLICK_ZOOM,
  WD_ACCOMMODATIONS_LAYER,
  WD_HUTS_CLICK_LAYERS,
} from '@selection/map-layer-ids';
import { hutSeedPartial, type HutDetails } from './seed';

export type { HutDetails } from './seed';
export { hutSeedPartial } from './seed';

/**
 * Geoplace-accommodation fallback: fetch `/v1/geo/places/{slug}` and map
 * the unified place detail onto the hut details shape (the wrap for
 * `wd-accommodations` features — their slugs are geoplace slugs). The
 * mapping fills only the fields the hut view degrades gracefully
 * without; consumers guard every hut-only block on data presence.
 */
async function geoplaceAsHutDetails(
  slug: string,
  lang: string,
  signal?: AbortSignal
): Promise<HutDetails> {
  const {
    data,
    error: apiError,
    response,
  } = await clientWodore.GET('/v1/geo/places/{slug}', {
    params: { path: { slug }, query: { lang } },
    signal,
  });
  if (apiError || !data) {
    throw new PlaceRequestError(
      { kind: 'http', status: response?.status ?? 0 },
      `Failed to fetch place "${slug}"`
    );
  }
  const kind = data.kind;
  const details: Partial<HutDetails> = {
    slug: data.slug,
    name: data.name,
    elevation: data.elevation,
    description: data.description,
    location: data.location,
    // Geoplaces have no hut availability — set the explicit false so
    // WdHutAvailabilities' strict `!== false` render guard and `===
    // false` fetch guard both take the hide path (undefined slips
    // through both and 404s /v1/huts/{slug}/availability).
    has_availability: false,
  };
  if (kind) {
    details.type_open = {
      slug: kind.slug,
      color: kind.color ?? '',
      name: kind.name,
      symbol: kind.symbol,
    } as HutDetails['type_open'];
  }
  // SAFETY: partial by design — the hut view guards every optional
  // member; missing hut-only blocks (capacities, open monthly) render
  // nothing instead of stale/empty data. Availability is the one
  // exception that needs the EXPLICIT false (strict-false guards).
  return details as HutDetails;
}

export const accommodationEntry = definePresentation<HutDetails>({
  id: 'accommodation',
  match: { source: 'geoplace', kindParent: 'accommodation' },
  capabilities: ['detail'],
  surfaces: () => import('./surfaces'),
  detailStart: 'minimized',
  // Claim-based map-click resolution (D5): every style layer whose
  // features are accommodations, with the shared hut-click zoom gate and
  // the canonical-id tile property. INTENDED behavior change vs the
  // legacy path (tasks.md PR2 note): the date-gated occupation circles
  // become clickable — clicking one IS clicking its hut. The
  // `wd-accommodations` overlay (backend amenity family, 2026-11) serves
  // geoplace accommodations (bhotel, bivouac amenities — NOT huts):
  // same detail surface, same source family, floor 5 per its style
  // minzoom (its features are importance-dense from low zooms).
  mapLayers: [
    ...WD_HUTS_CLICK_LAYERS.map(layer => ({
      layer,
      minZoom: MIN_HUT_CLICK_ZOOM,
      idProp: 'slug',
    })),
    { layer: WD_ACCOMMODATIONS_LAYER, minZoom: 5, idProp: 'slug' },
  ],
  fetch: async (ctx): Promise<HutDetails> => {
    // Deep-link prefetch handoff (perf/hut-fast-first-paint): if the boot
    // already fired this exact request, await its response — the promise
    // must be CHAINED (unwrapped into data); a REJECTED prefetch (e.g.
    // transient boot network error) falls back to a normal GET — a miss
    // fetches normally.
    const get = () =>
      clientWodore.GET('/v1/huts/{slug}', {
        params: { path: { slug: ctx.id }, query: { lang: ctx.lang } },
        signal: ctx.signal,
      });

    const prefetched = consumePrefetchedHut(ctx.id, ctx.lang);
    // SAFETY: the prefetch payload IS a HutDetails (same endpoint, same
    // shape as the GET); the double cast only aligns it with the
    // openapi-fetch response union, which widens tuple members
    // (country: string[] vs [string, string]) — an invariant the
    // generated types can't express.
    const result = await (prefetched
      ? prefetched.then(
          hutData =>
            ({
              data: hutData as HutDetails,
              error: undefined,
              response: undefined,
            }) as unknown as Awaited<ReturnType<typeof get>>,
          () => get()
        )
      : get());
    const data = result.data as HutDetails | undefined;
    const { error: apiError, response } = result;

    // Read before the union narrows: past the apiError check, the success
    // member makes `!data` unreachable for TS and `response` collapses.
    // Prefetch handoff path has no response object — a sane 200 stand-in
    // keeps the destructure below total.
    const status = response?.status ?? 200;
    if (apiError) {
      // GEOPLACE WRAP (owner decision 2026-11): the wd-accommodations
      // overlay serves geoplace accommodations whose slugs do NOT
      // resolve on /v1/huts (404 — huts are a separate entity family).
      // Fall back to the unified place detail and map it onto the hut
      // details shape: the hut details VIEW renders (title, elevation,
      // weather, location, description); hut-only blocks (availability,
      // capacities, year stripe) stay hidden for lack of data.
      if (response?.status === 404) {
        return geoplaceAsHutDetails(ctx.id, ctx.lang, ctx.signal);
      }
      throw new PlaceRequestError({ kind: 'http', status }, `Failed to fetch place "${ctx.id}"`);
    }
    if (!data) {
      throw new PlaceRequestError(
        { kind: 'http', status },
        `No data returned for place "${ctx.id}"`
      );
    }
    return data;
  },
  seed: props => hutSeedPartial(props),
});
