/**
 * Feature → MapTarget mapping — the feature→target contract of the click
 * pipeline (OpenSpec `add-place-interactions`, capability
 * `place-interactions`). ONE shared implementation: canonical id per
 * LayerClaim.idProp, geometry-derived location, raw property bag — no
 * per-handler hardcoded property names (the seedPlaceFromMap lesson).
 *
 * The localized-name family (`name_${locale}`) stays in the props bag —
 * consumers (seeds, popups) pick it at render time.
 */
import type { LatLng, MapTarget, Presentation, PropsBag } from './types';
import { targetKey } from './types';

/** Minimal structural shape of a rendered MapLibre feature (also fits
 *  GeoJSON features in tests). */
export interface RenderedFeatureLike {
  layer?: { id: string } | null;
  source?: string | null;
  sourceLayer?: string | null;
  id?: number | string | null;
  properties?: Record<string, unknown> | null;
  geometry?: { type: string; coordinates: unknown } | null;
}

/** Structural claim input (interactive-layers' ClaimedLayer satisfies
 *  this — the entry rides along for claim-based resolution). */
export interface ClaimRef {
  /** Target source family for targets built under this claim. */
  source: string;
  /** Which tile property carries the canonical id (default 'slug'). */
  idProp?: string;
  /** Strict lower zoom bound (`zoom > minZoom`). */
  minZoom?: number;
  /** Owning presentation (claim-based resolution — layer → entry). */
  entry?: Presentation;
}

/** A click-pipeline result item: the target plus its claim-resolved
 *  entry, ready for the selection store's openFromMap. */
export interface TargetItem {
  target: MapTarget;
  entry?: Presentation;
}

/** Extract a Point geometry as LatLng, else undefined. */
function locationOf(geometry: RenderedFeatureLike['geometry']): LatLng | undefined {
  if (geometry?.type === 'Point' && Array.isArray(geometry.coordinates)) {
    const [lon, lat] = geometry.coordinates as number[];
    if (Number.isFinite(lon) && Number.isFinite(lat)) return { lat, lon };
  }
  return undefined;
}

/** Build the canonical id from a feature per the claim's idProp (default
 *  `slug`). Returns null when the property is absent/empty — such
 *  features cannot produce targets (e.g. occupation tiles lacking the
 *  id property are skipped). */
function canonicalIdOf(
  properties: Record<string, unknown> | null | undefined,
  idProp: string | undefined
): string | null {
  const raw = properties?.[idProp ?? 'slug'];
  if (typeof raw !== 'string' && typeof raw !== 'number') return null;
  const id = String(raw);
  return id ? id : null;
}

/** Build a target from one rendered feature under its layer claim.
 *  Returns null when the feature carries no canonical id. The
 *  `featureRef` (MapLibre highlight handle) is attached for the
 *  controller-owned selection highlight. */
export function targetFromFeature(
  feature: RenderedFeatureLike,
  opts: { source: string; idProp?: string }
): MapTarget | null {
  const id = canonicalIdOf(feature.properties, opts.idProp);
  if (!id) return null;
  return {
    key: targetKey({ source: opts.source, id }),
    source: opts.source,
    id,
    location: locationOf(feature.geometry),
    props: (feature.properties ?? {}) as PropsBag,
    featureRef: {
      engine: 'maplibre' as const,
      handle: {
        source: feature.source ?? undefined,
        sourceLayer: feature.sourceLayer ?? undefined,
        id: feature.id ?? undefined,
      },
    },
  };
}

/**
 * Click-pipeline core: rendered features (topmost first, as
 * `queryRenderedFeatures` returns them) → deduplicated {target, entry}
 * items.
 *
 * - Features of layers without a claim are ignored.
 * - Per-claim strict zoom gate (`zoom > minZoom`) — mirroring the tap
 *   guard, a click that no claim would handle produces nothing.
 * - Items are deduplicated by `target.key` GLOBALLY (stacked symbols
 *   AND the same hut's occupation circle collapse to ONE item; the
 *   switcher never shows 1/1).
 * - Order: first occurrence (topmost) wins.
 */
export function targetsFromFeatures(
  features: readonly RenderedFeatureLike[],
  claims: readonly (ClaimRef & { layer: string })[],
  zoom: number
): TargetItem[] {
  // Lookup built HERE (not in maplibre-importing modules — their `Map`
  // type name is shadowed by maplibre's).
  const byLayer = new Map<string, ClaimRef & { layer: string }>();
  for (const claim of claims) byLayer.set(claim.layer, claim);
  const byKey = new Map<string, TargetItem>();
  for (const feature of features) {
    const layerId = feature.layer?.id;
    if (!layerId) continue;
    const claim = byLayer.get(layerId);
    if (!claim) continue;
    if (claim.minZoom !== undefined && !(zoom > claim.minZoom)) continue;
    const target = targetFromFeature(feature, claim);
    if (!target) continue;
    if (!byKey.has(target.key)) byKey.set(target.key, { target, entry: claim.entry });
  }
  return [...byKey.values()];
}
