/**
 * Sprite sheets shared between sprite ids.
 *
 * MapLibre admits ONE sprite id per URL (style-spec `validateSprite`: "all
 * the sprites' URLs must be unique") and `map.addSprite` validates the
 * whole array, then returns SILENTLY on a conflict — the new pack's images
 * never register. Two packs legitimately name the same sheet, though: the
 * backend composes PASSIVE presence packs into every wodore basemap
 * (backend #506), and the overlays draw from those very sheets —
 *
 *   transport        `wd-transport`          ‖ presence `wd-basemap-transport`
 *                                           ‖ …/sdf_sprite/transport
 *   huts             `wd-sdf`                ‖ presence + accommodations overlay
 *   accommodations   `wd-sdf-accommodations` ‖ `wd-sdf-accommodations`
 *                                           ‖ …/sdf_sprite/accommodation
 *
 * (observed live at Zurich HB z15.5 with both transport ids present: 42
 * `wd-basemap-transport:*` images, 0 `wd-transport:*` — the overlay's
 * icons did not draw). Evicting the holder is wrong whenever its layers
 * are visible — huts is active by default and would cost the accommodations
 * presence its sheet on every boot. So a pack whose sheet is already
 * loaded never loads again: its images are registered under the new id
 * as well — no second request, both ids resolve.
 *
 * Store-free and map-agnostic: the overlay control's addSprite guard is
 * the caller.
 */

import type { StyleImage, StyleImageMetadata, StyleImageSource } from 'maplibre-gl';

/** The map surface sharing needs (a MapLibre Map is structurally compatible). */
export interface SpriteShareMapLike {
  listImages(): string[];
  hasImage(id: string): boolean;
  getImage(id: string): StyleImage | undefined;
  addImage(id: string, image: StyleImageSource, options?: Partial<StyleImageMetadata>): void;
}

/** Registers every image of sprite `fromId`'s sheet under `toId` too.
 *  Returns whether the sheet is loaded (and now fully shared) — a sheet
 *  with no image registered yet has not finished loading. */
function shareLoadedSheet(map: SpriteShareMapLike, fromId: string, toId: string): boolean {
  const names = map.listImages().filter(name => name.startsWith(`${fromId}:`));
  if (names.length === 0) return false;
  for (const name of names) {
    const target = `${toId}:${name.slice(fromId.length + 1)}`;
    if (map.hasImage(target)) continue; // shared before — nothing new
    const image = map.getImage(name);
    if (image === undefined) continue;
    // Map.addImage takes the raw pixel block plus metadata: the holder's
    // pixels go under the new id with its sdf / pixel ratio / stretch —
    // an SDF glyph must stay an SDF glyph. (MapLibre copies the block
    // into its own image: the share is cheap, not zero-copy.)
    const { data, ...metadata } = image;
    map.addImage(target, data, metadata);
  }
  return true;
}

/**
 * Make sprite `toId` draw from the sheet sprite `fromId` already holds.
 * Resolves `true` once at least one image is registered under `toId` —
 * right away when the sheet is loaded, otherwise as soon as it is (the
 * shared backoff poll the overlay control uses for its own sprite waits:
 * this MapLibre version has no sprite-loaded event). `false` after
 * `timeoutMs` with nothing registered (the sheet failed to load — the
 * caller's fallbacks apply as for any missing sprite).
 */
export function shareSpriteImages(
  map: SpriteShareMapLike,
  fromId: string,
  toId: string,
  timeoutMs = 5000
): Promise<boolean> {
  if (shareLoadedSheet(map, fromId, toId)) return Promise.resolve(true);
  return new Promise(resolve => {
    const deadline = Date.now() + timeoutMs;
    let delay = 50;
    const check = () => {
      if (shareLoadedSheet(map, fromId, toId)) {
        resolve(true);
        return;
      }
      if (Date.now() >= deadline) {
        resolve(false);
        return;
      }
      delay = Math.min(delay * 2, 500);
      setTimeout(check, delay);
    };
    setTimeout(check, delay);
  });
}
