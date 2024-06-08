import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import {
  huts,
  skislopes,
  skitouren,
  hillslope,
  protected_nature,
  hiking,
  snowshoes,
  mtb,
  cycling,
  public_transport_stops,
} from '@stores/map/utils/overlays';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
import { LocalStorage } from 'quasar';

export const useOverlayStore = defineStore('overlay', () => {
  function toggleOverlay(s: OverlaySwitchItem): boolean {
    s.active = s.active ? false : true;
    LocalStorage.set('overlays', overlays);
    return s.active;
  }
  const overlays = reactive<Array<OverlaySwitchItem>>([
    huts,
    public_transport_stops,
    hiking,
    mtb,
    cycling,
    protected_nature,
    hillslope,
    skitouren,
    snowshoes,
    skislopes,
  ]);

  const savedOverlays: Array<OverlaySwitchItem> = LocalStorage.hasItem(
    'overlays',
  )
    ? (LocalStorage.getItem('overlays') as Array<OverlaySwitchItem>)
    : [];
  const savedOverlaysRecord = savedOverlays.reduce(
    (acc: Record<string, OverlaySwitchItem>, obj: OverlaySwitchItem) => {
      acc[obj.name] = obj;
      return acc;
    },
    {},
  );

  for (const o of overlays) {
    const name = o.name;
    if (name in savedOverlaysRecord) {
      o.active = savedOverlaysRecord[name].active;
      o.show = savedOverlaysRecord[name].show;
    }
  }

  return {
    overlays,
    toggleOverlay,
    //setBasemap,
    //getBasemap,
    //setEmitter,
  };
});
