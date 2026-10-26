/**
 * Map catalog store — orchestrates the backend map layer catalog
 * (services/map-catalog.ts) over the overlay store:
 *
 * * BOOT renders the persisted layers snapshot + style cache
 *   synchronously (localStorage via the storage service); a cold first
 *   run shows an explicit loading state — there are NO bundled factory
 *   fallbacks (design.md D1, owner decision).
 * * SYNC: a fresh `GET /v1/map/layers` is fetched in the background
 *   (server ETag + revalidate-always — one online reload is fresh);
 *   per layer the style is refetched ONLY when its `modified` (ISO
 *   timestamp, backend #331) changed — otherwise the persisted
 *   document serves.
 * * Owns per-layer PARAMETER values (settings tab): authored defaults,
 *   persisted user overrides (localStorage), runtime values ({{date}});
 *   re-resolves tokenized styles on parameter changes and applies the
 *   token-bearing paint/layout/source properties live — no style reload.
 * * An invalid served/persisted style SKIPS that layer with a loud,
 *   user-visible error (never a silent fallback).
 *
 * Basemaps compile from the SAME layers response inside the basemap
 * store (it fetches through the same deduplicated service call).
 */
import { defineStore } from 'pinia';
import { ref, watch } from 'vue';
import { useMap } from '@indoorequal/vue-maplibre-gl';
import { Notify } from 'quasar';
import { availabilityLoading } from './availability-loading';
import type {
  AllLayoutProperties,
  AllPaintProperties,
  GeoJSONSource,
  GeoJSONSourceSpecification,
  Map,
  StyleSpecification,
  VectorTileSource,
  VectorSourceSpecification,
} from 'maplibre-gl';
import { useOverlayStore } from './overlay-store';
import { useBasemapStore } from './basemap-store';
import { useHutsStore } from '@stores/huts-store';
import { currentLocale } from '@services/locale';
import { storageGet, storageSet } from '@services/storage';
import {
  fetchMapCatalog,
  fetchMapSlots,
  fetchMapStyle,
  gpuSpec,
  isOpacityCurve,
  loadPersistedLayers,
  loadStyleCache,
  parseOpacityCurve,
  persistLayers,
  persistStyleEntry,
  pruneStyleCache,
  resolveTokens,
  collectTokens,
  serializeOpacityCurve,
  styleCacheKey,
  styleEndpointUrl,
  type MapCatalogLayer,
  type MapCatalogSlot,
  type MapLayerParameter,
  type MapSpecTier,
  type OpacityCurve,
  type PersistedStyleCache,
  type PersistedStyleEntry,
} from '@services/map-catalog';
import {
  authoredParameterValues,
  isUsableStyle as styleValid,
  mapCatalogOverlay,
  mergeSpritePacks,
} from './utils/catalog-mapping';
import { fixupBookingsStyle, applyBookingsToMap } from './utils/overlay-huts';
import type { OverlaySwitchItem } from './utils/interfaces';

const PARAMS_KEY = 'mapParameterValues';

/** A validated parameter value: scalar or a parsed opacity curve. */
export type ParameterValue = number | string | boolean | OpacityCurve;

export const useMapCatalogStore = defineStore('mapCatalog', () => {
  const overlayStore = useOverlayStore();
  const mapRef = useMap();

  // ── State ─────────────────────────────────────────────────────────────

  /** 'loading' = cold boot, catalog being fetched (no cache to render). */
  const status = ref<'idle' | 'loading' | 'ready' | 'error'>('idle');

  /** Persisted per-layer parameter overrides: {overlayName: {paramSlug: value}}. */
  const parameterValues = ref<Record<string, Record<string, unknown>>>(
    (storageGet(PARAMS_KEY) as Record<string, Record<string, unknown>>) ?? {}
  );

  /** Runtime-scope values ({{date}}) — never persisted. */
  const runtimeValues = ref<Record<string, string>>({});

  /** Availability date-load spinner state: the shared ref lives in
   * the dependency-free ./availability-loading module so WdSelectDate
   * (eager MainLayout chunk) can read it without importing this store
   * — that import would drag the map-store cluster + MapLibre vendor
   * chunk onto every crawler's download list (follow-up to PR #347).
   * Semantics: setTiles → `sourcedata` settle, 600ms minimum spin;
   * native builds run the fixed minimum (the Capacitor bridge does
   * not forward sourcedata events). */
  let availabilityLoadGen = 0;
  let availabilityShownAt = 0;
  let availabilityListenersBound = false;
  const AVAILABILITY_MIN_SPIN_MS = 600;

  function settleAvailabilityLoad(gen: number): void {
    if (gen !== availabilityLoadGen) return; // superseded by a newer date pick
    const elapsed = performance.now() - availabilityShownAt;
    const remaining = AVAILABILITY_MIN_SPIN_MS - elapsed;
    if (remaining > 0) {
      setTimeout(() => {
        if (gen === availabilityLoadGen) availabilityLoading.value = false;
      }, remaining);
    } else {
      availabilityLoading.value = false;
    }
  }

  function beginAvailabilityLoad(): void {
    const gen = ++availabilityLoadGen;
    availabilityLoading.value = true;
    availabilityShownAt = performance.now();
    const map = mapRef.map as unknown as
      | { on?: (ev: string, fn: (e: unknown) => void) => void }
      | undefined;
    if (!map?.on) {
      // Native bridge (no sourcedata forwarding): run the fixed minimum.
      setTimeout(() => settleAvailabilityLoad(gen), AVAILABILITY_MIN_SPIN_MS);
      return;
    }
    if (!availabilityListenersBound) {
      availabilityListenersBound = true;
      const onSourceData = (e: { sourceId?: string; isSourceLoaded?: boolean; type?: string }) => {
        if (e.sourceId !== 'wd-bookings') return;
        if (e.isSourceLoaded || e.type === 'sourcedataabort') {
          settleAvailabilityLoad(availabilityLoadGen);
        }
      };
      (mapRef.map as unknown as { on: (ev: string, fn: (e: never) => void) => void }).on(
        'sourcedata',
        onSourceData as (e: never) => void
      );
      (mapRef.map as unknown as { on: (ev: string, fn: (e: never) => void) => void }).on(
        'sourcedataabort',
        onSourceData as (e: never) => void
      );
    }
  }

  let refreshing = false;

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

  function persistedValue(
    overlayName: string,
    param: MapLayerParameter
  ): ParameterValue | undefined {
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
      if (runtime !== undefined) {
        values[param.slug] = runtime;
      } else if (param.kind === 'date' && values[param.slug] == null) {
        // Boot default: the backend substitutes the same serve-time
        // default in resolved mode; tokenized mode leaves {{date}} for
        // the client. Without this the geojson source URL fetches a
        // literal {{date}} (staging incident 2026-10-16).
        values[param.slug] = new Date().toISOString().slice(0, 10);
      }
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
      // Runtime-scope: live value only, nothing persisted. Normalized to
      // ISO — tile URLs reject picker formats with an empty tile.
      const next = { ...runtimeValues.value };
      const iso = toIsoDate(String(value));
      if (iso === undefined) delete next[paramSlug];
      else next[paramSlug] = iso;
      runtimeValues.value = next;
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
      if (typeof data === 'string' && data.includes('{{')) {
        // The legacy availability geojson source is wired to the huts
        // store's live object — a resolved URL would drop the date-picker
        // flow's auth/lang/days params and fetch without a picked date.
        // (The vector wd-bookings source takes the tiles branch below.)
        if (id !== 'wd-bookings') {
          const resolvedData = (resolved.sources[id] as GeoJSONSourceSpecification).data;
          const mapSource = map?.getSource(id) as GeoJSONSource | undefined;
          if (typeof resolvedData === 'string' && mapSource?.setData) {
            mapSource.setData(resolvedData);
          }
        }
      }
      // Vector sources: substitute {{token}} templates inside the tile
      // URLs (the availability source's {{date}}) and hot-swap them —
      // maplibre aborts in-flight tile requests of the old URL and only
      // fetches tiles whose URL actually changed.
      const tiles = (source as VectorSourceSpecification).tiles;
      if (Array.isArray(tiles) && tiles.some(t => t.includes('{{'))) {
        const resolvedTiles = (resolved.sources[id] as VectorSourceSpecification).tiles;
        const vectorSource = map?.getSource(id) as VectorTileSource | undefined;
        if (Array.isArray(resolvedTiles) && vectorSource?.setTiles) {
          vectorSource.setTiles(resolvedTiles);
          if (id === 'wd-bookings') beginAvailabilityLoad();
        }
      }
    }
    overlay.style = resolved;
    // The availability source (geojson: store-injected data; vector:
    // token-resolved tile URLs, swapped above) — synchronous fixup:
    // bake the date-gated visibility, then apply to the live map.
    if (fixupBookingsStyle(resolved)) {
      applyBookingsToMap(map, Boolean(overlay.active));
    }
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

  /** Normalize a picker/deep-link date into ISO `YYYY-MM-DD`.
   *
   *  The huts store's `selectedDate` carries the date-picker formats
   *  (`DD.MM.YY` from the picker, `DD.MM.YYYY` from the `?date=` deep
   *  link) — the old availability GeoJSON endpoint parsed those
   *  server-side. The Martin availability tile function requires an
   *  explicit ISO date (anything else is an intentional 204), so the
   *  runtime `{{date}}` token must be normalized before it lands in tile
   *  URLs. Unparseable input yields undefined (token stays unresolved →
   *  the date-gated layers stay hidden). */
  function toIsoDate(input: string | undefined): string | undefined {
    if (!input) return undefined;
    const euro = input.match(/^(\d{2})\.(\d{2})\.(\d{2}|\d{4})$/);
    if (euro) {
      const year = euro[3]!.length === 2 ? `20${euro[3]}` : euro[3]!;
      return `${year}-${euro[2]}-${euro[1]}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
    return undefined;
  }

  /** Mirror the selected availability date into the runtime values. */
  function setRuntimeDate(date: string | undefined): void {
    const iso = toIsoDate(date);
    if (iso === undefined) {
      const next = { ...runtimeValues.value };
      delete next.date;
      runtimeValues.value = next;
    } else {
      runtimeValues.value = { ...runtimeValues.value, date: iso };
    }
    applyRuntimeValueToLayers('date');
  }

  // ── Style loading with the persisted cache + version sync ─────────────

  /** Overlay-layer spec: the cached GPU tier (basemap-store detects and
   *  stores it; tier < 2 is the weak-GPU raster path). */
  function overlaySpec(): MapSpecTier {
    const tier = storageGet('gpuTier') as { tier?: number } | null;
    return gpuSpec((tier?.tier ?? 3) < 2);
  }

  interface LoadedBundle {
    style: StyleSpecification;
    tokenizedStyle?: StyleSpecification;
  }

  /** Loud, user-visible skip: the layer is absent until the backend fixes it. */
  function skipLayer(layer: MapCatalogLayer, reason: string, detail: unknown): void {
    console.warn(`[map-catalog] skipping layer '${layer.slug}': ${reason}`, detail ?? '');
    Notify.create({
      type: 'negative',
      position: 'bottom',
      message: `${layer.name || layer.slug}`,
      caption: reason,
      timeout: 4000,
    });
  }

  /** Whether a style document is structurally usable. Tokenized
   *  documents carry `{{param}}` strings (invalid paint values by
   *  design) — their RESOLVED output is what renderers consume, so that
   *  is validated instead. */
  function bundleIsValid(doc: StyleSpecification, layer: MapCatalogLayer): boolean {
    const tokenized = layer.parameters.length > 0;
    const validated = tokenized
      ? (resolveTokens(doc, valuesFor(layer)) as StyleSpecification)
      : doc;
    return styleValid(validated);
  }

  /** Whether a cached entry can serve this layer (modified + validity). */
  function cacheServes(
    entry: PersistedStyleEntry | undefined,
    layer: MapCatalogLayer,
    tokenized: boolean
  ): entry is PersistedStyleEntry {
    if (!entry) return false;
    if ((entry.modified ?? null) !== (layer.modified ?? null)) return false;
    const doc = tokenized ? entry.tokenized : entry.style;
    if (!doc) return false;
    return bundleIsValid(doc, layer);
  }

  /**
   * Load one layer's style bundle: the persisted cache serves when the
   * version matches; otherwise the style endpoint is fetched (tokenized
   * for parameterized layers, resolved otherwise) and persisted.
   */
  async function loadStyleBundle(
    layer: MapCatalogLayer,
    spec: MapSpecTier,
    cache: PersistedStyleCache
  ): Promise<LoadedBundle | undefined> {
    const tokenized = layer.parameters.length > 0;
    const key = styleCacheKey(layer.slug, spec, tokenized);
    const cached = cache[key];
    if (cacheServes(cached, layer, tokenized)) {
      if (tokenized && cached.tokenized) {
        return {
          style: resolveTokens(cached.tokenized, valuesFor(layer)) as StyleSpecification,
          tokenizedStyle: cached.tokenized,
        };
      }
      if (!tokenized && cached.style) return { style: cached.style };
    }

    try {
      const tokenizedDoc = tokenized
        ? ((await fetchMapStyle(
            styleEndpointUrl(layer.slug, { spec, tokenized: true }),
            layer.slug
          )) as StyleSpecification)
        : undefined;
      const resolvedDoc = tokenizedDoc
        ? (resolveTokens(tokenizedDoc, valuesFor(layer)) as StyleSpecification)
        : ((await fetchMapStyle(
            styleEndpointUrl(layer.slug, { spec }),
            layer.slug
          )) as StyleSpecification);
      // Remote-data guard: an invalid document must not blank the layer —
      // the RESOLVED output is validated (tokenized docs carry invalid
      // paint tokens by design until resolved).
      if (!bundleIsValid(resolvedDoc, layer)) {
        skipLayer(layer, 'invalid style document', undefined);
        return undefined;
      }
      persistStyleEntry(key, {
        ...(tokenized ? { tokenized: tokenizedDoc } : { style: resolvedDoc }),
        modified: layer.modified ?? null,
      });
      return { style: resolvedDoc, tokenizedStyle: tokenizedDoc };
    } catch (error) {
      skipLayer(layer, 'style could not be loaded', error);
      return undefined;
    }
  }

  function valuesFor(layer: MapCatalogLayer): Record<string, unknown> {
    return resolvedParameterValues(layer.slug, layer.parameters);
  }

  /** Placeholder style for metadata-first rows (design.md D1): the row
   *  renders from catalog metadata before its style document arrives —
   *  addOverlay on an empty style is a no-op, the real bundle replaces
   *  it on the next progressive apply. */
  const PLACEHOLDER_STYLE: StyleSpecification = { version: 8, sources: {}, layers: [] };

  /** Slot slugs the backend seed carries (backend #331 `map_seed`) —
   *  the persisted-snapshot compile's fallback while `/v1/map/slots`
   *  resolves; the fresh compile always uses the fetched list. */
  const SEED_SLOT_SLUGS = new Set(['background', 'ways']);

  /** The slot slugs for a compile — fetched list, degraded to the seed
   *  set when the slots endpoint is unreachable (the anchor-override
   *  behavior then matches the seed exactly). */
  async function slotSlugsFor(lang: string): Promise<Set<string>> {
    try {
      const slots: MapCatalogSlot[] = await fetchMapSlots(lang);
      return new Set(slots.map(s => s.slug));
    } catch {
      return SEED_SLOT_SLUGS;
    }
  }

  /**
   * Compile catalog overlay layers into swap items. METADATA-FIRST and
   * PROGRESSIVE: an initial batch of placeholder rows applies as soon as
   * the catalog is known (labels/icons/settings render immediately, even
   * when the style endpoint is slow or dead); every resolved bundle then
   * replaces its placeholder through `onItems` (catalog order), and a
   * layer whose style fails validation or fetch DROPS from the list
   * (skip loudly — design.md D8). Returns the final list.
   */
  async function compileCatalogOverlays(
    layers: MapCatalogLayer[],
    slotSlugs: Set<string>,
    onItems?: (items: OverlaySwitchItem[]) => void
  ): Promise<OverlaySwitchItem[]> {
    const spec = overlaySpec();
    const styleCache = loadStyleCache();
    const overlayLayers = layers.filter(l => l.role === 'overlay');
    // Catalog order (role, order, slug — the backend sorts): progressive
    // batches resolve in network order; this lookup keeps the list stable.
    // (Plain record — the maplibre `Map` type import shadows the global.)
    const orderOf: Record<string, number> = Object.fromEntries(
      overlayLayers.map((l, i) => [l.slug, l.order * 1000 + i])
    );
    const placeholders: Record<string, OverlaySwitchItem> = Object.fromEntries(
      overlayLayers.map(l => [
        l.slug,
        mapCatalogOverlay(l, slotSlugs, { style: PLACEHOLDER_STYLE }),
      ])
    );
    /** Resolved items by slug; null = skipped (invalid/unfetchable style). */
    const settled: Record<string, OverlaySwitchItem | null> = {};
    const emit = () => {
      const snapshot = overlayLayers
        .filter(l => settled[l.slug] !== null)
        .map(l => settled[l.slug] ?? placeholders[l.slug]!)
        .sort((a, b) => (orderOf[a.name] ?? 0) - (orderOf[b.name] ?? 0));
      mergeSpritePacks(snapshot);
      fixupCatalogStyles(snapshot);
      onItems?.(snapshot);
    };
    emit(); // metadata-first: rows before any style fetch settles
    await Promise.all(
      overlayLayers.map(async layer => {
        const bundle = await loadStyleBundle(layer, spec, styleCache);
        settled[layer.slug] = bundle ? mapCatalogOverlay(layer, slotSlugs, bundle) : null;
        emit();
        return undefined;
      })
    );
    emit();
    return overlayLayers
      .filter(l => settled[l.slug])
      .map(l => settled[l.slug]!)
      .sort((a, b) => (orderOf[a.name] ?? 0) - (orderOf[b.name] ?? 0));
  }

  /** Fix up live geojson sources the catalog styles reference by URL
   *  token: the availability `wd-bookings` source rides the huts-store
   *  flow. Detected by source, not slug — backend #327 merged
   *  `huts-availability` into `huts` (the slug is retired). */
  function fixupCatalogStyles(items: OverlaySwitchItem[]): void {
    for (const item of items) {
      fixupBookingsStyle(item.style);
    }
  }

  // ── Boot + background sync ────────────────────────────────────────────

  /**
   * Boot: render the persisted layers snapshot immediately (if any),
   * then fetch a fresh catalog in the background and refetch only layers
   * whose `modified` changed. Cold first run: explicit loading state,
   * never factories.
   */
  async function initOverlays(): Promise<void> {
    const cached = loadPersistedLayers();
    if (cached) {
      try {
        // Cache-first render; cached styles apply synchronously, missing
        // entries stream in progressively (see compileCatalogOverlays).
        // Slots are not persisted — the seed set matches the backend seed
        // and the fresh compile below switches to the fetched list.
        await compileCatalogOverlays(cached.data, SEED_SLOT_SLUGS, items =>
          overlayStore.applyCatalogOverlays(items)
        );
        status.value = 'ready';
      } catch (error) {
        console.warn('[map-catalog] persisted layers could not be rendered:', error);
      }
    } else {
      status.value = 'loading';
    }
    await refreshCatalog({ background: cached !== null });
  }

  /** Fetch the fresh layers catalog, sync changed styles, apply,
   *  persist. The basemap store compiles its picker from the same
   *  deduplicated service fetch (it never needs a handoff). */
  async function refreshCatalog({ background }: { background: boolean }): Promise<void> {
    if (refreshing) return;
    refreshing = true;
    try {
      const lang = currentLocale();
      // One shared layers fetch for overlays + basemaps: await the GPU
      // tier so `?spec=` matches the basemap store's request (the
      // service dedupes concurrent callers onto a single request).
      const spec = await useBasemapStore().gpuSpecReady;
      const [{ data: layers }, slotSlugs] = await Promise.all([
        fetchMapCatalog(lang, spec),
        slotSlugsFor(lang),
      ]);
      persistLayers(layers, lang);
      pruneStyleCache(new Set(layers.map(l => l.slug)));
      // The per-style documents are switcher data, not first-render
      // data — they are already deferred off the first-paint critical
      // path by MapPage's idle-gated map mount (WdMapView setup is what
      // triggers this compile), and the basemap store's idle prewarm
      // warms their URLs meanwhile so this mostly reads HTTP-cache hits
      // (perf/fast-first-paint). No additional idle hop here: stacking a
      // second deadline behind the mount gate only delays the styles.
      await compileCatalogOverlays(layers, slotSlugs, items =>
        overlayStore.applyCatalogOverlays(items)
      );
      status.value = 'ready';
    } catch (error) {
      console.warn('[map-catalog] catalog refresh failed:', error);
      if (!background && status.value !== 'ready') {
        status.value = 'error';
        Notify.create({
          type: 'negative',
          position: 'bottom',
          message:
            currentLocale() === 'de'
              ? 'Kartenebenen konnten nicht geladen werden'
              : 'Map layers could not be loaded',
          timeout: 4000,
        });
      }
    } finally {
      refreshing = false;
    }
  }

  /** Locale switch: refetch (labels/legends localize server-side) and
   *  re-swap — unchanged styles come from the persisted cache. */
  async function rebuildOverlaysFromCatalog(): Promise<void> {
    if (status.value !== 'ready') return;
    try {
      const lang = currentLocale();
      const spec = await useBasemapStore().gpuSpecReady;
      const [{ data: layers }, slotSlugs] = await Promise.all([
        fetchMapCatalog(lang, spec),
        slotSlugsFor(lang),
      ]);
      await compileCatalogOverlays(layers, slotSlugs, items =>
        overlayStore.applyCatalogOverlays(items)
      );
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

  // Availability data arrival (date picked → fetch settled, or cleared):
  // push the live bookings object into the current huts overlay's style
  // spec (re-adds and basemap switches carry it) and the live map source.
  // ONE watch for all styles — there is no per-style wiring to leak.
  watch(
    () => hutsStore.bookingsGeojson,
    () => {
      for (const overlay of catalogOverlays()) {
        if (fixupBookingsStyle(overlay.style)) {
          applyBookingsToMap(mapRef.map, Boolean(overlay.active));
        }
      }
    }
  );

  return {
    status,
    parameterValues,
    runtimeValues,
    initOverlays,
    refreshCatalog,
    rebuildOverlaysFromCatalog,
    getParameterValue,
    setParameterValue,
    hasParameterOverride,
    resetLayerParameters,
    applyOverlayParameters,
    setRuntimeDate,
  };
});
