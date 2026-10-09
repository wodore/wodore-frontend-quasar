/**
 * Backend icon library — GET /v1/icons (openspec: icon-library).
 *
 * The backend serves emoji packs (Fluent Emoji primary, Noto Emoji
 * secondary) with localized keyword search (de/en/fr/it, unioned with
 * English), typo tolerance and per-style asset URLs (detailed/simple/
 * mono → Fluent Color/Flat/High Contrast). Stored icons are bare slugs;
 * this service resolves them to asset URLs — both the lookup responses
 * and the SVG assets are HTTP-cached (ETag / Cache-Control), so there is
 * deliberately no client-side persistence.
 */

import { clientWodore, schemasWodore } from '@clients/index';
import { currentLocale } from '@services/locale';

export type BackendIcon = schemasWodore['IconDto'];
export type BackendIconStyle = 'detailed' | 'simple' | 'mono';

/** The app's primary emoji pack (product decision: Fluent Emoji). */
export const DEFAULT_ICON_PACK = 'fluent-emoji';

export interface IconSearchParams {
  /** Ranked search over localized keywords and slugs. */
  search?: string;
  /** Exact icon slug lookup (resolves one stored icon). */
  slug?: string;
  /** Pack slug filter. */
  pack?: string;
  /** CLDR subgroup (or group) slug filter. */
  category?: string;
  /** Curated list slug filter (e.g. 'activities'). */
  list?: string;
  /** Language code (de/en/fr/it); defaults to the active UI locale. */
  lang?: string;
  limit?: number;
  offset?: number;
}

/** Search the icon library. Results follow the backend's ranking
 *  (exact > prefix > substring > fuzzy, ties by order/slug). */
export async function searchIcons(params: IconSearchParams = {}): Promise<BackendIcon[]> {
  const { data, response } = await clientWodore.GET('/v1/icons/', {
    params: {
      query: {
        lang: params.lang ?? currentLocale(),
        search: params.search,
        slug: params.slug,
        pack: params.pack,
        category: params.category,
        list: params.list,
        limit: params.limit,
        offset: params.offset,
      },
    },
  });
  if (!response.ok) throw new Error(`GET /v1/icons/ failed: ${response.status}`);
  return data ?? [];
}

/** Resolve one stored icon slug to a single asset URL (exact lookup).
 *  The requested style falls back to simple → detailed → mono so an icon
 *  missing one style still renders. Returns null when unresolvable. */
export async function getBackendIconUrl(
  slug: string,
  variant: BackendIconStyle = 'simple',
  pack: string = DEFAULT_ICON_PACK,
): Promise<string | null> {
  try {
    const { data, response } = await clientWodore.GET('/v1/icons/', {
      params: { query: { slug, pack, limit: 1 } },
    });
    if (!response.ok) return null;
    const urls = data?.[0]?.urls ?? null;
    return urls?.[variant] ?? urls?.simple ?? urls?.detailed ?? urls?.mono ?? null;
  } catch {
    return null;
  }
}
