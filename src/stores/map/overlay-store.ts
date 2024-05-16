import { defineStore } from 'pinia';
import { reactive } from 'vue';
import { OverlaySwitchItem } from '@stores/map/utils/interfaces';
import {
  skislopes,
  skitouren,
  hillslope,
  hiking,
  snowshoes,
  mtb,
  cycling,
  public_transport_stops,
} from '@stores/map/utils/overlays';
//import { useMap } from '@indoorequal/vue-maplibre-gl';
//import type { Emitter } from 'mitt';
//import { LocalStorage } from 'quasar';

export const useOverlayStore = defineStore('overlay', () => {
  function toggleOverlay(s: OverlaySwitchItem): boolean {
    s.active = s.active ? false : true;
    return s.active;
  }
  const overlays = reactive<Array<OverlaySwitchItem>>([
    public_transport_stops,
    skitouren,
    snowshoes,
    hillslope,
    skislopes,
    hiking,
    mtb,
    cycling,
  ]);

  return {
    overlays,
    toggleOverlay,
    //setBasemap,
    //getBasemap,
    //setEmitter,
  };
});
