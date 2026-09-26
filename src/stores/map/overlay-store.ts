import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import { overlayFactories } from '@stores/map/utils/overlays';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';

export const useOverlayStore = defineStore('overlay', () => {
  function toggleOverlay(s: OverlaySwitchItem): boolean {
    s.active = s.active ? false : true;
    LocalStorage.set('overlays', overlays);
    return s.active;
  }
  const overlays = reactive<Array<OverlaySwitchItem>>(overlayFactories.map(factory => factory()));

  const savedOverlays: Array<OverlaySwitchItem> = LocalStorage.hasItem('overlays')
    ? (LocalStorage.getItem('overlays') as Array<OverlaySwitchItem>)
    : [];
  const savedOverlaysRecord = savedOverlays.reduce(
    (acc: Record<string, OverlaySwitchItem>, obj: OverlaySwitchItem) => {
      acc[obj.name] = obj;
      return acc;
    },
    {}
  );

  const applySavedOverlayState = () => {
    for (const o of overlays) {
      const name = o.name;
      if (name in savedOverlaysRecord) {
        o.active = savedOverlaysRecord[name].active;
        o.show = savedOverlaysRecord[name].show;
      }
    }
  };
  applySavedOverlayState();

  /**
   * Rebuild all overlays from their factories with the ACTIVE locale
   * (labels, legends, category names are resolved at build time) while
   * preserving the user's current active/show state. Called when the UI
   * language changes.
   */
  function rebuildOverlays(): void {
    // Factories are listed in the same order as the store array (1:1 — a
    // new overlay requires a page load until this gains an append path,
    // because pushing onto the reactive array trips TS2589 with the
    // maplibre-heavy OverlaySwitchItem type). In-place Object.assign keeps
    // the reactive item identity stable (references held by components stay
    // valid) and avoids the deep type instantiation of array spread/push.
    const rebuilt = overlayFactories.map(factory => factory());
    const count = Math.min(overlays.length, rebuilt.length);
    for (let i = 0; i < count; i++) {
      const { active, show } = overlays[i];
      Object.assign(overlays[i], rebuilt[i]);
      overlays[i].active = active;
      overlays[i].show = show;
    }
  }

  return {
    overlays,
    toggleOverlay,
    rebuildOverlays,
    //setBasemap,
    //getBasemap,
    //setEmitter,
  };
});
