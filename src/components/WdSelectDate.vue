<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';

import { useQuasar, QDate, TouchSwipeValue } from 'quasar';
import { useHutsStore } from '@stores/huts-store';
// import { useAuthStore } from '@stores/auth-store';
import { date } from 'quasar';
const { formatDate, addToDate, extractDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const { removeBookings, fetchHutBookingsGeojson } = useHutsStore();
import { useRouter, useRoute, RouteLocationRaw } from 'vue-router';
import { storeToRefs } from 'pinia';
import track from '@services/analytics';
import enUS from 'quasar/lang/en-US.js'; // Adjust the path if necessary

const $router = useRouter();
const $route = useRoute();
const $q = useQuasar();
//const authStore = useAuthStore();
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
const selectedDateDisplay = computed(() => {
  if (selectedDateObj.value !== undefined && selectedDate.value) {
    if (!isMobile.value) {
      const dayShort = formatDate(selectedDateObj.value, 'dd');
      return `${selectedDate.value} • ${dayShort}`;
    }
    return selectedDate.value;
  }
  return selectedDate.value || '';
});
const isMobile = computed(() => {
  return $q.screen.xs;
});
const showMenu = ref(false);

// Allow selecting dates from 2 days before today
const minSelectableDate = computed(() => {
  return formatDate(addToDate(Date.now(), { days: -2 }), 'YYYY/MM/DD');
});

function dateRangeOptions(date: string) {
  return date >= minSelectableDate.value;
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
        date: formatDate(dateObj, 'DD.MM.YYYY', enUS.date),
        month: formatDate(dateObj, 'MMMM', enUS.date),
        day: formatDate(dateObj, 'dddd', enUS.date),
        monthDay: formatDate(dateObj, 'MMMM: dddd', enUS.date),
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

// Check if calendar should show error message
const showCalendarError = computed(() => {
  return false;
  // currently not used anymore
  //// Show calendar (no error) if bookings=1 parameter exists
  //if ($route.query.bookings === '1') {
  //  return false;
  //}
  //// Show calendar (no error) if user is logged in
  //if (authStore.isLoggedIn) {
  //  return false;
  //}

  //// Default: show error
  //return true;
});

// Arrow navigation functions
function incrementDate() {
  if (selectedDateObj.value === undefined) {
    // If no date selected, set to today
    selectedDate.value = formatDate(Date.now(), 'DD.MM.YY');
  } else {
    const newDate = addToDate(selectedDateObj.value, { days: 1 });
    selectedDate.value = formatDate(newDate, 'DD.MM.YY');
  }
}

function decrementDate() {
  if (selectedDateObj.value === undefined) {
    // If no date selected, set to today
    selectedDate.value = formatDate(Date.now(), 'DD.MM.YY');
  } else {
    const newDate = addToDate(selectedDateObj.value, { days: -1 });
    const newDateFormatted = formatDate(newDate, 'YYYY/MM/DD');

    // Don't allow going before minSelectableDate (2 days before today)
    if (newDateFormatted >= minSelectableDate.value) {
      selectedDate.value = formatDate(newDate, 'DD.MM.YY');
    }
  }
}

// Check if decrement is disabled (can't go before 2 days ago)
const decrementDisabled = computed(() => {
  if (selectedDateObj.value === undefined) {
    return false; // Allow setting to today
  }
  const currentDateFormatted = formatDate(selectedDateObj.value, 'YYYY/MM/DD');
  return currentDateFormatted <= minSelectableDate.value;
});

// Handle swipe gestures on date input
const handleDateInputSwipe: TouchSwipeValue = (e) => {
  e.evt?.preventDefault();
  e.evt?.stopPropagation();
  if (e.direction == 'right' && !decrementDisabled.value) {
    decrementDate();
  }
  if (e.direction == 'left') {
    incrementDate();
  }
};
</script>

<style scoped>
.toolbar-font {
  font-size: medium;
}

.no-text-transform {
  text-transform: none !important;
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
  <div :class="{
    'q-ml-md': !isMobile,
    'q-ml-xs': isMobile,
  }" class="q-mr-md" :style="isMobile
    ? 'max-width: 130px; max-height: 40px'
    : 'max-width: 210px; max-height: 40px'
    ">
    <!-- CALENDAR -->
    <q-popup-proxy :offset="[10, 1]" no-parent-event anchor="top start" target="#select-date-huts-location"
      v-model="showMenu" breakpoint="600" transition-show="jump-down" transition-hide="jump-up">
      <div>
        <!-- @update:model-value="setNewDate" -->
        <q-card class="dialog-radius bg-dark-500">
          <div class="q-ma-xs z-top text-icon" style="position: absolute; width: 32px; top: 6px; right: 6px">
            <q-btn dense round v-close-popup color="accent-700" icon="wd-close"></q-btn>
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
              <q-item-section v-if="!showCalendarError">
                <q-item-label class="text-h6 text-accent">{{
                  selectedDateDay
                  }}</q-item-label>
                <q-item-label class="text-body2 text-primary-100">{{
                  selectedDateLongName
                  }}</q-item-label>
              </q-item-section>
              <!-- ERROR MESSAGE HEADER -->
              <q-item-section v-else>
                <q-item-label class="text-h6 text-accent">
                  Im Moment nicht verfügbar
                </q-item-label>
              </q-item-section>
            </q-item>
          </q-list>
          <div :style="showCalendarError
            ? 'max-height: 430px; height: 430px; overflow: hidden'
            : 'max-height: 315px; height: 315px; overflow: hidden'
            " v-touch-swipe.mouse.horizontal="handleDateSwipe">
            <!-- ERROR MESSAGE CONTENT -->
            <div v-if="showCalendarError" style="height: 100%; display: flex; flex-direction: column">
              <img src="/images/no_bookings.jpg" alt="Sad mood"
                style="width: 370px; height: 180px; object-fit: cover" />
              <div class="q-pa-lg text-center" style="
                  flex: 1;
                  display: flex;
                  flex-direction: column;
                  align-items: center;
                  justify-content: center;
                ">
                <p class="text-h6 text-primary-100">
                  Ah Blöd, da geht nichts mehr!
                </p>
                <p class="text-body2 text-primary-200 q-mt-md">
                  Der SAC hat den Zugriff eingeschrenkt!<br />
                  Gerne
                  <a href="https://www.sac-cas.ch/de/kontakt/" target="_blank" class="text-accent">direkt nachhaken</a>.
                </p>
                <div class="q-mt-md q-pa-sm bg-dark-700 rounded-borders text-center"
                  style="border: 1px solid rgba(255, 193, 7, 0.3)">
                  <p class="text-body2 text-accent q-mb-none" style="font-weight: 500">
                    🔧 Eine neue Lösung ist in Arbeit...
                  </p>
                </div>
                <p class="text-caption text-primary-400 q-mt-md" style="font-size: 0.75rem">
                  Alternativ:
                  <a href="https://www.deine-berge.de/av_reservierung.php" target="_blank"
                    class="text-accent">deine-berge</a>
                  oder
                  <a href="https://www.hut-reservation.org" target="_blank" class="text-accent">hut-reservation</a>
                </p>
              </div>
            </div>
            <!-- CALENDAR -->
            <div v-else>
              <q-date :class="{ 'no-trans': noTrans }" v-model="selectedDate" minimal flat :dark="true"
                :options="dateRangeOptions" first-day-of-week="1"
                :navigation-min-year-month="formatDate(Date.now(), 'YYYY/MM')" :navigation-max-year-month="formatDate(addToDate(Date.now(), { years: 2 }), 'YYYY/MM')
                  " mask="DD.MM.YY" color="accent" ref="calLeft" @navigation="updateLeft">
              </q-date>
              <q-date :class="{ 'no-trans': noTrans }" v-model="selectedDate" v-if="$q.screen.gt.xs" minimal flat
                :dark="true" :options="dateRangeOptions" ref="calRigth" color="accent" first-day-of-week="1"
                :navigation-min-year-month="formatDate(addToDate(Date.now(), { month: 1 }), 'YYYY/MM')
                  " :navigation-max-year-month="formatDate(
                    addToDate(Date.now(), { years: 2, month: 1 }),
                    'YYYY/MM',
                  )
                    " mask="DD.MM.YY" @navigation="updateRigth">
              </q-date>
            </div>
          </div>
          <div class="q-pa-xs row items-center justify-center bg-dark-700">
            <!-- ERROR FOOTER -->
            <q-btn v-if="showCalendarError" v-close-popup label="Schade, dann halt nicht..." color="secondary" flat
              no-caps class="no-text-transform" />
            <!-- NORMAL FOOTER -->
            <template v-else>
              <q-btn flat :disable="todayDisabled" @click="gotoToday" class="q-mr-md text-accent"
                :class="{ 'text-dark-200': todayDisabled }">heute</q-btn>
              <q-btn label="Zurücksetzen" color="secondary" :disable="selectedDate === undefined" flat
                @click="resetDate()" />
            </template>
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
    <div class="row no-wrap items-start" style="gap: 4px">
      <div v-if="!isMobile" @click="decrementDate"
        class="q-field row no-wrap items-start q-field--standout q-field--dense q-field--dark q-field--readonly wd-input-button"
        :class="{ 'wd-input-button--disabled': decrementDisabled, 'cursor-pointer': !decrementDisabled }"
        style="width: 22px; min-width: 22px; max-width: 22px">
        <div class="q-field__inner relative-position col self-stretch">
          <div class="q-field__control relative-position row no-wrap">
            <div
              class="q-field__control-container col relative-position row items-center justify-center no-wrap q-anchor--skip">
              <q-icon size="sm" class="text-icon">
                <IconEvaArrowIosBackOutline />
              </q-icon>
            </div>
          </div>
        </div>
      </div>
      <div id="select-date-huts-location" style="flex: 1; position: relative">
        <!-- class="gt-xs" -->
        <q-input id="menu" readonly :model-value="selectedDateDisplay" dense dark standout class="toolbar-font"
          @click="showMenu = true">
          <!-- </q-input>:rules="[
            (v) => /^[0-3]\d\.[0-1]\d\.\d\d$/.test(v) || 'Format: dd.mm.yy',
          ]"
          -->
          <template v-slot:append>
            <q-icon @click="showMenu = true" name="wd-calendar" class="text-icon cursor-pointer" size="sm">
            </q-icon>
          </template>
        </q-input>
        <!-- Swipe overlay -->
        <div v-touch-swipe.mouse.horizontal="handleDateInputSwipe"
          style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; z-index: 1; pointer-events: auto"
          @click="showMenu = true">
        </div>
      </div>
      <div v-if="!isMobile" @click="incrementDate"
        class="q-field row no-wrap items-start q-field--standout q-field--dense q-field--dark q-field--readonly cursor-pointer wd-input-button"
        style="width: 22px; min-width: 22px; max-width: 22px">
        <div class="q-field__inner relative-position col self-stretch">
          <div class="q-field__control relative-position row no-wrap">
            <div
              class="q-field__control-container col relative-position row items-center justify-center no-wrap q-anchor--skip">
              <q-icon size="sm" class="text-icon">
                <IconEvaArrowIosForwardOutline />
              </q-icon>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
