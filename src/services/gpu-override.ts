/**
 * URL GPU-tier override — `?gpuTier=<n>`, a sticky, shareable test/QA
 * knob (mirrors the `?debug=1` boot-param conventions: stays in the
 * URL, applies at boot, no persistence).
 *
 * Values (detect-gpu vocabulary, extended):
 *  - `-1`: force the NON-WebGL path — WdMapView mounts the Leaflet
 *    fallback regardless of actual WebGL support (the only way to test
 *    the fallback on a capable machine).
 *  - `0..3`: force the detect-gpu tier — `0`/`1` steer the catalog to
 *    the low/raster spec (weak-GPU path), `2`/`3` the high/vector one.
 *    Overrides the 2-day localStorage tier cache.
 *
 * Anything absent or out of range = no override (`null`).
 */

/** Tier value that forces the non-WebGL (Leaflet) fallback. */
export const GPU_TIER_FALLBACK = -1;

/** The URL search param name (`?gpuTier=…`). */
export const GPU_TIER_PARAM = 'gpuTier';

/** Parsed boot-time override: -1..3, or null when absent/invalid.
 *  Pure URL read — call once per boot, no side effects. */
export function forcedGpuTier(): number | null {
  if (typeof window === 'undefined') return null; // SSR — decide on client
  try {
    const raw = new URL(window.location.href).searchParams.get(GPU_TIER_PARAM);
    if (raw === null) return null;
    const tier = Number.parseInt(raw, 10);
    // SAFETY: parseInt('-1') is fine; NaN and out-of-range values are
    // silently ignored (a typo must never brick the map).
    if (!Number.isFinite(tier) || tier < GPU_TIER_FALLBACK || tier > 3) return null;
    return tier;
  } catch {
    return null;
  }
}

/**
 * The session's renderer capability profile (backend #440): `"subset"`
 * when this session renders with the Leaflet fallback map — the
 * `?gpuTier=-1` override or no WebGL context at all (the SAME probe
 * WdMapView uses to decide mounting WdFallbackMapView, deduped here)
 * — `undefined` for MapLibre sessions (they declare nothing and the
 * backend serves the default catalog).
 *
 * Synchronous ON PURPOSE: the map-catalog store keys its OVERLAY fetch
 * off this at boot (`profile=subset` — full-only rows never reach the
 * fallback), so the answer must exist before any await. MapLibre
 * sessions fetch the default catalog; the basemap stores keep the
 * default view too (world-satellite-hybrid has no subset variant — a
 * subset request would drop it from the fallback's basemap list;
 * fallback-basemaps' raster extraction already gates what renders).
 *
 * NOTE: the runtime error-fallback (MapLibre failing AFTER mounting)
 * does not flip this — that session already fetched the default
 * catalog; WdOverlayControl's client-side profile filter keeps its
 * menu sane (full-only rows hidden). Same for SSR: decide on client.
 */
export function rendererProfile(): 'subset' | undefined {
  if (typeof document === 'undefined') return undefined; // SSR — decide on client
  if (forcedGpuTier() === GPU_TIER_FALLBACK) return 'subset'; // URL override
  try {
    const canvas = document.createElement('canvas');
    const webgl = !!(
      canvas.getContext('webgl2') ||
      canvas.getContext('webgl') ||
      canvas.getContext('experimental-webgl')
    );
    return webgl ? undefined : 'subset';
  } catch {
    return 'subset';
  }
}
