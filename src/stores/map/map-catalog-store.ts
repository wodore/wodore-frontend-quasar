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
import {
  availabilityLoading,
  availabilitySpinner,
  settleAvailabilitySpinner,
  toIsoDate,
} from './availability-loading';
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
import { rendererProfile } from '@services/gpu-override';
import {
  clearMapCatalogCache,
  fetchMapCatalog,
  fetchMapSlots,
  fetchMapStyle,
  isOpacityCurve,
  loadPersistedLayers,
  parseOpacityCurve,
  persistLayers,
  purgeLegacyStyleCaches,
  resolveTokens,
  collectTokens,
  serializeOpacityCurve,
  styleVariantUrl,
  type MapCatalogLayer,
  type MapCatalogSlot,
  type MapLayerParameter,
  type OpacityCurve,
} from '@services/map-catalog';
import {
  authoredParameterValues,
  isUsableStyle as styleValid,
  mapCatalogOverlay,
  mergeSpritePacks,
} from './utils/catalog-mapping';
import { fixupBookingsStyle, applyBookingsToMap } from './utils/overlay-huts';
import { whenMapIdle, type IdleMapLike } from './utils/idle-apply';
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

  /**
   * Reveal gate (perf/map-boot): flips once every ACTIVE overlay's style
   * bundle from the boot compile has SETTLED — resolved OR skipped (a
   * failed fetch/validation counts as settled; the layer drops with a
   * notice). INACTIVE overlays' styles never gate the reveal — they are
   * menu/switcher data fetched in the background. WdMapView watches this
   * instead of the full-catalog `status`. One-way latch per session: the
   * warm-boot background refresh and locale rebuilds never re-block it.
   */
  const mapStylesReady = ref(false);

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
  // The shared ref outlives store instances (module scope): reset it
  // here so a freshly created store — e.g. per-test pinia — never
  // inherits a spinner state from a previous instance (review #349).
  availabilityLoading.value = false;
  let availabilityListenersBound = false;
  // Re-imported name kept short at the call site (module owns the canonical
  // constant; the store aliases it for the native-bridge fallback timeout).
  const AVAILABILITY_MIN_SPIN_MS_FALLBACK = 600;

  /** Gen-guarded settle delegating to the shared module (600ms minimum). */
  function settleAvailabilityLoad(gen: number): void {
    if (gen !== availabilitySpinner.gen) return; // superseded by a newer date pick
    settleAvailabilitySpinner();
  }

  function beginAvailabilityLoad(): void {
    availabilitySpinner.gen += 1;
    const gen = availabilitySpinner.gen;
    availabilityLoading.value = true;
    availabilitySpinner.shownAt = performance.now();
    // SAFETY: structural duck-type of the MapLibre map instance — vue-maplibre-gl's
    // mapRef.map is untyped in this store; only `.on` is used for the sourcedata
    // listener below. The runtime shape is guaranteed by MglMap mounting first.
    const map = mapRef.map as unknown as
      | { on?: (ev: string, fn: (e: unknown) => void) => void }
      | undefined;
    if (!map?.on) {
      // Non-MapLibre availability renderer (Leaflet fallback) owns the
      // settle: it calls settleAvailabilityLoadManual() when ITS data is
      // rendered — skip the fixed minimum so the spinner tracks the real
      // load (600ms minimum still applies inside settle).
      if (availabilitySpinner.manualSettle) return;
      // Native bridge (no sourcedata forwarding): run the fixed minimum.
      setTimeout(() => settleAvailabilityLoad(gen), AVAILABILITY_MIN_SPIN_MS_FALLBACK);
      return;
    }
    if (!availabilityListenersBound) {
      availabilityListenersBound = true;
      const onSourceData = (e: { sourceId?: string; isSourceLoaded?: boolean; type?: string }) => {
        if (e.sourceId !== 'wd-bookings') return;
        if (e.isSourceLoaded || e.type === 'sourcedataabort') {
          settleAvailabilityLoad(availabilitySpinner.gen);
        }
      };
      // SAFETY: same structural cast as above — `.on` exists on every MapLibre
      // map; the callback's event shape is the sourcedata payload subset we read.
      (mapRef.map as unknown as { on: (ev: string, fn: (e: never) => void) => void }).on(
        'sourcedata',
        onSourceData as (e: never) => void
      );
      // SAFETY: duplicate cast for the second listener registration (abort).
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

  /**
   * Load one layer's style bundle: fetch the catalog's canonical
   * `style_url` variant (backend-served spec + immutable `&v=` token,
   * `mode=tokenized` appended for parameterized layers — backend #434:
   * any variant URL carrying a valid v serves immutable, so the BROWSER
   * cache owns freshness; the in-service session dedupe collapses repeat
   * fetches). No local persistence — the retired localStorage caches were
   * redundant once URLs became content-versioned (owner decision
   * 2026-10). A missing style_url means the catalog entry is broken —
   * skip loudly like a failed fetch.
   */
  async function loadStyleBundle(layer: MapCatalogLayer): Promise<LoadedBundle | undefined> {
    const tokenized = layer.parameters.length > 0;
    if (!layer.style_url) {
      skipLayer(layer, 'layer configuration missing (style URL)', undefined);
      return undefined;
    }
    const styleUrl = layer.style_url;

    try {
      const tokenizedDoc = tokenized
        ? ((await fetchMapStyle(
            styleVariantUrl(styleUrl, { tokenized: true }),
            layer.slug
          )) as StyleSpecification)
        : undefined;
      const resolvedDoc = tokenizedDoc
        ? (resolveTokens(tokenizedDoc, valuesFor(layer)) as StyleSpecification)
        : ((await fetchMapStyle(styleVariantUrl(styleUrl), layer.slug)) as StyleSpecification);
      // Remote-data guard: an invalid document must not blank the layer —
      // the RESOLVED output is validated (tokenized docs carry invalid
      // paint tokens by design until resolved).
      if (!bundleIsValid(resolvedDoc, layer)) {
        skipLayer(layer, 'invalid style document', undefined);
        return undefined;
      }
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
   *
   * Fetch + emit priority (perf/map-boot, owner decision 2026-10):
   * ACTIVE overlays' styles (the reveal path) fetch FIRST — everything
   * else only starts once the active wave settled. Emits beyond the
   * synchronous metadata-first one are microtask-batched (the whole
   * persisted-cache warm wave collapses into ONE application), and only
   * batches in which an ACTIVE overlay's bundle arrived bump the
   * catalog-swap epoch (`mapContentChanged` → applyCatalogOverlays): the
   * compile used to bump per bundle, re-adding every active overlay's
   * map layers up to once per catalog row at boot.
   */
  async function compileCatalogOverlays(
    layers: MapCatalogLayer[],
    slotSlugs: Set<string>,
    onItems?: (items: OverlaySwitchItem[], meta?: { mapContentChanged: boolean }) => void
  ): Promise<OverlaySwitchItem[]> {
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

    // Active wave — the slugs that will be ACTIVE once applied, resolved
    // up front (current live flags on later swaps; persisted state + the
    // fresh-install active-group view on the first application) so fetch
    // order and the epoch signal never depend on the apply having run.
    const activeSlugs = overlayStore.resolveActiveSlugs(overlayLayers.map(l => l.slug));
    const activeLayers = overlayLayers.filter(l => activeSlugs.has(l.slug));
    const otherLayers = overlayLayers.filter(l => !activeSlugs.has(l.slug));

    // LIVE-REFRESH DIFF (tab-focus revalidation): an arrival is map
    // content only when its style actually changed. Style URLs are
    // content-versioned (`&v=`, backend #434) — same URL ⇒ same
    // document — so compare against the style URLs of the items
    // currently applied. Cold boot / first application: nothing is
    // live yet, everything counts as changed (each active arrival
    // bumps, exactly the pre-diff behavior). Unchanged revalidations
    // stay menu-only — no re-add flicker on every tab focus, and the
    // warm-boot refresh stops re-adding layers whose style did not
    // change. A previously SKIPPED layer (absent from the live list)
    // also counts as changed — its arrival is new map content.
    // SAFETY: same widened cast as applyCatalogOverlays — reading
    // .name/.active/.styleUrl only, fields every catalog item sets
    // (styleUrl since the live-refresh diff; placeholder rows carry
    // it too, unresolved ones are absent from the live list anyway).
    const liveOverlays = overlayStore.overlays as unknown as Array<{
      name: string;
      active?: boolean;
      styleUrl?: string;
    }>;
    // Plain record, not new Map() — the maplibre `Map` TYPE import
    // shadows the global constructor (same as orderOf above).
    const liveStyleUrls: Record<string, string | undefined> = Object.fromEntries(
      liveOverlays.map(o => [o.name, o.styleUrl])
    );
    const styleChanged = (layer: MapCatalogLayer): boolean =>
      liveStyleUrls[layer.slug] !== (layer.style_url ?? undefined);
    // An ACTIVE layer that left the catalog is map content too: its
    // splice-drop must bump the epoch so renderers REMOVE its layers.
    // Raised after the active wave settles (never over placeholder
    // rows — see below). A skipped-while-active broken entry
    // (missing style_url) is NOT covered — its loud skip notice fires
    // and the next real change drops it.
    const removedActive = liveOverlays.some(
      o => o.active && !overlayLayers.some(l => l.slug === o.name)
    );

    let emitScheduled = false;
    let activeArrivedInBatch = false;
    const emitAll = (mapContentChanged: boolean): void => {
      const snapshot = overlayLayers
        .filter(l => settled[l.slug] !== null)
        .map(l => settled[l.slug] ?? placeholders[l.slug]!)
        .sort((a, b) => (orderOf[a.name] ?? 0) - (orderOf[b.name] ?? 0));
      mergeSpritePacks(snapshot);
      fixupCatalogStyles(snapshot);
      onItems?.(snapshot, { mapContentChanged });
    };
    /** Microtask-batched emit: bundles resolving in the same tick (the
     *  whole persisted-cache warm wave) collapse into ONE application. */
    const scheduleEmit = (activeArrived: boolean): void => {
      if (activeArrived) activeArrivedInBatch = true;
      if (emitScheduled) return;
      emitScheduled = true;
      queueMicrotask(() => {
        emitScheduled = false;
        const changed = activeArrivedInBatch;
        activeArrivedInBatch = false;
        emitAll(changed);
      });
    };

    emitAll(false); // metadata-first: rows before any style fetch settles

    const load = async (layer: MapCatalogLayer, isActive: boolean): Promise<void> => {
      const bundle = await loadStyleBundle(layer);
      settled[layer.slug] = bundle ? mapCatalogOverlay(layer, slotSlugs, bundle) : null;
      // A user may have toggled a placeholder row ON mid-compile: its
      // arrival is map content too, even though the pre-resolved wave
      // classified it as inactive (reading the live flag at settle time
      // catches that; the next apply's live-state adoption keeps it on).
      // SAFETY: overlays items are OverlaySwitchItem — reading .name and
      // .active only, fields every catalog item sets; the widened cast
      // breaks the maplibre-style TS2589 recursion (same pattern as
      // applyCatalogOverlays in the overlay store).
      const liveOverlays = overlayStore.overlays as unknown as Array<{
        name: string;
        active?: boolean;
      }>;
      const isActiveNow = isActive || liveOverlays.some(o => o.name === layer.slug && o.active);
      scheduleEmit(isActiveNow && styleChanged(layer));
    };
    // Active wave (reveal path) first — flipping the reveal latch below
    // the moment it settles — then the background wave for the menu.
    await Promise.all(activeLayers.map(l => load(l, true)));
    mapStylesReady.value = true;
    // Vanished-active drop (see removedActive above): raise it now —
    // the active wave settled, so a bump re-adds real styles, never
    // placeholder rows.
    if (removedActive) scheduleEmit(true);
    await Promise.all(otherLayers.map(l => load(l, false)));
    // Deterministic final flush (review nit, PR #357): by the time the
    // background wave resolves, its last batched emit already ran
    // (microtasks drain before this continuation) — this extra apply is
    // menu-only (no epoch bump) and guarantees a final list exactly once,
    // covering the zero-layer edge where no emit ever fired.
    emitAll(false);
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
    // One-time cleanup of the retired localStorage style caches (their
    // immutable-URL replacements live in the browser/SW cache now).
    purgeLegacyStyleCaches();
    // The session's catalog VIEW: fallback sessions warm-boot only the
    // subset snapshot (the default rows would hide again — the #362
    // gap class; loadPersistedLayers cross-checks the stored view).
    const cached = loadPersistedLayers(rendererProfile() ?? null);
    if (cached) {
      try {
        // Cache-first render; cached styles apply synchronously, missing
        // entries stream in progressively (see compileCatalogOverlays).
        // Slots are not persisted — the seed set matches the backend seed
        // and the fresh compile below switches to the fetched list.
        await compileCatalogOverlays(cached.data, SEED_SLOT_SLUGS, (items, meta) =>
          overlayStore.applyCatalogOverlays(items, {
            bumpEpoch: meta?.mapContentChanged ?? true,
          })
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

  /** Deferred epoch bump (idle-gated apply, tab-focus refreshes):
   *  the items were applied menu-only the moment they arrived; the
   *  map-visible re-add (overlay remove + re-add on the renderers)
   *  waits for the app to go idle so a version bump published
   *  mid-session never interrupts an interaction. One pending bump at
   *  a time — the bump applies the LATEST items, so a second change
   *  arriving while one waits rides along. */
  let idleBumpPending = false;
  function scheduleIdleEpochBump(): void {
    if (idleBumpPending) return;
    idleBumpPending = true;
    // SAFETY: structural duck-type — only `.once`/`.off` are used (the
    // idle-apply gate); same pattern as the sourcedata listener above.
    whenMapIdle(mapRef.map as unknown as IdleMapLike, () => {
      idleBumpPending = false;
      overlayStore.bumpCatalogEpoch();
    });
  }

  /** Fetch the fresh layers catalog, sync changed styles, apply,
   *  persist. The basemap store compiles its picker from the same
   *  deduplicated service fetch (it never needs a handoff).
   *
   *  `revalidate` drops the in-session catalog cache first — a true
   *  conditional GET (the browser revalidates the ETag; a 304 when
   *  nothing changed). Tab-focus revalidations need it: the boot
   *  fetch's promise would otherwise be served all session.
   *  `deferApply` routes map-content batches through the idle gate
   *  above — boot refreshes apply immediately (the session is still
   *  settling, no interaction to interrupt), tab-focus refreshes
   *  defer. */
  async function refreshCatalog(options: {
    background: boolean;
    revalidate?: boolean;
    deferApply?: boolean;
  }): Promise<void> {
    const { background, revalidate = false, deferApply = false } = options;
    if (refreshing) return;
    refreshing = true;
    try {
      if (revalidate) clearMapCatalogCache();
      const lang = currentLocale();
      // One shared layers fetch for overlays + basemaps: await the GPU
      // tier so `?spec=` matches the basemap store's request (the
      // service dedupes concurrent callers onto a single request).
      const spec = await useBasemapStore().gpuSpecReady;
      // OVERLAYS declare the renderer capability (backend #440):
      // fallback sessions request the SUBSET view — full-only rows
      // (transport-stops until #443, huts) never reach the menu, no
      // client-side hide needed. Synchronous signal, so it is resolved
      // before the fetch fires. MapLibre sessions pass undefined (the
      // default catalog — same fetch as the basemap stores, still
      // deduped onto ONE request). BASEMAPS stay on the default view
      // on purpose: world-satellite-hybrid has no subset variant and
      // would vanish from the fallback's basemap list — the fallback's
      // raster extraction already gates which default basemaps render.
      const profile = rendererProfile();
      const [{ data: layers }, slotSlugs] = await Promise.all([
        fetchMapCatalog(lang, spec, undefined, profile),
        slotSlugsFor(lang),
      ]);
      persistLayers(layers, lang, profile ?? null);
      // The per-style documents are switcher data, not first-render
      // data — they are already deferred off the first-paint critical
      // path by MapPage's idle-gated map mount (WdMapView setup is what
      // triggers this compile), and the basemap store's idle prewarm
      // warms their URLs meanwhile so this mostly reads HTTP-cache hits
      // (perf/fast-first-paint). No additional idle hop here: stacking a
      // second deadline behind the mount gate only delays the styles.
      await compileCatalogOverlays(layers, slotSlugs, (items, meta) => {
        if (!deferApply) {
          overlayStore.applyCatalogOverlays(items, {
            bumpEpoch: meta?.mapContentChanged ?? true,
          });
          return;
        }
        // Tab-focus refresh: the menu applies immediately (labels,
        // legends, new rows); the epoch bump — the only map-visible
        // part — waits for idle.
        overlayStore.applyCatalogOverlays(items, { bumpEpoch: false });
        if (meta?.mapContentChanged) scheduleIdleEpochBump();
      });
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
      // Same view as the boot fetch — a fallback session's locale
      // switch must not suddenly load the default rows.
      const profile = rendererProfile();
      const [{ data: layers }, slotSlugs] = await Promise.all([
        fetchMapCatalog(lang, spec, undefined, profile),
        slotSlugsFor(lang),
      ]);
      await compileCatalogOverlays(layers, slotSlugs, (items, meta) =>
        overlayStore.applyCatalogOverlays(items, {
          bumpEpoch: meta?.mapContentChanged ?? true,
        })
      );
    } catch (error) {
      console.warn('[map-catalog] catalog rebuild failed — keeping current overlays:', error);
    }
  }

  watch(currentLocale, () => {
    void rebuildOverlaysFromCatalog();
  });

  // Mirror the hut-store's selected date into the runtime {{date}} value.
  // IMMEDIATE: the date can predate this store — WdSelectDate restores it
  // from the ?date= query at layout mount, while this store is only created
  // when the idle-gated async WdMapView mounts. A non-immediate watch would
  // never fire for that pre-existing value, the runtime date would stay
  // unset, and the wd-bookings tile URLs would keep the today boot default
  // (staging incident 2026-10-27: the map showed the wrong date's
  // availability while the date pill showed the picked date).
  const hutsStore = useHutsStore();
  watch(
    () => hutsStore.selectedDate,
    date => setRuntimeDate(date),
    { immediate: true }
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
    mapStylesReady,
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
    // Re-exported for API stability (specs + any store consumers read it
    // here); the ref itself lives in ./availability-loading so eager
    // chunk consumers (WdSelectDate) need no cluster import.
    availabilityLoading,
  };
});

// ── Tab-focus revalidation (singleton) ───────────────────────────────
// Mid-session style updates (live refresh): one conditional GET per
// tab focus — the same moment basemap-store revalidates its list — so
// a version published while the app is open reaches the map without a
// reload. The ETag makes an unchanged focus a 304; changed layers get
// a new immutable `&v=` URL (fresh document), and the map-visible
// apply is idle-gated inside the refresh (deferApply).
//
// BOUND ONCE at module level, resolving the ACTIVE pinia's store at
// event time — per-instance listeners (useEventListener in the setup)
// would pile onto the long-lived document one per store creation and
// never dispose (no component scope in stores), exactly the leak the
// basemap specs work around with effectScope.
if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible') return;
    const store = useMapCatalogStore();
    // 'idle' = the map view never booted this store (crawler / non-map
    // routes — creating it here would be pure waste); 'loading' = cold
    // boot in flight, its fetch is fresh. An 'error' boot retries —
    // the focus refresh is self-healing (silent, background).
    if (store.status === 'idle' || store.status === 'loading') return;
    void store.refreshCatalog({ background: true, revalidate: true, deferApply: true });
  });
}
