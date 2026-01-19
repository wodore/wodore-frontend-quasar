import { defineStore } from 'pinia';
import { computed, ref } from 'vue';

// import {
//   //HutService,
//   //HutType,
//   HutFeatureCollection,
//   //Feature,
//   //BookingAvailbility,
//   BookingOccupation,
//   HutFeature,
// } from '../../clients/beta_v1';
// import {
//   HutService,
//   HutTypeSchema,
//   FeatureCollection,
//   Feature,
//   HutBookingsFeatureCollection,
//   //BookingAvailbility,
//   //BookingOccupation,
//   //HutFeature,
// } from '../../clients/wodore_v1';

import { Notify } from 'quasar';

//import { useStorage } from '@vueuse/core';
import { clientWodore, schemasWodore } from '@clients/index';
//import { useRoute } from 'vue-router';

// import  i18n  from 'src/boot/i18n';
// const t = i18n.global.t;
//const $route = useRoute();

export const useHutsStore = defineStore('huts', () => {
  // const emptyHutsGeojson: FeatureCollection = {
  //   type: 'FeatureCollection',
  //   features: [],
  // };
  //const emptyHutBookingsGeojson: schemasWodore['HutBookingsFeatureCollection'] =
  const emptyHutBookingsGeojson: schemasWodore['HutAvailabilityFeatureCollection'] =
  {
    type: 'FeatureCollection',
    features: [],
  };
  //const hutsGeojson = ref<FeatureCollection>(emptyHutsGeojson);
  //const bookingsGeojson = ref<schemasWodore['HutBookingsFeatureCollection']>(
  const bookingsGeojson = ref<
    schemasWodore['HutAvailabilityFeatureCollection']
  >(emptyHutBookingsGeojson);
  //const _hutsOccupationList = ref<Record<string, Array<BookingOccupation>>>({});
  //let _hutsGeojsonOrig: HutFeatureCollection = emptyHutsGeojson;
  //const _pendingOccupationUpdate = false;
  // interface fetchHutsGeojsonArgs {
  //   limit: number;
  //   includeRefs: boolean;
  // }
  // async function fetchHutsGeojson({
  //   limit = 5000,
  //   includeRefs = false,
  // }: fetchHutsGeojsonArgs) {
  //   /** Fetch from local storage if available, otherwise from server.
  //    * Update local storage afterwards.
  //    */
  //   const key = `huts-geojson-limit:${limit}-refs:${includeRefs}`;
  //   console.debug('Local storage geojson key:', key);
  //   const _hutsGeojsonLocal = useStorage<FeatureCollection>(
  //     key,
  //     emptyHutsGeojson,
  //   );
  //   // if (_hutsGeojsonLocal.value.features.length > 0) {
  //   //   hutsGeojson.value = _hutsGeojsonLocal.value;
  //   //   //_hutsGeojsonOrig = JSON.parse(JSON.stringify(_hutsGeojsonArgs.value));
  //   //   console.debug(
  //   //     `Update huts geojson from local storage (${key}):`,
  //   //     _hutsGeojsonLocal.value,
  //   //     hutsGeojson.value
  //   //   );
  //   // }

  //   HutService.getHutsGeojson({
  //     limit: limit,
  //     flat: true,
  //     embedType: true,
  //     includeName: true,
  //     embedAll: false,
  //     embedSources: includeRefs,
  //   }).then((res) => {
  //     //if (_hutsGeojsonArgs.value.features.length == 0) {
  //     //  hutsGeojson.value = res;
  //     //}
  //     console.debug(
  //       `Update huts geojson from server and add to local storage (${key}):`,
  //       res,
  //     );
  //     hutsGeojson.value = res;
  //     // `Update huts geojson local storage (${key})`;
  //     // _hutsGeojsonLocal.value = res;
  //   });
  // }
  interface fetchHutBookingsGeojsonArgs {
    date: string;
    days?: number;
  }
  async function fetchHutBookingsGeojson({
    date = 'now',
    days = 8,
  }: fetchHutBookingsGeojsonArgs) {
    clientWodore
      //.GET('/v1/huts/bookings.geojson', {
      .GET('/v1/huts/availability/{date}.geojson', {
        params: {
          path: {
            date: date,
          },
          query: {
            days: days,
          },
        },
      })
      .then(({ data }) => {
        if (data) {
          bookingsGeojson.value = data;
        }
      })
      .catch(() => {
        Notify.create({
          type: 'negative',
          position: 'bottom',
          //caption: t('booking_service_unavailable'),
          //message: t('error_caption'),
          caption: 'Reservations Service nicht erreichbar',
          message: 'Fehler',
          progress: true,
          timeout: 1800,
        });
      });
  }

  function removeBookings() {
    bookingsGeojson.value = emptyHutBookingsGeojson;
  }

  //const currentDate = ref(new Date());
  const selectedDate = ref<string | undefined>(undefined);

  const selectedDateOrToday = computed(() => {
    if (selectedDate.value !== undefined) {
      return selectedDate.value;
    }
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = String(now.getFullYear()).slice(-2);
    return `${day}.${month}.${year}`;
  });

  const selectedMonth = computed(() => {
    if (selectedDate.value !== undefined) {
      return selectedDate.value.split('.')[1];
    }
    return (new Date().getMonth() + 1).toString().padStart(2, '0');
  });
  //$route.query.date ? ($route.query.date as string) : undefined,
  //);
  return {
    //hutsGeojson,
    bookingsGeojson,
    //fetchHutsGeojson,
    fetchHutBookingsGeojson,
    removeBookings,
    selectedDate,
    selectedDateOrToday,
    selectedMonth,
  };
});

