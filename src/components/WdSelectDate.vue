<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { useQuasar, QDate, TouchSwipeValue } from 'quasar';
import { useHutsStore } from '@stores/huts-store';
import { date } from 'quasar';
const { formatDate, addToDate, extractDate } = date;
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

const selectedDateObj = computed<Date | undefined>(() => {
  if (selectedDate.value !== undefined) {
    return extractDate(selectedDate.value, 'DD.MM.YY');
  }
  return undefined;
});

const selectedDateLongName = computed<string>(() => {
  if (selectedDateObj.value !== undefined) {
    return formatDate(selectedDateObj.value, 'D. MMMM YYYY');
  }
  return '';
});
const selectedDateDay = computed<string>(() => {
  if (selectedDateObj.value !== undefined) {
    return formatDate(selectedDateObj.value, 'dddd');
  }
  return 'Datum auswählen';
});
const isMobile = computed(() => {
  return $q.screen.xs;
});
const showMenu = ref(false);
function dateRangeOptions(date: string) {
  const today = formatDate(Date.now(), 'YYYY/MM/DD');
  return date >= today;
}

// hack, because the date always make a transition when i goes to the correct date
// since we use it to set it to the last position we dont want this transition the first time
const noTrans = ref(true);
watch(showMenu, (val) => {
  if (val == false) {
    noTrans.value = true; // do not use transition the next time
    return;
  }
  let usedDate: number | Date;
  let sel: MonthYear;
  if (leftValue.value !== undefined) {
    sel = leftValue.value;
  } else {
    if (selectedDateObj.value === undefined) {
      usedDate = Date.now();
    } else {
      usedDate = selectedDateObj.value;
    }
    sel = {
      year: parseInt(formatDate(usedDate, 'YYYY')),
      month: parseInt(formatDate(usedDate, 'M')),
    };
  }
  // disable the saved values, we set them again next
  rigthValue.value = undefined;
  leftValue.value = undefined;
  noTrans.value = true;
  nextTick(() => {
    // wait until everyhing is mounted
    if (calLeft.value !== null) {
      calLeft.value.setCalendarTo(sel.year, sel.month);
      updateLeft(sel); // this updates the right calendar
      setTimeout(() => {
        noTrans.value = false; // allow transitions again
      }, 500);
    }
  });
});

function setNewDate(value: string) {
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
      const dateObj = extractDate(newDate, 'DD.MM.YY');
      track('booking-date', {
        date: formatDate(dateObj, 'DD.MM.YYYY'),
        month: formatDate(dateObj, 'MMMM'),
        day: formatDate(dateObj, 'dddd'),
        monthDay: formatDate(dateObj, 'MMMM: dddd'),
      });
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

// sync the two calendars, the right needs to have a offset of 1 month
const calLeft = ref<InstanceType<typeof QDate> | null>(null);
const calRigth = ref<InstanceType<typeof QDate> | null>(null);
type MonthYear = { year: number; month: number };
let leftValue = ref<MonthYear | undefined>(undefined);
let rigthValue = ref<MonthYear | undefined>(undefined);
const updateLeft = function (e: MonthYear) {
  leftValue.value = e;
  let month: number = e.month;
  let year: number = e.year;
  month = month >= 12 ? 1 : month + 1;
  year = e.month >= 12 ? year + 1 : year;
  if (calRigth.value != null) {
    if (
      rigthValue.value === undefined ||
      rigthValue.value.month != month ||
      rigthValue.value.year != year
    ) {
      calRigth.value.setCalendarTo(year, month);
      rigthValue.value = { year: year, month: month };
    }
  } else {
    console.warn('Calendar right not ready!');
  }
};

const updateRigth = function (e: MonthYear) {
  rigthValue.value = e;
  let month: number = e.month;
  let year: number = e.year;
  month = month <= 1 ? 12 : month - 1;
  year = e.month <= 1 ? year - 1 : year;
  if (calLeft.value != null) {
    if (
      leftValue.value === undefined ||
      leftValue.value.month != month ||
      leftValue.value.year != year
    ) {
      calLeft.value.setCalendarTo(year, month);
      leftValue.value = { year: year, month: month };
    }
  } else {
    console.warn('Calendar left not ready!');
  }
};

// do the TODAY button disable
const todayDisabled = computed(() => {
  if (leftValue.value !== undefined) {
    return (
      parseInt(formatDate(Date.now(), 'M')) == leftValue.value.month &&
      parseInt(formatDate(Date.now(), 'YYYY')) == leftValue.value.year
    );
  }
  return true;
});
const gotoToday = function () {
  if (calLeft.value !== undefined) {
    const year = parseInt(formatDate(Date.now(), 'YYYY'));
    const month = parseInt(formatDate(Date.now(), 'M'));
    if (calLeft.value != null) {
      calLeft.value.setCalendarTo(year, month);
    }
  }
};

const handleDateSwipe: TouchSwipeValue = (e) => {
  e.evt?.preventDefault();
  // if ($q.platform.is.mobile && calRigth.value !== null) {
  if (e.direction == 'right') {
    calRigth.value?.offsetCalendar('month', true);
  }
  if (e.direction == 'left') {
    calRigth.value?.offsetCalendar('month', false);
  }
  // }
};
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}
</style>
<style lang="scss">
.no-trans .q-transition {
  &--slide-right,
  &--slide-left,
  &--jump-right,
  &--jump-left {
    &-enter-active,
    &-leave-active {
      --q-transition-duration: 0s;
    }
  }
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
      :offset="[10, 1]"
      no-parent-event
      anchor="top start"
      target="#select-date-huts-location"
      v-model="showMenu"
      breakpoint="600"
      transition-show="jump-down"
      transition-hide="jump-up"
    >
      <div>
        <!-- @update:model-value="setNewDate" -->
        <q-card class="dialog-radius bg-dark-500">
          <div
            class="q-ma-xs z-top text-icon"
            style="position: absolute; width: 32px; top: 6px; right: 6px"
          >
            <q-btn
              dense
              round
              v-close-popup
              color="accent-700"
              icon="wd-close"
            ></q-btn>
          </div>
          <!-- HEADER -->
          <q-list padding class="bg-dark-700">
            <q-item>
              <!-- <q-item-section avatar>
                <q-avatar size="56px">
                  <img :src="authStore.avatar" />
                </q-avatar>
              </q-item-section> -->
              <!-- NAME - EMAIL -->
              <q-item-section>
                <q-item-label class="text-h6 text-accent">{{
                  selectedDateDay
                }}</q-item-label>
                <q-item-label class="text-body2 text-primary-100">{{
                  selectedDateLongName
                }}</q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div
            style="max-height: 315px; height: 315px; overflow: hidden"
            v-touch-swipe.mouse.horizontal="handleDateSwipe"
          >
            <!-- <div> -->
            <q-date
              :class="{ 'no-trans': noTrans }"
              v-model="selectedDate"
              minimal
              flat
              :dark="true"
              :options="dateRangeOptions"
              first-day-of-week="1"
              :navigation-min-year-month="formatDate(Date.now(), 'YYYY/MM')"
              :navigation-max-year-month="
                formatDate(addToDate(Date.now(), { years: 2 }), 'YYYY/MM')
              "
              mask="DD.MM.YY"
              color="accent"
              ref="calLeft"
              @navigation="updateLeft"
            >
            </q-date>
            <q-date
              :class="{ 'no-trans': noTrans }"
              v-model="selectedDate"
              v-if="$q.screen.gt.xs"
              minimal
              flat
              :dark="true"
              :options="dateRangeOptions"
              ref="calRigth"
              color="accent"
              first-day-of-week="1"
              :navigation-min-year-month="
                formatDate(addToDate(Date.now(), { month: 1 }), 'YYYY/MM')
              "
              :navigation-max-year-month="
                formatDate(
                  addToDate(Date.now(), { years: 2, month: 1 }),
                  'YYYY/MM',
                )
              "
              mask="DD.MM.YY"
              @navigation="updateRigth"
            >
            </q-date>
          </div>
          <div class="q-pa-xs row items-center justify-center bg-dark-700">
            <q-btn
              flat
              :disable="todayDisabled"
              @click="gotoToday"
              class="q-mr-md text-accent"
              :class="{ 'text-dark-200': todayDisabled }"
              >heute</q-btn
            >
            <q-btn
              label="Zurücksetzen"
              color="secondary"
              :disable="selectedDate === undefined"
              flat
              @click="resetDate()"
            />
            <!-- <q-btn v-close-popup label="Schliessen" color="primary" flat /> -->
          </div>
        </q-card>
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
