/**
 * FALLBACK BASEMAPS — the Leaflet fallback's raster basemap set.
 *
 * CATALOG-ONLY (MapLibre parity, owner decision 2026-11): the list is
 * EMPTY until the backend catalog resolves (`/v1/map/layers`,
 * role=basemap) — same rule the MapLibre path follows since design.md
 * D1 ("no bundled factory basemaps"). There is deliberately NO offline
 * seed trio anymore and no TILE_SERVER constant: nothing renders until
 * served data arrives, and a catalog failure leaves an empty rail
 * behind the loading splash (WdMapView's reveal safety ladder shows
 * the app anyway — the catalog error row explains the empty map).
 *
 * Detection rule (first-sourced-layer): a MapLibre style paints its
 * base beneath everything, so the first layer referencing a source
 * names the base — raster ⇒ Leaflet can serve that source's tiles
 * directly (world-topo, world-satellite-hybrid, ch-swisstopo-full);
 * vector or background-only ⇒ skipped (wd-outdoor-base-* etc.). The
 * `show` flag and a NULL coverage_bbox gate the list further (the
 * fallback is a WORLD map — country-scoped rasters would be blank
 * oceans at world view).
 *
 * IDs are stable catalog slugs ('world-topo', …); legacy POC ids
 * ('topo', 'satellite' — and the retired hardcoded 'osm') migrate on
 * read. Labels: catalog entries carry the localized backend name.
 * Thumbnails use local assets until the backend serves `preview_url`
 * (follow-up).
 */
import { ref, type Ref } from 'vue';
import {
  fetchMapCatalog,
  fetchMapStyle,
  absolutizeStyleUrl,
  type MapCatalogLayer,
} from '@services/map-catalog';
import type { StyleSpecification } from 'maplibre-gl';

export interface FbBasemap {
  /** Stable slug — the catalog layer slug. */
  id: string;
  /** Raster tile URL template ({z}/{x}/{y}). */
  url: string;
  attribution: string;
  maxNativeZoom: number;
  thumb: string;
  /** Localized display name (catalog `name`); undefined = use the
   *  `map.fallbackBasemaps.${id}` i18n key. */
  label?: string;
}

/** POC-era ids → catalog slugs (migrated on read, persisted back);
 *  'osm' was the retired hardcoded offline entry — it maps through to
 *  itself and simply matches nothing until the catalog carries it. */
const LEGACY_IDS: Record<string, string> = {
  topo: 'world-topo',
  satellite: 'world-satellite-hybrid',
};

const assetUrl = (name: string) =>
  new URL(`/src/assets/wodore-design/map/switch/${name}`, import.meta.url).href;

/** Map a legacy stored id to its catalog slug ('topo' → 'world-topo'). */
export function migrateBasemapId(id: string): string {
  return LEGACY_IDS[id] ?? id;
}

/** The style's BASE raster source, if Leaflet can serve it: the first
 *  layer referencing a source must name a `raster`-type source with a
 *  tiles array. Vector bases and background-only styles → undefined. */
export function firstRasterBase(
  style: StyleSpecification
): { tiles: string[]; maxzoom?: number; attribution?: string } | undefined {
  const sources = style.sources ?? {};
  for (const layer of style.layers ?? []) {
    const srcId = 'source' in layer ? layer.source : undefined;
    if (!srcId) continue; // background layers — look deeper for the base
    const src = sources[srcId] as
      | { type?: string; tiles?: string[]; maxzoom?: number; attribution?: string }
      | undefined;
    if (src?.type === 'raster' && Array.isArray(src.tiles) && src.tiles.length > 0) {
      return { tiles: src.tiles, maxzoom: src.maxzoom, attribution: src.attribution };
    }
    return undefined; // base exists but is not Leaflet-servable
  }
  return undefined;
}

/** Fold catalog attributions into the attribution HTML string. */
function attributionsHtml(layer: MapCatalogLayer, fallback: string): string {
  const parts = (layer.attributions ?? [])
    .map(a => {
      const text = a.attribution ?? a.name;
      if (!text) return null;
      return a.url ? `<a href="${a.url}" target="_blank" rel="noopener">${text}</a>` : text;
    })
    .filter((p): p is string => Boolean(p));
  return parts.length > 0 ? parts.join(' | ') : fallback;
}

/** Thumbnail for a slug — local assets for the known trio, the outdoor
 *  thumb as a generic until the backend serves `preview_url`. */
function thumbFor(slug: string): string {
  if (slug === 'world-topo') return assetUrl('swiss-raster.png');
  if (slug === 'world-satellite-hybrid') return assetUrl('satellite.png');
  return assetUrl('outdoor-v2.png');
}

/** Map a catalog layer to a Leaflet basemap, or undefined when its
 *  style is not raster-servable (vector base) / fails to load. */
async function layerToFbBasemap(layer: MapCatalogLayer): Promise<FbBasemap | undefined> {
  if (!layer.style_url) return undefined;
  try {
    const style = await fetchMapStyle(absolutizeStyleUrl(layer.style_url), layer.slug);
    const base = firstRasterBase(style);
    if (!base) return undefined;
    return {
      id: layer.slug,
      url: base.tiles[0]!,
      attribution: base.attribution ?? attributionsHtml(layer, ''),
      maxNativeZoom: base.maxzoom ?? 19,
      thumb: thumbFor(layer.slug),
      label: layer.name || undefined,
    };
  } catch {
    return undefined; // style unavailable — layer skipped
  }
}

/** Shared reactive list — one catalog fetch per session (fetchMapCatalog
 *  caches), so every fallback mount reuses the resolved entries. */
const basemapList = ref<FbBasemap[]>([]);
let catalogLoaded = false;

async function loadCatalogBasemaps(): Promise<void> {
  if (catalogLoaded) return;
  catalogLoaded = true; // one load attempt at a time
  try {
    const response = await fetchMapCatalog(undefined, undefined, 'basemap');
    const candidates = response.data.filter(
      l => l.show && l.style_url && !l.coverage_bbox // world-servable only
    );
    const resolved = await Promise.all(candidates.map(layerToFbBasemap));
    const entries = resolved.filter((b): b is FbBasemap => Boolean(b));
    if (entries.length > 0) {
      basemapList.value = entries;
    } else {
      // "Succeeded but nothing usable" (every style fetch failed /
      // non-raster) — same retry-on-next-mount as a thrown fetch, or
      // the empty list would pin forever and the reveal gate's
      // basemap term would never pass (review finding #1).
      catalogLoaded = false;
    }
  } catch {
    // Transient failure (fetchMapCatalog clears its own cache on throw,
    // map-catalog.ts:203) — allow the next mount to retry instead of
    // pinning an empty list for the whole session (Opus review #6).
    catalogLoaded = false;
  }
}

/** Single access point: the (initially empty) catalog-driven list.
 *  The caller watches the ref — MapLibre parity: nothing until served. */
export function useFallbackBasemaps(): Ref<FbBasemap[]> {
  void loadCatalogBasemaps();
  return basemapList;
}
