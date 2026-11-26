/**
 * Basemap presence ↔ interactive overlay contract (backend #506).
 *
 * Every wodore vector basemap ships PASSIVE presence layers for its POI
 * families — `role=presence` rows the backend composes into the style
 * document at serve time, ids namespaced `wd-basemap-<family>-*`:
 *
 *   accommodations   → wd-basemap-accommodations-icons / -labels
 *   transport-stops  → wd-basemap-transit-stations / -stations-label
 *                      (legacy namespace, see PRESENCE_PREFIX_ALIASES)
 *
 * Contract: overlay OFF → the presence IS the family's POI layer;
 * overlay ON → the interactive overlay REPLACES it (never doubled
 * icons) and its icons render BELOW the basemap's major labels.
 * MapLibre places the topmost symbol layer FIRST, so an overlay appended
 * above the label band evicts city/peak labels on collision (owner
 * report 2026-11-23: toggling accommodations blanked every city/peak
 * label on mobile).
 *
 * The ids alone carry the mapping — no per-overlay suppress list. The
 * basemap OWNS the presence layers: callers only flip `visibility`,
 * never remove them.
 *
 * Store-free: both map renderers' callers (basemap-store
 * transformStyle, WdOverlayControl) import it.
 */
import type { LayerNames } from './interfaces';

/** Layer-id namespace of the passive presence layers the backend composes into the basemap styles. */
export const PRESENCE_LAYER_NAMESPACE = 'wd-basemap-';

/** Overlay slugs whose presence layers keep a legacy id namespace that differs from the slug. */
const PRESENCE_PREFIX_ALIASES: ReadonlyMap<string, string> = new Map([
  ['transport-stops', `${PRESENCE_LAYER_NAMESPACE}transit-`],
]);

/** The overlay fields the presence contract reads (OverlaySwitchItem is structural-compatible). */
export interface PresenceOwner {
  name: string;
  catalogSlug?: string;
  active?: boolean;
}

/** The `wd-basemap-<family>-` prefix of an overlay's passive basemap presence — derived from the catalog slug alone. */
export function presenceLayerPrefix(overlay: Pick<PresenceOwner, 'name' | 'catalogSlug'>): string {
  const slug = overlay.catalogSlug || overlay.name;
  return PRESENCE_PREFIX_ALIASES.get(slug) ?? `${PRESENCE_LAYER_NAMESPACE}${slug}-`;
}

/** One family's always-replace state: layers with `prefix` are hidden while any overlay of the family is active. */
export interface PresenceFamily {
  prefix: string;
  hidden: boolean;
}

/** Per-family state of the overlay list (one entry per distinct presence prefix). */
export function presenceFamilies(overlays: readonly PresenceOwner[]): PresenceFamily[] {
  const hiddenByPrefix = new Map<string, boolean>();
  for (const overlay of overlays) {
    const prefix = presenceLayerPrefix(overlay);
    // Overlays sharing a family: the presence stays replaced while ANY
    // of them is active.
    hiddenByPrefix.set(prefix, (hiddenByPrefix.get(prefix) ?? false) || overlay.active === true);
  }
  return [...hiddenByPrefix].map(([prefix, hidden]) => ({ prefix, hidden }));
}

/** `none` while an overlay of the layer's family replaces the presence, `visible` once none is active; undefined for layers outside every family. */
export function presenceVisibility(
  layerId: string,
  families: readonly PresenceFamily[]
): 'visible' | 'none' | undefined {
  // Longest prefix wins: `wd-basemap-accommodations-` must not claim
  // `wd-basemap-accommodations-<x>-icons` of a nested slug.
  let owner: PresenceFamily | undefined;
  for (const family of families) {
    if (
      layerId.startsWith(family.prefix) &&
      (!owner || family.prefix.length > owner.prefix.length)
    ) {
      owner = family;
    }
  }
  if (owner === undefined) return undefined;
  return owner.hidden ? 'none' : 'visible';
}

/**
 * Style-document form for basemap switches: presence layers of an
 * ACTIVE family arrive hidden. transformStyle is the only hook before
 * MapLibre applies the new document — the runtime toggle cannot run
 * early enough, a new style resets every layout property. Layers
 * outside a replaced family come back untouched (same object): the
 * served document stays authoritative for everyone else.
 */
export function hideReplacedPresence<L extends { id: string }>(
  layer: L,
  families: readonly PresenceFamily[]
): L {
  if (presenceVisibility(layer.id, families) !== 'none') return layer;
  const layout = (layer as { layout?: Record<string, unknown> }).layout;
  // SAFETY: same layer, one layout key added — the cast restores L
  // around the spread (maplibre's layout unions do not widen).
  return { ...layer, layout: { ...(layout ?? {}), visibility: 'none' } } as L;
}

/**
 * Basemap label layers that render OVER interactive overlays. The
 * FIRST of them in the style is the overlays' insertion anchor
 * (backend `seed_lib` keeper labels, owner 2026-11-23): major cities
 * (place ranks 1–2) and ALL peak labels.
 */
export const KEEPER_LABEL_PREFIXES: readonly string[] = [
  'place_point_label_rank_1',
  'place_point_label_rank_2',
  'place_peak_label_',
];

function keeperLabelIndex(layerIds: readonly string[]): number {
  return layerIds.findIndex(id => KEEPER_LABEL_PREFIXES.some(prefix => id.startsWith(prefix)));
}

/** Id of the first keeper-label layer — the bottom of the band POI overlays must stay below — or undefined when the style has none (raster/external basemaps). */
export function labelBandAnchor(layerIds: readonly string[]): string | undefined {
  const index = keeperLabelIndex(layerIds);
  return index === -1 ? undefined : layerIds[index];
}

/** Overlay groups that draw icons and therefore stay below the label band. Route lines and area fills keep the basemap's own anchors. */
function rendersBelowLabelBand(onLayer: LayerNames | undefined): boolean {
  return onLayer === 'ways' || onLayer === 'places';
}

/**
 * Insertion anchor of one overlay group in a style: the basemap's
 * `onLayer` anchor, capped so the group never lands above the
 * keeper-label band.
 *
 *  - no keeper labels in the style (external basemaps) → `anchor`, as before;
 *  - no anchor, or one this style lacks (unanchored overlays used to
 *    append ON TOP of every label) → the band: right below the majors;
 *  - anchor above the band → the band; at or below it → kept.
 */
export function resolveOverlayAnchor(
  anchor: string | undefined,
  onLayer: LayerNames | undefined,
  layerIds: readonly string[]
): string | undefined {
  if (!rendersBelowLabelBand(onLayer)) return anchor;
  const bandIndex = keeperLabelIndex(layerIds);
  if (bandIndex === -1) return anchor;
  const anchorIndex = anchor === undefined ? -1 : layerIds.indexOf(anchor);
  if (anchorIndex === -1) return layerIds[bandIndex];
  return anchorIndex < bandIndex ? anchor : layerIds[bandIndex];
}
