/**
 * Pure Web Mercator tile-math for the fallback map — lng/lat ↔ tile x/y
 * conversions at any zoom level. Framework-free, side-effect-free,
 * trivially unit-testable.
 *
 * Used by both the hut-tile and availability-tile loaders.
 */

/** Longitude → fractional tile X at the given zoom. */
export const lngToTileX = (lng: number, z: number): number =>
  ((lng + 180) / 360) * 2 ** z;

/** Latitude → fractional tile Y at the given zoom (Web Mercator). */
export const latToTileY = (lat: number, z: number): number => {
  const rad = (lat * Math.PI) / 180;
  return (((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * 2 ** z);
};

/** Fractional tile X → longitude at the given zoom. */
export const tileXToLng = (x: number, z: number): number => (x / 2 ** z) * 360 - 180;

/** Fractional tile Y → latitude at the given zoom. */
export const tileYToLat = (y: number, z: number): number => {
  const n = Math.PI - (2 * Math.PI * y) / 2 ** z;
  return (Math.atan(0.5 * (Math.exp(n) - Math.exp(-n))) * 180) / Math.PI;
};

/** Compute the tile range covering a padded viewport at a clamped tile zoom.
 *  Returns `{ x1, x2, y1, y2, tileZoom }` in INTEGER tile coordinates. */
export function viewportTileRange(
  bounds: { getWest(): number; getSouth(): number; getEast(): number; getNorth(): number },
  pad: number,
  mapZoom: number,
  minTileZoom: number,
  maxTileZoom: number
): { x1: number; x2: number; y1: number; y2: number; tileZoom: number } {
  const tileZoom = Math.min(maxTileZoom, Math.max(minTileZoom, Math.round(mapZoom)));
  return {
    tileZoom,
    x1: Math.floor(lngToTileX(bounds.getWest() - (bounds.getEast() - bounds.getWest()) * pad, tileZoom)),
    x2: Math.floor(lngToTileX(bounds.getEast() + (bounds.getEast() - bounds.getWest()) * pad, tileZoom)),
    y1: Math.floor(latToTileY(bounds.getNorth() + (bounds.getSouth() - bounds.getNorth()) * pad, tileZoom)),
    y2: Math.floor(latToTileY(bounds.getSouth() - (bounds.getSouth() - bounds.getNorth()) * pad, tileZoom)),
  };
}

/** Wrap a tile X coordinate into [0, 2^z). */
export const wrapTileX = (x: number, z: number): number =>
  ((x % 2 ** z) + 2 ** z) % 2 ** z;
