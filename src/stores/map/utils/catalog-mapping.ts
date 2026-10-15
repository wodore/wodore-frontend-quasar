/**
 * Catalog → switch-item mapping — compiles backend map catalog layers
 * (services/map-catalog.ts DTOs) into the OverlaySwitchItem /
 * BasemapSwitchItem shapes the stores and controls consume. Pure
 * mapping: fetching, the persistence cache and version sync live in
 * map-catalog-store / basemap-store.
 *
 * The backend owns the catalog — no factory fallbacks, no slug aliases.
 * Persisted basemap-name renames keep pre-catalog selections resolving
 * (design.md D4), and the slot/anchor tables preserve the render order
 * for anchors the seed does not carry yet (design.md D6).
 */
import type { LayerSpecification, StyleSpecification } from 'maplibre-gl';
import { validateStyleMin } from '@maplibre/maplibre-gl-style-spec';
import type {
  BasemapCatalogEntry,
  MapCatalogLayer,
  MapLayerParameter,
  MapSpecTier,
} from '@services/map-catalog';
import type {
  BasemapSwitchItem,
  LayerNames,
  OpacitySpecification,
  OverlaySwitchItem,
} from './interfaces';
import type {
  CategoryItem,
  LegendDefinition,
  OverlayConfig,
} from '@stores/map/overlay-configs/types';
import { COUNTRY_BASEMAP_MIN_ZOOM } from './country-fallback';
import { i18n } from '@services/locale';

// ── Persisted-name renames (pre-catalog selections → catalog slugs) ──────

/** Persisted basemap names → catalog identities (selection renames). */
export const RENAMED_BASEMAP_SLUGS: Record<string, string> = {
  'outdoor-osm': 'wd-outdoor-base-ofm',
  'Satellite Hybrid': 'maptiler-hybrid',
};

// ── Slot / anchor transition tables (design.md D6) ──────────────────────

/**
 * Catalog slot → app anchor name. `background`/`ways` are seeded slots;
 * `places` (data overlays under town labels) and `routes` (route lines
 * under all labels) exist client-side until the backend seeds them.
 */
const SLOT_TO_ONLAYER: Record<string, LayerNames> = {
  background: 'background',
  ways: 'ways',
  places: 'places',
  routes: 'routes',
};

/**
 * Layers whose catalog slot differs from the app anchor while the seed
 * lacks the `places` slot (huts renders below rank-2 town labels today).
 * Applied only when the catalog does not define the target slot.
 */
const SLOT_OVERRIDES: Record<string, LayerNames> = {
  huts: 'places',
};

/**
 * Basemap anchors the seed does not carry yet — merged UNDER the
 * catalog's `anchors` (catalog wins per slot). mtk: huts under
 * rank-2 town labels, route lines under every symbol layer.
 */
export const LEGACY_BASEMAP_ANCHORS: Record<
  string,
  Partial<Record<LayerNames, { before: string | undefined }>>
> = {
  'wd-outdoor-base-mtk': {
    places: { before: 'place_point_label_rank_2' },
    routes: { before: 'wd-station-label' },
  },
};

/** Legacy fallback targets for basemaps without a catalog `fallback`. */
export const LEGACY_BASEMAP_FALLBACKS: Record<string, string> = {
  'wd-outdoor-base-mtk': 'wd-outdoor-base-ofm',
  // Backend PR #292 hill variants (their seed rows carry no fallback —
  // the chain mirrors the non-hill pair and ends keyless).
  'wd-outdoor-base-mtk-hill': 'wd-outdoor-base-ofm-hill',
  'wd-outdoor-base-ofm-hill': 'openfreemap-liberty',
  maptiler: 'openfreemap-liberty', // MapTiler-hosted styles
};

// ── Labels ───────────────────────────────────────────────────────────────

/**
 * Known-slug i18n override: the factories ship translated labels for
 * every existing slug — keep them (four languages) while the backend
 * translations catch up; catalog names serve everything else.
 */
export function localizedLayerLabel(slug: string, catalogName: string): string {
  // The structural cast avoids vue-i18n's overloaded Composer generics
  // (deep message-schema types trip TS2589 on both t and te).
  // SAFETY: i18n.global is a Composer; t/te with a plain string key are
  // the two members used — the same calls every component makes.
  const composer = i18n.global as unknown as {
    t: (key: string) => string;
    te: (key: string) => boolean;
  };
  const key = `overlays.${slug}.label`;
  if (composer.te(key)) return composer.t(key);
  return catalogName || slug;
}

// ── Parameter helpers ────────────────────────────────────────────────────

/**
 * Compile the overlay-level `opacity` expression from the layer's
 * `opacity-curve` parameter (resolved default). The catalog style bakes
 * the same curve into its paint tokens — both agree by construction.
 */
export function opacityFromParameters(parameters: MapLayerParameter[]): OpacitySpecification {
  const curve = parameters.find(p => p.kind === 'opacity-curve');
  if (curve && Array.isArray(curve.default)) {
    // SAFETY: opacity-curve defaults are validated interpolate
    // expressions (backend validation.py: ascending stops, 0–1 range) —
    // the cast only widens the JSON array into the maplibre expression
    // type; resolveTokens output feeds setPaintProperty verbatim.
    return curve.default as unknown as OverlaySwitchItem['opacity'];
  }
  return undefined;
}

/** Authored parameter values: layer overrides already folded in by the
 *  backend (ParameterSummary.default) — the client's resolution base. */
export function authoredParameterValues(parameters: MapLayerParameter[]): Record<string, unknown> {
  return Object.fromEntries(parameters.map(p => [p.slug, p.default]));
}

// ── Legend / config mapping ─────────────────────────────────────────────

/** Map a catalog legend payload onto the frontend legend shape. */
export function mapLegend(
  layer: MapCatalogLayer,
  values: Record<string, unknown>
): LegendDefinition {
  const legend = layer.legend;
  const definition: LegendDefinition = { sections: [] };
  if (!legend) return definition;
  for (const section of legend.sections ?? []) {
    const mapped: LegendDefinition['sections'][number] = {
      title: section.title,
      description: section.description,
      type: section.type as LegendDefinition['sections'][number]['type'],
      items: [],
    };
    if (section.category) {
      mapped.category = categoryProjectionToItems(section.category);
    } else {
      mapped.items = (section.items ?? []).map(item => ({
        label: item.label,
        description: item.description,
        color: resolveTokenString(item.color, values),
        icon: item.icon,
      }));
    }
    definition.sections.push(mapped);
  }
  definition.links = legend.links;
  return definition;
}

/** Resolve `{{token}}` occurrences inside a single string (legend colors). */
function resolveTokenString(
  value: string | undefined,
  values: Record<string, unknown>
): string | undefined {
  if (!value || !value.includes('{{')) return value;
  const usable = Object.fromEntries(
    Object.entries(values).filter(([, v]) => v !== undefined && v !== null)
  );
  return (
    value.replace(/\{\{([a-z0-9][a-z0-9_.-]*)\}\}/g, (match, slug: string) =>
      slug in usable ? String(usable[slug]) : match
    ) || value
  );
}

/**
 * Category-driven section: the catalog embeds a pre-resolved minimal
 * projection ({slug, identifier, name, color, children}). While the
 * projection carries no symbol URLs (backend spec includes them, the
 * serializer lags), degrade to the category-slug string source so the
 * existing category-API fetch populates full legend items — the moment
 * symbols appear in the projection, it is used directly.
 */
function categoryProjectionToItems(
  projection: Record<string, unknown>
): LegendDefinition['sections'][number]['category'] {
  const hasSymbols = projectionHasSymbols(projection);
  if (!hasSymbols) {
    return String(projection.slug ?? '');
  }
  return [projectionToCategoryItem(projection)];
}

function projectionHasSymbols(node: Record<string, unknown>): boolean {
  if (
    node.symbol_color !== undefined ||
    node.symbol_primitive !== undefined ||
    node.symbol_mono !== undefined ||
    node.icon !== undefined
  ) {
    return true;
  }
  for (const child of (node.children as Array<Record<string, unknown>>) ?? []) {
    if (projectionHasSymbols(child)) return true;
  }
  return false;
}

function projectionToCategoryItem(node: Record<string, unknown>): CategoryItem {
  // SAFETY: the catalog category projection is a loose backend dict —
  // the fields read here (slug/identifier/name/description/color/dash)
  // are the documented projection shape; missing fields stay undefined
  // like a CategoryItem would carry them.
  return node as unknown as CategoryItem;
}

/** Map the catalog `config` JSONB + legend + attributions onto OverlayConfig. */
export function mapOverlayConfig(
  layer: MapCatalogLayer,
  values: Record<string, unknown>
): OverlayConfig | undefined {
  const raw = layer.config ?? {};
  // SAFETY: the backend seed emits the frontend filter layout verbatim
  // (filters: [{id, label, type, category, defaultValue, mapLayers,
  // mapProperty, filterExpression}]) — a structural passthrough with the
  // legend/attributions appended from their own catalog fields.
  const config = { ...(raw as unknown as OverlayConfig) };
  // Only attach a legend when the layer has one — an empty {sections: []}
  // would surface an empty legend tab (hasLegend keys on presence).
  if (layer.legend) config.legend = mapLegend(layer, values);
  const attribution = (layer.attributions ?? []).flatMap(a =>
    a.name || a.url ? [{ name: a.name ?? '', url: a.url ?? '' }] : []
  );
  if (attribution.length > 0) {
    config.legend = { ...(config.legend ?? { sections: [] }), attribution };
  }
  return config;
}

// ── Sprite pack merge (design.md D7) ────────────────────────────────────

/**
 * Merge same-id sprite entries across overlays: catalog styles reference
 * Martin sprite packs per layer (`wd` → `/sprite/accommodation`,
 * `wd` → `/sprite/availability`) while `icon-image` expressions bake the
 * sprite id in — MapLibre sprite ids are unique, so same-base packs are
 * unioned into one comma-joined pack URL (Martin sprite pack grammar,
 * the combined URL the factory world used).
 */
export function mergeSpritePacks(overlays: OverlaySwitchItem[]): void {
  // Collect entries per sprite id across overlays that carry sprites.
  const byId = new Map<string, Array<{ overlay: OverlaySwitchItem; url: string }>>();
  for (const overlay of overlays) {
    const sprite = overlay.style.sprite;
    const entries = Array.isArray(sprite)
      ? sprite.map(e => (typeof e === 'string' ? { id: 'default', url: e } : e))
      : typeof sprite === 'string'
        ? [{ id: 'default', url: sprite }]
        : [];
    for (const entry of entries) {
      const list = byId.get(entry.id) ?? [];
      list.push({ overlay, url: entry.url });
      byId.set(entry.id, list);
    }
  }
  for (const [, entries] of byId) {
    if (entries.length < 2) continue;
    // Group by pack-list base (URL up to the pack list) and union packs.
    const packsByUrlBase = new Map<string, Set<string>>();
    let mergeable = true;
    for (const { url } of entries) {
      const m = /^(.*\/sprite\/)([^/]*)$/.exec(url);
      if (!m) {
        mergeable = false;
        break;
      }
      const packs = packsByUrlBase.get(m[1]!) ?? new Set<string>();
      for (const pack of m[2]!.split(',')) packs.add(pack);
      packsByUrlBase.set(m[1]!, packs);
    }
    if (!mergeable || packsByUrlBase.size !== 1) continue;
    const [[base, packs]] = [...packsByUrlBase];
    const merged = `${base}${[...packs].sort().join(',')}`;
    for (const { overlay } of entries) {
      const sprite = overlay.style.sprite;
      if (Array.isArray(sprite)) {
        overlay.style.sprite = sprite.map(e => (typeof e === 'string' ? e : { ...e, url: merged }));
      } else if (typeof sprite === 'string') {
        overlay.style.sprite = merged;
      }
    }
  }
}

// ── Overlay mapping ─────────────────────────────────────────────────────

// ── Style usability guard ──────────────────────────────────────────────

/**
 * Structural MapLibre validation of a served catalog style. Catalog
 * documents are remote data — an invalid authored style (e.g. the seeded
 * huts `icon-size` nesting a zoom expression inside a `*` product, which
 * MapLibre rejects at addLayer) must not blank the layer: the caller
 * drops the item and the bundled factory fallback stays.
 */
export function isUsableStyle(style: StyleSpecification): boolean {
  try {
    const errors = validateStyleMin(style);
    const fatal = errors.filter(e => e.severity === 'error');
    if (fatal.length > 0) {
      console.warn(
        '[map-catalog] style failed MapLibre validation:',
        fatal.map(e => e.message).join('; ')
      );
      return false;
    }
    return true;
  } catch (error) {
    console.warn('[map-catalog] style validation threw:', error);
    return false;
  }
}

// ── Overlay mapping ─────────────────────────────────────────────────────────────

export interface OverlayStyleBundle {
  /** Resolved style (what all renderers consume). */
  style: StyleSpecification;
  /** Tokenized style when the layer declares parameters. */
  tokenizedStyle?: StyleSpecification;
}

/**
 * Compile one catalog overlay layer into an OverlaySwitchItem. The style
 * comes pre-fetched (map-catalog-store owns loading + persistence) —
 * mapping stays synchronous so the store can rebuild labels/legends on
 * locale switches without refetching (styles are language-independent).
 */
export function mapCatalogOverlay(
  layer: MapCatalogLayer,
  slotSlugs: Set<string>,
  styles: OverlayStyleBundle
): OverlaySwitchItem {
  let onLayer: LayerNames = SLOT_TO_ONLAYER[layer.slot ?? 'ways'] ?? 'ways';
  const override = SLOT_OVERRIDES[layer.slug];
  if (override && !slotSlugs.has(override)) onLayer = override;

  const values = authoredParameterValues(layer.parameters ?? []);
  // Resolved style: tokens already substituted at fetch time when the
  // bundle carries a tokenized style (client-resolved with defaults ∪
  // user overrides by the store), otherwise the server-resolved document.
  const item: OverlaySwitchItem = {
    name: layer.slug,
    label: localizedLayerLabel(layer.slug, layer.name),
    show: layer.show,
    active: false,
    onLayer,
    icon: layer.icon || 'fa-solid fa-notdef',
    style: styles.style,
    opacity: opacityFromParameters(layer.parameters ?? []),
    config: mapOverlayConfig(layer, values),
    parameters: layer.parameters.length > 0 ? layer.parameters : undefined,
    tokenizedStyle: styles.tokenizedStyle,
    catalogSlug: layer.slug,
  };
  if (layer.min_zoom !== null && layer.min_zoom !== undefined) {
    // Zoom floor on every style layer (catalog layers carry no per-layer
    // minzoom in the authored styles; the registry value is authoritative).
    item.style = {
      ...item.style,
      layers: item.style.layers.map(l => clampMinZoom(l, layer.min_zoom!)),
    };
    if (item.tokenizedStyle) {
      item.tokenizedStyle = {
        ...item.tokenizedStyle,
        layers: item.tokenizedStyle.layers.map(l => clampMinZoom(l, layer.min_zoom!)),
      };
    }
  }
  return item;
}

function clampMinZoom(layer: LayerSpecification, minZoom: number): LayerSpecification {
  if ((layer.minzoom ?? 0) >= minZoom) return layer;
  return { ...layer, minzoom: minZoom } as LayerSpecification;
}

// ── Basemap mapping ─────────────────────────────────────────────────────

/**
 * Compile one catalog basemap layer into a BasemapSwitchItem. The style
 * is a URL string (style endpoint with `spec=`, or the external
 * env-resolved `style_url`) so MapLibre loads it directly.
 * `imgFallback` supplies the local thumbnail for slugs whose catalog
 * `preview_url` is empty (the store owns the asset URLs).
 */
export function mapCatalogBasemap(
  layer: MapCatalogLayer,
  spec: MapSpecTier,
  styleUrls: Map<string, string>,
  imgFallback?: (appSlug: string) => string | undefined
): BasemapSwitchItem {
  const appSlug = RENAMED_BASEMAP_SLUGS[layer.slug] === layer.slug ? layer.slug : layer.slug;
  const anchors: BasemapSwitchItem['layers'] = {
    ways: { before: undefined },
    background: { before: undefined },
  };
  const legacy = LEGACY_BASEMAP_ANCHORS[layer.slug];
  for (const [slot, opts] of Object.entries(layer.anchors ?? {})) {
    const onLayer = SLOT_TO_ONLAYER[slot];
    if (!onLayer) continue;
    anchors[onLayer] = { before: opts?.before ?? undefined };
  }
  if (legacy) {
    for (const [onLayer, opts] of Object.entries(legacy)) {
      if (!(onLayer in (layer.anchors ?? {}))) {
        anchors[onLayer as LayerNames] = opts as { before: string | undefined };
      }
    }
  }
  const coverage =
    layer.coverage_bbox && layer.coverage_bbox.length === 4
      ? (layer.coverage_bbox as [number, number, number, number])
      : undefined;
  return {
    name: appSlug,
    label: localizedLayerLabel(appSlug, layer.name),
    show: layer.show,
    active: false,
    img: layer.preview_url ?? imgFallback?.(appSlug) ?? '',
    style: styleUrls.get(layer.slug) ?? '',
    layers: anchors,
    ...(layer.fallback ? { fallback: layer.fallback } : {}),
    ...(coverage
      ? {
          countryOnly: true,
          bbox: coverage,
          countryMinZoom: layer.fallback_min_zoom ?? COUNTRY_BASEMAP_MIN_ZOOM,
        }
      : {}),
  };
}

/**
 * Compile one Martin-compatible catalog entry (backend PR #292) into a
 * switch item — the basemap picker's data source. Unlike the rich catalog
 * there are no variants or anchors: `path` IS the style URL (spec
 * resolved server-side); anchors default and pick up the legacy table
 * for known country basemaps; coverage_bbox drives country composition.
 */
export function martinCatalogBasemap(
  slug: string,
  entry: BasemapCatalogEntry,
  styleUrl: string,
  imgFallback?: (appSlug: string) => string | undefined
): BasemapSwitchItem {
  const anchors: BasemapSwitchItem['layers'] = {
    ways: { before: undefined },
    background: { before: undefined },
  };
  const legacy = LEGACY_BASEMAP_ANCHORS[slug];
  if (legacy) {
    for (const [onLayer, opts] of Object.entries(legacy)) {
      anchors[onLayer as LayerNames] = opts as { before: string | undefined };
    }
  }
  const coverage =
    Array.isArray(entry.coverage_bbox) && entry.coverage_bbox.length === 4
      ? (entry.coverage_bbox as [number, number, number, number])
      : undefined;
  return {
    name: slug,
    label: localizedLayerLabel(slug, entry.name),
    show: entry.show,
    active: false,
    img: entry.preview_url ?? imgFallback?.(slug) ?? '',
    style: styleUrl,
    layers: anchors,
    ...(entry.fallback ? { fallback: entry.fallback } : {}),
    ...(coverage
      ? {
          countryOnly: true,
          bbox: coverage,
          countryMinZoom: COUNTRY_BASEMAP_MIN_ZOOM,
        }
      : {}),
  };
}
