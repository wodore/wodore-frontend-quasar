/**
 * Backend icon library — GET /v1/icons (openspec: icon-library).
 *
 * The backend serves per-style asset URLs (detailed/simple/mono — e.g.
 * Fluent Color/Flat/High Contrast). The FRONTEND only distinguishes two
 * looks — "color" and "mono": the color look resolves to the pack's flat
 * art (simple) when it has one and falls back to its detailed color art
 * (Noto and the flag packs ship detailed only), mono resolves strictly to
 * mono. Stored icons are bare slugs; this service resolves them to asset
 * URLs — both the lookup responses and the SVG assets are HTTP-cached
 * (ETag / Cache-Control), so there is deliberately no client-side
 * persistence.
 */

import { clientWodore, schemasWodore } from '@clients/index';
import { currentLocale } from '@services/locale';

export type BackendIcon = schemasWodore['IconDto'];
/** Asset slots the backend serves per icon (wire styles). */
export type BackendIconStyle = 'color' | 'primitive' | 'mono';
/** Looks the frontend offers: color (flat art, detailed fallback) or mono. */
export type IconLook = 'color' | 'mono';

/** The app's primary emoji pack (product decision: Fluent Emoji). */
export const DEFAULT_ICON_PACK = 'fluent-emoji';

/** The app's icon look: color (flat art, detailed fallback). */
export const DEFAULT_ICON_LOOK: IconLook = 'color';

/** Wire style the color look prefers first (Fluent Flat; Noto/flags have
 *  detailed only and fall through). */
export const COLOR_WIRE_ORDER: BackendIconStyle[] = ['primitive', 'color'];

/** Stored icon reference: "pack/slug" with an optional "@mono" suffix
 *  ("@color" implied). Slugs collide across packs, so the pack is part of
 *  the stored data; the look records the pick's rendering. Legacy refs
 *  with "@simple"/"@detailed" parse as color. */
export interface IconRef {
  pack: string;
  slug: string;
  style: IconLook;
}

const ICON_REF_RE = /^([a-z0-9-]+)\/([a-z0-9-]+)(?:@([a-z]+))?$/;
const _LOOKS: IconLook[] = ['color', 'mono'];
/** Suffixes stored before the color/mono model — all render as color. */
const LEGACY_COLOR_SUFFIXES = ['simple', 'detailed'];

/** Parse a stored icon reference. Returns null for unknown/legacy strings
 *  (e.g. Iconify "prefix:name" names) — renderers show an empty
 *  placeholder for those. */
export function parseIconRef(value: string | null | undefined): IconRef | null {
  const match = ICON_REF_RE.exec(value ?? '');
  if (!match) return null;
  const suffix = match[3];
  if (suffix === undefined) return { pack: match[1], slug: match[2], style: 'color' };
  if (suffix === 'mono') return { pack: match[1], slug: match[2], style: 'mono' };
  if (suffix === 'color' || LEGACY_COLOR_SUFFIXES.includes(suffix)) {
    return { pack: match[1], slug: match[2], style: 'color' };
  }
  return null;
}

/** Format a reference to its stored string form (omits "@color"). */
export function formatIconRef(ref: IconRef): string {
  const base = `${ref.pack}/${ref.slug}`;
  return ref.style === DEFAULT_ICON_LOOK ? base : `${base}@${ref.style}`;
}

/** Wire style an icon actually has for the requested look, preferring the
 *  color look's flat art. Null when the icon exposes no asset for it
 *  (mono: Fluent ships it, Noto and the flag packs do not). */
export function availableStyle(
  icon: BackendIcon,
  preferred: IconLook = DEFAULT_ICON_LOOK
): BackendIconStyle | null {
  const urls = icon.urls;
  if (!urls) return null;
  const order: BackendIconStyle[] = preferred === 'mono' ? ['mono'] : COLOR_WIRE_ORDER;
  const found = order.find(style => urls[style]) ?? null;
  if (found) return found;
  // Legacy backend still serving detailed/simple slots (rollout window)
  const legacyUrls = urls as Record<string, string | null | undefined>;
  const legacy = preferred === 'mono' ? ['mono'] : ['simple', 'detailed'];
  const hit = legacy.find(style => legacyUrls[style]);
  return (hit as BackendIconStyle | undefined) ?? null;
}

export interface IconSearchParams {
  /** Ranked search over localized keywords and slugs. */
  search?: string;
  /** Exact icon slug lookup (resolves one stored icon). */
  slug?: string;
  /** Pack slug filter — one slug or several (comma-joined for the API). */
  pack?: string | string[];
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
 *  (exact > prefix > substring > fuzzy, ties by order/slug). The
 *  optional signal cancels an in-flight request (autocomplete typing:
 *  a newer keystroke aborts the stale request instead of racing it). */
export async function searchIcons(
  params: IconSearchParams = {},
  signal?: AbortSignal
): Promise<BackendIcon[]> {
  const { data, response } = await clientWodore.GET('/v1/icons/', {
    params: {
      query: {
        lang: params.lang ?? currentLocale(),
        search: params.search,
        slug: params.slug,
        pack: Array.isArray(params.pack) ? params.pack.join(',') : params.pack,
        category: params.category,
        list: params.list,
        limit: params.limit,
        offset: params.offset,
      },
    },
    signal,
  });
  if (!response.ok) throw new Error(`GET /v1/icons/ failed: ${response.status}`);
  return data ?? [];
}

/** Resolve one stored icon slug to a single asset URL (exact lookup).
 *  The color look falls back simple → detailed (an icon missing the flat
 *  style still renders in its pack's color art); mono stays strict so a
 *  color emoji never silently replaces a monochrome pick. Returns null
 *  when unresolvable. */
export async function getBackendIconUrl(
  slug: string,
  look: IconLook = DEFAULT_ICON_LOOK,
  pack: string = DEFAULT_ICON_PACK
): Promise<string | null> {
  try {
    const { data, response } = await clientWodore.GET('/v1/icons/', {
      params: { query: { slug, pack, limit: 1 } },
    });
    if (!response.ok) return null;
    const urls = data?.[0]?.urls ?? null;
    if (!urls) return null;
    if (look === 'mono') return urls.mono ?? null;
    return urls.primitive ?? urls.color ?? null;
  } catch {
    return null;
  }
}
