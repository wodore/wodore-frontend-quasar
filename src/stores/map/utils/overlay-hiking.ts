/**
 * Global hiking routes overlay — Maptoolkit (mtk) vector tiles.
 *
 * Renders the OSM walking-route networks (iwn/nwn/rwn/lwn) WORLDWIDE in
 * the Swiss trail color code, with difficulty encoded in the line
 * grammar like the wd-outdoor-base-mtk basemap paths:
 *
 *   color (Swiss Wanderweg code)          dash (difficulty)
 *   ─────────────────────────────         ────────────────────────────
 *   yellow #fdc200  Wanderweg  T1         solid
 *   red    #ff0000  Bergwanderweg T2/T3   [3,2] / [2,2.5] dashed
 *   blue   #0000ff  Alpinwanderweg T4+    [1.5,3] dashed, T5/T6 +
 *                                           via ferrata dotted [0.1,2]
 *
 * Ways without sac_scale (routes along roads/tracks) default to the
 * easy tier — signed routes are walked, not climbed, unless tagged
 * otherwise. Trail names (italic) and route-number shields (yellow
 * lozenge, the Swiss trail marker) come from the road_label layer.
 *
 * The layer definitions live in overlay-hiking.json — pure MapLibre
 * style JSON, shared with the web preview (scripts/style/preview/
 * hiking.html) so app and preview cannot drift. Edit BOTH grammar
 * table (above) and the JSON together.
 *
 * The source is deliberately named `mtk`: when the wd-outdoor-base-mtk
 * basemap is active the overlay REUSES its already-loaded source (no
 * duplicate tile downloads); on other basemaps (e.g. the OpenFreeMap
 * fallback) the overlay adds the source itself and route tiles are
 * fetched independently.
 */
import { LayerSpecification, StyleSpecification, VectorSourceSpecification } from 'maplibre-gl';
import hikingLayers from './overlay-hiking.json';

/** Maptoolkit vector tiles — same endpoint the outdoor basemap uses
 * (Community License: attribution required, no bulk/proxy use). */
export const MTK_TILES_URL = 'https://tiles.maptoolkit.org/mtk.json';

export const HIKING_SOURCE = 'mtk';

const hikingSource: VectorSourceSpecification = {
  type: 'vector',
  url: MTK_TILES_URL,
  // mtk serves vector tiles up to z15; MapLibre overzooms beyond
  maxzoom: 15,
  attribution:
    '<a href="https://www.openstreetmap.org/copyright" target="_blank">© OpenStreetMap contributors</a> · <a href="https://www.maptoolkit.org" target="_blank">Maptoolkit</a>',
};

/** Layer ids of the hiking overlay (visibility toggling, tests). */
export const HIKING_LAYER_IDS: string[] = (hikingLayers as Array<{ id: string }>).map(l => l.id);

export const hikingStyle: StyleSpecification = {
  version: 8,
  name: 'hiking',
  sources: { [HIKING_SOURCE]: hikingSource },
  // Layer opacity is self-managed per layer (zoom + network fades in
  // the paint expressions) — no overlay-level opacity injection.
  // SAFETY: overlay-hiking.json is an array of plain MapLibre layer
  // objects (validated by tests/unit/overlay-hiking.spec.ts: ids,
  // sources, filters and paint shape) — the double assertion only
  // widens the inferred JSON literal type to LayerSpecification[]; no
  // runtime value changes hands.
  layers: hikingLayers as unknown as LayerSpecification[],
};
