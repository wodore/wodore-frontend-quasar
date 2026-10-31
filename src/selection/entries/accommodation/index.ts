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
import { hutSeedPartial, type HutDetails } from './seed';

export type { HutDetails } from './seed';
export { hutSeedPartial } from './seed';

export const accommodationEntry = definePresentation<HutDetails>({
  id: 'accommodation',
  match: { source: 'geoplace', kindParent: 'accommodation' },
  capabilities: ['detail'],
  surfaces: () => import('./surfaces'),
  detailStart: 'minimized',
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
    const result = await (
      prefetched
        ? prefetched.then(
            hutData =>
              ({
                data: hutData as HutDetails,
                error: undefined,
                response: undefined,
              }) as unknown as Awaited<ReturnType<typeof get>>,
            () => get()
          )
        : get()
    );
    const data = result.data as HutDetails | undefined;
    const { error: apiError, response } = result;

    // Read before the union narrows: past the apiError check, the success
    // member makes `!data` unreachable for TS and `response` collapses.
    // Prefetch handoff path has no response object — a sane 200 stand-in
    // keeps the destructure below total.
    const status = response?.status ?? 200;
    if (apiError) {
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
