<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue';

import { useQuasar } from 'quasar';
import { useHutsStore } from '@stores/huts-store';
import { date } from 'quasar';
const { formatDate, addToDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const { removeBookings, fetchHutBookingsGeojson } = useHutsStore();
import { useRouter, useRoute, RouteLocationRaw } from 'vue-router';
import { storeToRefs } from 'pinia';
import track from '@services/analytics';

const $router = useRouter();
const $route = useRoute();
const $q = useQuasar();
//const selectedDate = ref<string | undefined>(
//  $route.query.date ? ($route.query.date as string) : undefined,
//);
const isMobile = computed(() => {
  return $q.screen.xs;
});
const showMenu = ref(false);
function dateRangeOptions(date: string) {
  const today = formatDate(Date.now(), 'YYYY/MM/DD');
  return date >= today;
}
function setNewDate(value: string) {
  //console.info('Clicked date:', value, reason, details);
  showMenu.value = false;
  let query = Object.assign({}, $route.query);
  query.date = value;
  let _new_route: RouteLocationRaw = {
    query: query,
    hash: $route.hash,
  };
  removeBookings();
  fetchHutBookingsGeojson({
    date: value,
    days: 4,
  });
  //console.info('Push Route', _new_route);
  $router.push(_new_route);
}

onMounted(() => {
  if (selectedDate.value === undefined) {
    selectedDate.value = $route.query.date
      ? ($route.query.date as string)
      : undefined;
  }
});

watch(
  selectedDate,
  (newDate, oldDate) => {
    if (newDate !== undefined && newDate != oldDate) {
      console.log(`Booking start date changed to '${newDate}'`);
      track('select-date', { date: newDate });
      setNewDate(newDate);
    }
  },
  { immediate: true },
);

function resetDate() {
  removeBookings();
  showMenu.value = false;
  let query = Object.assign({}, $route.query);
  selectedDate.value = undefined;
  delete query.date;
  let _new_route: RouteLocationRaw = {
    query: query,
  };
  $router.push(_new_route);
}
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}
</style>
<template>
  <div
    :class="{
      'q-ml-md': !isMobile,
      'q-ml-xs': isMobile,
    }"
    class="q-mr-md"
    style="max-width: 130px; max-height: 40px"
  >
    <!-- CALENDAR -->
    <q-popup-proxy
      no-parent-event
      :offset="[0, 4]"
      anchor="bottom start"
      target="#select-date-huts-location"
      v-model="showMenu"
      breakpoint="600"
      transition-show="jump-down"
      transition-hide="jump-up"
    >
      <div>
        <!-- @update:model-value="setNewDate" -->
        <q-date
          v-model="selectedDate"
          minimal
          :dark="!isMobile"
          :options="dateRangeOptions"
          first-day-of-week="1"
          :navigation-min-year-month="formatDate(Date.now(), 'YYYY/MM')"
          :navigation-max-year-month="
            formatDate(addToDate(Date.now(), { years: 2 }), 'YYYY/MM')
          "
          mask="DD.MM.YY"
        >
          <div class="row items-center justify-end">
            <q-btn label="Reset" color="secondary" flat @click="resetDate()" />
            <q-btn v-close-popup label="Close" color="primary" flat />
          </div>
        </q-date>
      </div>
    </q-popup-proxy>
    <!-- MOBILE - button -->
    <!-- <q-btn
      icon="fa-solid fa-calendar-days"
      @click="showMenu = true"
      flat
      round
      class="xs"
      dark>
      <q-badge
        v-if="selectedDate"
        color="green-8"
        floating
        transparent
        style="font-size: 7pt"
        >{{ selectedDate }}</q-badge
      >
    </q-btn> -->
    <!-- DESKTOP - textfiled -->
    <div id="select-date-huts-location">
      <!-- class="gt-xs" -->
      <q-input
        id="menu"
        readonly
        v-model="selectedDate"
        dense
        dark
        standout
        class="toolbar-font"
        @click="showMenu = true"
      >
        <!-- </q-input>:rules="[
          (v) => /^[0-3]\d\.[0-1]\d\.\d\d$/.test(v) || 'Format: dd.mm.yy',
        ]"
        -->
        <template v-slot:append>
          <q-icon
            @click="showMenu = true"
            name="wd-calendar"
            class="text-icon cursor-pointer"
            size="sm"
          >
          </q-icon>
        </template>
      </q-input>
    </div>
  </div>
</template>
