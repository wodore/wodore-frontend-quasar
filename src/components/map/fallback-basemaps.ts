/**
 * FALLBACK BASEMAPS — the Leaflet fallback's raster basemap set.
 *
 * CATALOG-DRIVEN (was hardcoded in the POC): the list is seeded with a
 * guaranteed offline trio (OSM + the two world rasters on the tile
 * router), then asynchronously replaced by the same backend catalog the
 * MapLibre map consumes (`/v1/map/layers`, role=basemap) — filtered to
 * entries whose style's BASE (first sourced layer) is a raster source,
 * so only Leaflet-servable basemaps appear. New raster basemaps land in
 * the fallback without a frontend change.
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
 * IDs are stable slugs: 'osm' (hardcoded default, keyless, offline)
 * + catalog slugs ('world-topo', …). Legacy POC ids ('topo',
 * 'satellite') migrate on read. Labels: catalog entries carry the
 * localized backend name; OSM uses the app's i18n key. Thumbnails use
 * local assets until the backend serves `preview_url` (follow-up).
 */
import { ref, type Ref } from 'vue';
import { getEnv } from '@services/runtimeEnv';
import {
  fetchMapCatalog,
  fetchMapStyle,
  absolutizeStyleUrl,
  type MapCatalogLayer,
} from '@services/map-catalog';
import type { StyleSpecification } from 'maplibre-gl';

export interface FbBasemap {
  /** Stable slug — 'osm' or the catalog layer slug. */
  id: string;
  /** Raster tile URL template ({z}/{x}/{y}). */
  url: string;
  attribution: string;
  maxNativeZoom: number;
  thumb: string;
  /** Localized display name (catalog `name`); undefined = use the
   *  `map.fallbackBasemaps.${id}` i18n key (the hardcoded OSM entry). */
  label?: string;
}

/** Tile-router origin — shared by the basemaps, hut tiles, availability
 *  tiles and the sprite sheet. */
export const TILE_SERVER = getEnv('WODORE_TILE_SERVER_URL') ?? 'http://localhost:8075';

/** POC-era ids → catalog slugs (migrated on read, persisted back). */
const LEGACY_IDS: Record<string, string> = {
  topo: 'world-topo',
  satellite: 'world-satellite-hybrid',
};

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const TOPO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> | <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA) | swisstopo | geoland.at';
const SAT_ATTR = 'Esri, Maxar, Earthstar Geographics';

const assetUrl = (name: string) =>
  new URL(`/src/assets/wodore-design/map/switch/${name}`, import.meta.url).href;

/** Offline seed — same three entries as the POC, now under catalog
 *  slugs so the ids survive the async catalog swap. */
const SEED: FbBasemap[] = [
  {
    id: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('outdoor-v2.png'),
  },
  {
    id: 'world-topo',
    url: `${TILE_SERVER}/raster/tiles/world_topo/webmercator/{z}/{x}/{y}.webp`,
    attribution: TOPO_ATTR,
    maxNativeZoom: 16,
    thumb: assetUrl('swiss-raster.png'),
  },
  {
    id: 'world-satellite-hybrid',
    url: `${TILE_SERVER}/raster/tiles/world_satellite/webmercator/{z}/{x}/{y}.webp`,
    attribution: SAT_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('satellite.png'),
  },
];

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
  if (slug === 'osm') return assetUrl('outdoor-v2.png');
  return assetUrl('outdoor-v2.png');
}

/** Known-slug attribution fallbacks (catalog entries normally carry
 *  their own; these keep the seed parity when they don't). */
const SEED_ATTR: Record<string, string> = {
  'world-topo': TOPO_ATTR,
  'world-satellite-hybrid': SAT_ATTR,
};

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
      attribution: base.attribution ?? attributionsHtml(layer, SEED_ATTR[layer.slug] ?? OSM_ATTR),
      maxNativeZoom: base.maxzoom ?? 19,
      thumb: thumbFor(layer.slug),
      label: layer.name || undefined,
    };
  } catch {
    return undefined; // style unavailable — layer skipped, seed serves
  }
}

/** Shared reactive list — one catalog fetch per session (fetchMapCatalog
 *  caches), so every fallback mount reuses the resolved entries. */
const basemapList = ref<FbBasemap[]>(SEED);
let catalogLoaded = false;

async function loadCatalogBasemaps(): Promise<void> {
  if (catalogLoaded) return;
  catalogLoaded = true;
  try {
    const response = await fetchMapCatalog(undefined, undefined, 'basemap');
    const candidates = response.data.filter(
      l => l.show && l.style_url && !l.coverage_bbox // world-servable only
    );
    const resolved = await Promise.all(candidates.map(layerToFbBasemap));
    const entries = resolved.filter((b): b is FbBasemap => Boolean(b));
    if (entries.length > 0) {
      basemapList.value = [
        SEED[0]!, // OSM stays the hardcoded default
        ...entries.filter(b => b.id !== 'osm'),
      ];
    }
  } catch {
    /* catalog unavailable — the offline seed keeps serving */
  }
}

/** Single access point: the seeded list (sync) that upgrades to the
 *  catalog-driven list when it resolves. The caller watches the ref. */
export function useFallbackBasemaps(): Ref<FbBasemap[]> {
  void loadCatalogBasemaps();
  return basemapList;
}
