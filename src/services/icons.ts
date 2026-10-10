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

/** The app's emoji look: Flat (backend style "simple"). */
export const DEFAULT_ICON_STYLE: BackendIconStyle = 'simple';

/** Stored icon reference: "pack/slug" with an optional "@style" suffix
 *  ("@simple" implied). Slugs collide across packs, so the pack is part
 *  of the stored data; the style records the pick's look. */
export interface IconRef {
  pack: string;
  slug: string;
  style: BackendIconStyle;
}

const ICON_REF_RE = /^([a-z0-9-]+)\/([a-z0-9-]+)(?:@([a-z]+))?$/;
const ICON_STYLES: BackendIconStyle[] = ['detailed', 'simple', 'mono'];

/** Parse a stored icon reference. Returns null for unknown/legacy strings
 *  (e.g. Iconify "prefix:name" names) — renderers show an empty
 *  placeholder for those. */
export function parseIconRef(value: string | null | undefined): IconRef | null {
  const match = ICON_REF_RE.exec(value ?? '');
  if (!match) return null;
  const style = (match[3] ?? DEFAULT_ICON_STYLE) as BackendIconStyle;
  return ICON_STYLES.includes(style) ? { pack: match[1], slug: match[2], style } : null;
}

/** Format a reference to its stored string form (omits "@simple"). */
export function formatIconRef(ref: IconRef): string {
  const base = `${ref.pack}/${ref.slug}`;
  return ref.style === DEFAULT_ICON_STYLE ? base : `${base}@${ref.style}`;
}

/** First style the icon actually has, preferring the requested one.
 *  Null when the icon exposes no assets at all. */
export function availableStyle(
  icon: BackendIcon,
  preferred: BackendIconStyle = DEFAULT_ICON_STYLE
): BackendIconStyle | null {
  const urls = icon.urls;
  if (!urls) return null;
  const order: BackendIconStyle[] = [preferred, 'simple', 'detailed', 'mono'];
  return order.find(style => urls[style]) ?? null;
}

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
  pack: string = DEFAULT_ICON_PACK
): Promise<string | null> {
  try {
    const { data, response } = await clientWodore.GET('/v1/icons/', {
      params: { query: { slug, pack, limit: 1 } },
    });
    if (!response.ok) return null;
    // Strict: render exactly the stored style — a silent fallback would
    // show a color emoji where the user picked mono (Noto ships
    // detailed only, Fluent ships all three styles).
    const urls = data?.[0]?.urls ?? null;
    return urls?.[variant] ?? null;
  } catch {
    return null;
  }
}
