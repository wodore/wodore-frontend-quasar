/**
 * FALLBACK BASEMAPS — the Leaflet fallback's raster basemap set.
 *
 * ⚠️ FOLLOW-UP (owner, tracked): these are HARDCODED for the POC. The
 * proper source is the backend map-layer catalog (`/v1/map/layers`,
 * role=basemap) — the same registry the MapLibre map consumes — filtered
 * to raster-servable entries (world-topo / world-satellite facades, OSM).
 *
 * The code is PREPARED for that swap:
 * - `FbBasemap` mirrors the catalog shape (id ↔ slug, url ↔ style tiles,
 *   attribution ↔ attributions, preview ↔ preview_url) — a mapper from
 *   MapCatalogLayer → FbBasemap slots in here without touching
 *   WdFallbackMapView (it only consumes this list).
 * - `useFallbackBasemaps()` is the single access point; replace its
 *   body with a catalog fetch + mapping when the backend serves the
 *   fallback-ready basemap entries.
 */
import { getEnv } from '@services/runtimeEnv';

export interface FbBasemap {
  id: 'osm' | 'topo' | 'satellite';
  /** Raster tile URL template ({z}/{x}/{y}). */
  url: string;
  attribution: string;
  maxNativeZoom: number;
  thumb: string;
}

/** Tile-router origin — shared by the basemaps, hut tiles, availability
 *  tiles and the sprite sheet. */
export const TILE_SERVER = getEnv('WODORE_TILE_SERVER_URL') ?? 'http://localhost:8075';

const OSM_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors';
const TOPO_ATTR =
  '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> | <a href="https://opentopomap.org" target="_blank" rel="noopener">OpenTopoMap</a> (CC-BY-SA) | swisstopo | geoland.at';
const SAT_ATTR = 'Esri, Maxar, Earthstar Geographics';

const assetUrl = (name: string) =>
  new URL(`/src/assets/wodore-design/map/switch/${name}`, import.meta.url).href;

const BASEMAPS: FbBasemap[] = [
  {
    id: 'osm',
    url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: OSM_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('outdoor-v2.png'),
  },
  {
    id: 'topo',
    // mapproxy world_topo facade behind the tile-router (OpenTopoMap +
    // geoland.at + swisstopo merged, cached WebP)
    url: `${TILE_SERVER}/raster/tiles/world_topo/webmercator/{z}/{x}/{y}.webp`,
    attribution: TOPO_ATTR,
    maxNativeZoom: 16,
    thumb: assetUrl('swiss-raster.png'),
  },
  {
    id: 'satellite',
    url: `${TILE_SERVER}/raster/tiles/world_satellite/webmercator/{z}/{x}/{y}.webp`,
    attribution: SAT_ATTR,
    maxNativeZoom: 19,
    thumb: assetUrl('satellite.png'),
  },
];

/** Single access point — swap for a catalog fetch in the follow-up. */
export function useFallbackBasemaps(): FbBasemap[] {
  return BASEMAPS;
}
