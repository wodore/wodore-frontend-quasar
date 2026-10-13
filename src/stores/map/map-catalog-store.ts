/**
 * Map catalog store — orchestrates the backend map layer catalog
 * (services/map-catalog.ts) over the overlay store:
 *
 * * loads the catalog and swaps catalog-compiled overlays into the
 *   overlay store (factory fallback stays until the catalog answers);
 * * owns per-layer PARAMETER values (settings tab): authored defaults,
 *   persisted user overrides (localStorage), runtime values ({{date}});
 * * re-resolves tokenized styles on parameter changes and applies the
 *   token-bearing paint/layout/source properties live — no style reload.
 *
 * Basemaps compile from the catalog inside the basemap store (bounded
 * wait at init — see basemap-store.ts); this store only shares the
 * catalog fetch cache.
 */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import type { GeoJSONSource, GeoJSONSourceSpecification, StyleSpecification } from 'maplibre-gl';
import type { AllLayoutProperties, AllPaintProperties, Map } from 'maplibre-gl';
import { useOverlayStore } from './overlay-store';
import { useHutsStore } from '@stores/huts-store';
import { currentLocale } from '@services/locale';
import { storageGet, storageSet } from '@services/storage';
import {
  fetchMapCatalog,
  gpuSpec,
  isOpacityCurve,
  parseOpacityCurve,
  resolveTokens,
  collectTokens,
  serializeOpacityCurve,
  type MapLayerParameter,
  type MapSpecTier,
  type OpacityCurve,
} from '@services/map-catalog';
import {
  authoredParameterValues,
  fetchOverlayStyles,
  mapCatalogOverlay,
  mergeSpritePacks,
  CATALOG_OVERLAY_SLUG_ALIASES,
} from './utils/catalog-mapping';
import { wireBookingsSource } from './utils/overlay-huts';
import type { OverlaySwitchItem } from './utils/interfaces';

const PARAMS_KEY = 'mapParameterValues';

/** A validated parameter value: scalar or a parsed opacity curve. */
export type ParameterValue = number | string | boolean | OpacityCurve;

/** Catalog slugs whose app identity differs (parameter-value keys use
 *  the APP slug — catalog-mapping's CATALOG_OVERLAY_SLUG_ALIASES is the
 *  single source for the mapping). */
const CATALOG_NAME_FIXUP = CATALOG_OVERLAY_SLUG_ALIASES;

/** Styles whose geojson source is already wired (once per style object). */
const wiredStyles = new WeakSet<object>();

export const useMapCatalogStore = defineStore('mapCatalog', () => {
  const overlayStore = useOverlayStore();
  const mapRef = useMap();

  // ── State ─────────────────────────────────────────────────────────────

  const status = ref<'idle' | 'loading' | 'ready' | 'fallback'>('idle');

  /** Persisted per-layer parameter overrides: {overlayName: {paramSlug: value}}. */
  const parameterValues = ref<Record<string, Record<string, unknown>>>(
    (storageGet(PARAMS_KEY) as Record<string, Record<string, unknown>>) ?? {}
  );

  /** Runtime-scope values ({{date}}) — never persisted. */
  const runtimeValues = ref<Record<string, string>>({});

  // ── Value resolution ──────────────────────────────────────────────────

  /** Kind-appropriate guard for a persisted parameter value. */
  function sanitizeParameterValue(
    param: MapLayerParameter,
    value: unknown
  ): ParameterValue | undefined {
    switch (param.kind) {
      case 'number':
        return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
      case 'color':
        return typeof value === 'string' && value.length > 0 ? value : undefined;
      case 'boolean':
        return typeof value === 'boolean' ? value : undefined;
      case 'string':
        return typeof value === 'string' ? value : undefined;
      case 'enum': {
        if (typeof value !== 'string') return undefined;
        const options = (param.constraints?.options ?? []) as Array<string | { value: string }>;
        const allowed = options.map(o => (typeof o === 'string' ? o : o.value));
        return allowed.length === 0 || allowed.includes(value) ? value : undefined;
      }
      case 'opacity-curve':
        return isOpacityCurve(value) ? value : undefined;
      case 'date':
        // Runtime scope — never restored from storage.
        return undefined;
      default:
        return undefined;
    }
  }

  /** An authored default normalized for the settings UI (curves parsed). */
  function normalizedDefault(param: MapLayerParameter): ParameterValue | undefined {
    if (param.kind === 'opacity-curve') return parseOpacityCurve(param.default);
    return sanitizeParameterValue(param, param.default);
  }

  function persistedValue(overlayName: string, param: MapLayerParameter): ParameterValue | undefined {
    const raw = parameterValues.value[overlayName]?.[param.slug];
    return raw === undefined ? undefined : sanitizeParameterValue(param, raw);
  }

  /**
   * Full resolution values for a layer: authored defaults overlaid with
   * persisted overrides and runtime values (most specific wins). Curve
   * values are serialized back into the interpolate expressions the
   * tokenized style expects.
   */
  function resolvedParameterValues(
    overlayName: string,
    parameters: MapLayerParameter[]
  ): Record<string, unknown> {
    const values = authoredParameterValues(parameters);
    for (const param of parameters) {
      const persisted = persistedValue(overlayName, param);
      if (persisted !== undefined) {
        values[param.slug] =
          param.kind === 'opacity-curve' && isOpacityCurve(persisted)
            ? serializeOpacityCurve(persisted)
            : persisted;
      }
      const runtime = runtimeValues.value[param.slug];
      if (runtime !== undefined) values[param.slug] = runtime;
    }
    return values;
  }

  // ── Settings-tab API ──────────────────────────────────────────────────

  /** The overlay store's list through the TS2589-breaking widened cast. */
  function catalogOverlays(): OverlaySwitchItem[] {
    // SAFETY: the overlay store's real shape is { overlays: OverlaySwitchItem[] };
    // the widened cast avoids the maplibre-style TS2589 recursion (same
    // pattern as overlay-store's own casts) — items are OverlaySwitchItem.
    return (overlayStore as unknown as { overlays: OverlaySwitchItem[] }).overlays;
  }

  function findOverlay(overlayName: string): OverlaySwitchItem | undefined {
    return catalogOverlays().find(o => o.name === overlayName);
  }

  /** Effective parameter value (for rendering controls). */
  function getParameterValue(overlayName: string, paramSlug: string): ParameterValue | undefined {
    const param = findOverlay(overlayName)?.parameters?.find(p => p.slug === paramSlug);
    if (!param) return undefined;
    const persisted = persistedValue(overlayName, param);
    if (persisted !== undefined) return persisted;
    if (param.kind === 'date') return runtimeValues.value[param.slug] ?? undefined;
    return normalizedDefault(param);
  }

  /** Whether the user changed anything from the authored default. */
  function hasParameterOverride(overlayName: string): boolean {
    const params = findOverlay(overlayName)?.parameters ?? [];
    return params.some(p => persistedValue(overlayName, p) !== undefined);
  }

  function setParameterValue(overlayName: string, paramSlug: string, value: ParameterValue): void {
    const overlay = findOverlay(overlayName);
    const param = overlay?.parameters?.find(p => p.slug === paramSlug);
    if (!overlay || !param) return;
    if (param.kind === 'date') {
      // Runtime-scope: live value only, nothing persisted.
      runtimeValues.value = { ...runtimeValues.value, [paramSlug]: String(value) };
      applyRuntimeValueToLayers(paramSlug);
      return;
    }
    const clean = sanitizeParameterValue(param, value);
    if (clean === undefined) return;
    parameterValues.value = {
      ...parameterValues.value,
      [overlayName]: { ...(parameterValues.value[overlayName] ?? {}), [paramSlug]: clean },
    };
    storageSet(PARAMS_KEY, parameterValues.value);
    applyOverlayParameters(overlay);
  }

  /** Drop persisted overrides for one layer and re-resolve. */
  function resetLayerParameters(overlayName: string): void {
    if (!parameterValues.value[overlayName]) return;
    const next = { ...parameterValues.value };
    delete next[overlayName];
    parameterValues.value = next;
    storageSet(PARAMS_KEY, parameterValues.value);
    const overlay = findOverlay(overlayName);
    if (overlay) applyOverlayParameters(overlay);
  }

  // ── Live re-resolution (no style reload) ──────────────────────────────

  /**
   * Re-resolve a layer's tokenized style with the current values and apply
   * the token-bearing paint/layout properties (setPaintProperty /
   * setLayoutProperty) and geojson source URLs (setData) to the live map.
   * `overlay.style` is updated in place so later re-adds (basemap switch,
   * native recompose) render the resolved values.
   */
  function applyOverlayParameters(overlay: OverlaySwitchItem): void {
    if (!overlay.tokenizedStyle || !overlay.parameters) return;
    const values = resolvedParameterValues(overlay.name, overlay.parameters);
    const resolved = resolveTokens(overlay.tokenizedStyle, values);
    const map = mapRef.map;
    // SAFETY: tokenized style paint/layout values are valid MapLibre
    // property values (scalars or expression subtrees) — the widened cast
    // only satisfies setPaintProperty/setLayoutProperty's value unions.
    const asPaintValue = (v: unknown) => v as Parameters<Map['setPaintProperty']>[2];
    const asLayoutValue = (v: unknown) => v as Parameters<Map['setLayoutProperty']>[2];

    for (const [index, layer] of overlay.tokenizedStyle.layers.entries()) {
      const resolvedLayer = resolved.layers[index];
      if (!resolvedLayer || !map?.getLayer(layer.id)) continue;
      for (const [prop, tokenizedValue] of Object.entries(
        (layer as { paint?: Record<string, unknown> }).paint ?? {}
      )) {
        if (collectTokens(tokenizedValue).size === 0) continue;
        // SAFETY: paint keys come from the catalog style document (valid
        // MapLibre paint properties); the cast only satisfies the keyof
        // union maplibre's setPaintProperty expects.
        map.setPaintProperty(
          layer.id,
          prop as keyof AllPaintProperties,
          asPaintValue((resolvedLayer as { paint?: Record<string, unknown> }).paint?.[prop])
        );
      }
      for (const [prop, tokenizedValue] of Object.entries(
        (layer as { layout?: Record<string, unknown> }).layout ?? {}
      )) {
        if (collectTokens(tokenizedValue).size === 0) continue;
        // SAFETY: layout keys come from the catalog style document (valid
        // MapLibre layout properties); the cast only satisfies the keyof
        // union maplibre's setLayoutProperty expects.
        map.setLayoutProperty(
          layer.id,
          prop as keyof AllLayoutProperties,
          asLayoutValue((resolvedLayer as { layout?: Record<string, unknown> }).layout?.[prop])
        );
      }
    }
    for (const [id, source] of Object.entries(overlay.tokenizedStyle.sources)) {
      const data = (source as GeoJSONSourceSpecification).data;
      if (typeof data !== 'string' || !data.includes('{{')) continue;
      const resolvedData = (resolved.sources[id] as GeoJSONSourceSpecification).data;
      const mapSource = map?.getSource(id) as GeoJSONSource | undefined;
      if (typeof resolvedData === 'string' && mapSource?.setData) {
        mapSource.setData(resolvedData);
      }
    }
    overlay.style = resolved;
    const curve = overlay.parameters.find(p => p.kind === 'opacity-curve');
    if (curve && values[curve.slug] !== undefined) {
      // SAFETY: opacity-curve resolution values are the authored
      // interpolate expressions or serializeOpacityCurve output — both
      // valid maplibre opacity expressions for the overlay-level paint.
      overlay.opacity = values[curve.slug] as OverlaySwitchItem['opacity'];
    }
    overlayStore.parametersEpoch += 1;
  }

  /** Re-apply a runtime value (e.g. {{date}}) to every layer using it. */
  function applyRuntimeValueToLayers(paramSlug: string): void {
    for (const overlay of catalogOverlays()) {
      if (!overlay.tokenizedStyle) continue;
      if (collectTokens(overlay.tokenizedStyle).has(paramSlug)) {
        applyOverlayParameters(overlay);
      }
    }
  }

  /** Mirror the selected availability date into the runtime values. */
  function setRuntimeDate(date: string | undefined): void {
    if (date === undefined) {
      const next = { ...runtimeValues.value };
      delete next.date;
      runtimeValues.value = next;
    } else {
      runtimeValues.value = { ...runtimeValues.value, date };
    }
    applyRuntimeValueToLayers('date');
  }

  // ── Catalog load ──────────────────────────────────────────────────────

  /** Overlay-layer spec: the cached GPU tier (basemap-store detects and
   *  stores it; tier < 2 is the weak-GPU raster path). */
  function overlaySpec(): MapSpecTier {
    const tier = storageGet('gpuTier') as { tier?: number } | null;
    return gpuSpec((tier?.tier ?? 3) < 2);
  }

  /** Compile catalog overlay layers into swap items (styles resolved). */
  async function compileCatalogOverlays(): Promise<OverlaySwitchItem[]> {
    const catalog = await fetchMapCatalog();
    const layers = catalog.layers.filter(l => l.role === 'overlay');
    const slotSlugs = new Set(catalog.slots.map(s => s.slug));
    const spec = overlaySpec();
    const bundles = await fetchOverlayStyles(layers, spec, async (layer, tokenized) => {
      const overlayName = CATALOG_NAME_FIXUP[layer.slug] ?? layer.slug;
      return resolveTokens(
        tokenized,
        resolvedParameterValues(overlayName, layer.parameters)
      ) as StyleSpecification;
    });
    const items = layers
      .filter(layer => bundles.has(layer.slug))
      .map(layer => mapCatalogOverlay(layer, slotSlugs, bundles.get(layer.slug)!));
    mergeSpritePacks(items);
    wireCatalogSources(items);
    return items;
  }

  /** Fetch the catalog and swap catalog-compiled overlays in. */
  async function initOverlays(): Promise<void> {
    if (status.value === 'loading' || status.value === 'ready') return;
    status.value = 'loading';
    try {
      const items = await compileCatalogOverlays();
      overlayStore.applyCatalogOverlays(items);
      status.value = 'ready';
    } catch (error) {
      status.value = 'fallback';
      console.warn('[map-catalog] catalog unavailable — factory overlays stay:', error);
    }
  }

  /** Wire live geojson sources the catalog styles reference by URL token:
   *  the availability layer's `wd-bookings` rides the huts-store flow. */
  function wireCatalogSources(items: OverlaySwitchItem[]): void {
    for (const item of items) {
      if (item.catalogSlug === 'huts-availability' && !wiredStyles.has(item.style)) {
        wireBookingsSource(item.style);
        wiredStyles.add(item.style);
      }
    }
  }

  /** Locale switch: refetch (labels/legends localize server-side) and
   *  re-swap — style documents come from the fetch cache (locale-free). */
  async function rebuildOverlaysFromCatalog(): Promise<void> {
    if (status.value !== 'ready') return;
    try {
      const items = await compileCatalogOverlays();
      overlayStore.applyCatalogOverlays(items);
    } catch (error) {
      console.warn('[map-catalog] catalog rebuild failed — keeping current overlays:', error);
    }
  }

  watch(currentLocale, () => {
    void rebuildOverlaysFromCatalog();
  });

  // Mirror the hut-store's selected date into the runtime {{date}} value.
  const hutsStore = useHutsStore();
  watch(
    () => hutsStore.selectedDate,
    date => setRuntimeDate(date)
  );

  return {
    status,
    parameterValues,
    runtimeValues,
    initOverlays,
    rebuildOverlaysFromCatalog,
    getParameterValue,
    setParameterValue,
    hasParameterOverride,
    resetLayerParameters,
    applyOverlayParameters,
    setRuntimeDate,
  };
});
