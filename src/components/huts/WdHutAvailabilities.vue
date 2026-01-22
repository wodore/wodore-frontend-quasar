<script setup lang="ts">
import { ref, computed, watchEffect, watch, nextTick } from 'vue';
import { date, QVirtualScroll, QScrollArea, useQuasar } from 'quasar';
import { useCssVar, useElementSize } from '@vueuse/core';
import { clientWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdHutAvailability from './WdHutAvailability.vue';

const { formatDate, addToDate, subtractFromDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const containerRef = ref<HTMLElement | null>(null);
const dialogRef = ref<HTMLElement | null>(null);
const { width: dialogWidth } = useElementSize(dialogRef);
const virtualScrollRef = ref<InstanceType<typeof QVirtualScroll> | null>(null);
const scrollAreaRef = ref<InstanceType<typeof QScrollArea> | null>(null);
const $q = useQuasar();
const scrollLeft = ref(0);
const scrollViewportWidth = ref(0);
const itemWidthVar = useCssVar('--availability-item-width', containerRef);
const itemWidth = computed(() => {
  const value = Number.parseFloat(itemWidthVar.value || '');
  return Number.isFinite(value) && value > 0 ? value : 100;
});

interface Props {
  slug: string;
  hasAvailability?: boolean;
  symbolMap?: Record<string, { simple: string; detailed: string }>;
}

const props = defineProps<Props>();
const isMobile = computed(() => $q.platform.is.mobile);

const getSymbolForDay = (hutType?: string) => {
  const map = props.symbolMap ?? {};
  const slug = hutType && map[hutType] ? hutType : 'unknown';
  const symbol = map[slug];
  if (!symbol) {
    return undefined;
  }
  const url = isMobile.value ? symbol.detailed : symbol.simple;
  return `img:${url}`;
};

interface AvailabilityDay {
  date: string;
  reservation_status: string;
  free: number;
  total: number;
  occupancy_percent: number;
  occupancy_steps: number;
  occupancy_status: 'empty' | 'low' | 'medium' | 'high' | 'full' | 'unknown';
  hut_type?: string;
  link: string;
  loading?: boolean;
}

// Complete array of all possible dates (fixed size)
const availabilityItems = ref<AvailabilityDay[]>([]);
const error = ref<string | undefined>(undefined);
const loadingRequests = ref<Set<string>>(new Set());

// Today's date
const today = computed<string>(() => formatDate(new Date(), 'YYYY-MM-DD'));
const todayDate = computed(() => new Date());

// Get start date (selected date or today)
const startDate = computed<string>(() => {
  if (selectedDate.value) {
    const parts = selectedDate.value.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = '20' + parts[2];
      return `${year}-${month}-${day}`;
    }
  }
  return formatDate(new Date(), 'YYYY-MM-DD');
});

const formatMonthLabel = (dateObj: Date) => {
  return dateObj.toLocaleDateString('de-CH', { month: 'short' }).toUpperCase();
};

const nextMonths = computed(() => {
  const months: {
    label: string;
    date: string;
    key: string;
    monthKey: string;
  }[] = [];
  const base = todayDate.value;
  let monthsAhead: number;

  // Use container width if available, otherwise default to reasonable values
  const width = dialogWidth.value || 0;

  if (width > 500) {
    monthsAhead = 10;
  } else if (width > 400) {
    monthsAhead = 8;
  } else if (width > 340) {
    monthsAhead = 6;
  } else if (width > 320) {
    monthsAhead = 4;
  } else {
    monthsAhead = 2;
  }

  for (let i = 0; i <= monthsAhead; i += 1) {
    const monthDate = addToDate(base, { months: i });
    months.push({
      label: formatMonthLabel(monthDate),
      date: formatDate(monthDate, 'YYYY-MM-01'),
      key: formatDate(monthDate, 'YYYY-MM'),
      monthKey: formatDate(monthDate, 'MM'),
    });
  }
  return months;
});

// Check if a date is today
const isToday = (dateStr: string): boolean => {
  return dateStr === today.value;
};

// Initialize the full date range (3 days before today to 8 months after today)
const initializeDateRange = () => {
  const items: AvailabilityDay[] = [];
  const threeDaysBeforeToday = subtractFromDate(new Date(today.value), {
    days: 3,
  });
  const oneYearFromToday = addToDate(new Date(today.value), { days: 365 });

  let currentDate = new Date(threeDaysBeforeToday);
  const endDate = new Date(oneYearFromToday);

  while (currentDate <= endDate) {
    const dateStr = formatDate(currentDate, 'YYYY-MM-DD');
    items.push({
      date: dateStr,
      reservation_status: 'loading',
      free: 0,
      total: 0,
      occupancy_percent: 0,
      occupancy_steps: 0,
      occupancy_status: 'empty',
      hut_type: '',
      link: '#',
      loading: true,
    });
    currentDate = addToDate(currentDate, { days: 1 });
  }

  console.log(
    'Initialized date range:',
    items.length,
    'days from',
    items[0].date,
    'to',
    items[items.length - 1].date,
  );
  return items;
};

// Load availability data for a date range and update items in-place
const loadAvailabilityDataForRange = async (
  startDateStr: string,
  days: number,
) => {
  if (!props.slug || props.hasAvailability === false) {
    return;
  }

  const requestKey = `${startDateStr}-${days}`;

  if (loadingRequests.value.has(requestKey)) {
    console.log('Already loading range:', requestKey);
    return;
  }

  console.log('Loading data for range:', requestKey);
  loadingRequests.value.add(requestKey);

  try {
    const { data, error: err } = await clientWodore.GET(
      '/v1/huts/{slug}/availability/{date}',
      {
        params: {
          path: {
            slug: props.slug,
            date: startDateStr,
          },
          query: {
            lang: 'de',
            days: days,
          },
        },
      },
    );

    if (err) {
      console.error('Availability fetch error:', err);
      error.value = 'Failed to load availability';
    } else if (data && 'data' in data && Array.isArray(data.data)) {
      console.log(
        'Successfully fetched data for range:',
        requestKey,
        'items:',
        data.data.length,
      );

      // Update items in-place in the array
      data.data.forEach((day) => {
        const index = availabilityItems.value.findIndex(
          (item) => item.date === day.date,
        );
        if (index >= 0) {
          availabilityItems.value[index] = { ...day, loading: false };
        }
      });
    }
  } finally {
    loadingRequests.value.delete(requestKey);
  }
};

// Check if items in a range need loading and load them
const ensureRangeLoaded = (startIndex: number, endIndex: number) => {
  if (availabilityItems.value.length === 0) return;

  // Extend range by 7 days on each side for preloading
  const preloadStart = Math.max(0, startIndex - 7);
  const preloadEnd = Math.min(availabilityItems.value.length - 1, endIndex + 7);

  // Find continuous ranges of loading items and batch load them
  let rangeStart = -1;

  for (let i = preloadStart; i <= preloadEnd; i++) {
    const item = availabilityItems.value[i];

    if (item.loading) {
      if (rangeStart === -1) {
        rangeStart = i;
      }
    } else {
      if (rangeStart !== -1) {
        // End of loading range, load it
        const startDate = availabilityItems.value[rangeStart].date;
        const days = i - rangeStart;
        if (days > 0) {
          loadAvailabilityDataForRange(startDate, days);
        }
        rangeStart = -1;
      }
    }
  }

  // Handle case where range extends to the end
  if (rangeStart !== -1) {
    const startDate = availabilityItems.value[rangeStart].date;
    const days = preloadEnd - rangeStart + 1;
    if (days > 0) {
      loadAvailabilityDataForRange(startDate, days);
    }
  }
};

// Handle virtual scroll events
const updateScrollMetrics = () => {
  if (!scrollAreaRef.value) {
    return;
  }
  scrollLeft.value = scrollAreaRef.value.getScrollPosition().left;
  const viewport = scrollAreaRef.value.$el?.querySelector('.scroll');
  if (viewport instanceof HTMLElement) {
    scrollViewportWidth.value = viewport.clientWidth;
  }
};

const onVirtualScroll = (details: {
  index: number;
  from: number;
  to: number;
}) => {
  console.log('Virtual scroll:', details);
  ensureRangeLoaded(details.from, details.to);
  updateScrollMetrics();
};

// Scroll to selected date
const scrollToSelectedDate = (animate: boolean) => {
  nextTick(() => {
    if (
      !virtualScrollRef.value ||
      !scrollAreaRef.value ||
      availabilityItems.value.length === 0
    ) {
      console.log('Cannot scroll - refs or availabilityItems not ready');
      return;
    }

    const index = availabilityItems.value.findIndex(
      (item) => item.date === startDate.value,
    );

    if (index >= 0) {
      console.log(
        'Scrolling to selected date:',
        startDate.value,
        'at index:',
        index,
      );
      const targetLeft = Math.max(0, index * itemWidth.value);
      scrollAreaRef.value.setScrollPosition(
        'horizontal',
        targetLeft,
        animate ? 300 : 0,
      );
    } else {
      console.log(
        'Selected date not found in availabilityItems:',
        startDate.value,
      );
    }
  });
};

const scrollToDate = (dateStr: string) => {
  nextTick(() => {
    if (
      !virtualScrollRef.value ||
      !scrollAreaRef.value ||
      availabilityItems.value.length === 0
    ) {
      return;
    }
    const index = availabilityItems.value.findIndex(
      (item) => item.date === dateStr,
    );
    if (index >= 0) {
      const targetLeft = Math.max(0, index * itemWidth.value);
      scrollAreaRef.value.setScrollPosition('horizontal', targetLeft, 300);
    }
  });
};

const scrollByMonths = (delta: number) => {
  if (!scrollAreaRef.value) {
    return;
  }
  const scrollInfo = scrollAreaRef.value.getScrollPosition();
  const targetLeft = Math.max(0, scrollInfo.left + delta * itemWidth.value);
  scrollAreaRef.value.setScrollPosition('horizontal', targetLeft, 300);
};

// Handle horizontal scroll with vertical mouse wheel (increased speed)
const onWheel = (evt: WheelEvent) => {
  if (scrollAreaRef.value) {
    evt.preventDefault();
    const scrollInfo = scrollAreaRef.value.getScrollPosition();
    // Multiply deltaY by 2 for faster scrolling
    scrollAreaRef.value.setScrollPosition(
      'horizontal',
      scrollInfo.left + evt.deltaY * 1.6,
      150,
    );
  }
};

// Initialize and load data when slug changes
const lastLoadedSlug = ref<string | undefined>(undefined);

watchEffect(() => {
  if (!props.slug || props.hasAvailability === false) {
    return;
  }

  if (lastLoadedSlug.value === props.slug) {
    return;
  }

  console.log('Slug changed to:', props.slug);
  lastLoadedSlug.value = props.slug;

  // Initialize the full date range
  availabilityItems.value = initializeDateRange();

  // Scroll to selected date
  scrollToSelectedDate(false);

  // Load initial data around selected date
  const selectedIndex = availabilityItems.value.findIndex(
    (item) => item.date === startDate.value,
  );
  if (selectedIndex >= 0) {
    ensureRangeLoaded(selectedIndex, selectedIndex);
  }
});

// Watch for selected date changes and scroll to the new date
watch(selectedDate, () => {
  console.log('Selected date changed to:', selectedDate.value);
  // Scroll to the newly selected date
  scrollToSelectedDate(true);
});

const monthStarts = computed(() => {
  const starts: { index: number; label: string; monthKey: string }[] = [];
  availabilityItems.value.forEach((item, index) => {
    if (index === 0) {
      const date = new Date(item.date);
      starts.push({
        index,
        label: date.toLocaleDateString('de-CH', {
          month: 'long',
          year: 'numeric',
        }),
        monthKey: String(date.getMonth() + 1).padStart(2, '0'),
      });
      return;
    }
    const prev = availabilityItems.value[index - 1];
    const prevDate = new Date(prev.date);
    const currDate = new Date(item.date);
    if (
      prevDate.getMonth() !== currDate.getMonth() ||
      prevDate.getFullYear() !== currDate.getFullYear()
    ) {
      starts.push({
        index,
        label: currDate.toLocaleDateString('de-CH', {
          month: 'long',
          year: 'numeric',
        }),
        monthKey: String(currDate.getMonth() + 1).padStart(2, '0'),
      });
    }
  });
  return starts;
});

const currentMonthIndex = computed(() => {
  const starts = monthStarts.value;
  if (starts.length === 0) {
    return null;
  }
  const current = starts
    .slice()
    .reverse()
    .find((start) => start.index * itemWidth.value <= scrollLeft.value);
  return current ?? starts[0];
});

const currentMonthLabel = computed(() => currentMonthIndex.value?.label ?? '');
const activeMonthKey = computed(() => {
  if (availabilityItems.value.length === 0) {
    return '';
  }
  const index = Math.min(
    availabilityItems.value.length - 1,
    Math.max(
      0,
      Math.floor((scrollLeft.value + itemWidth.value / 2) / itemWidth.value),
    ),
  );
  const dateStr = availabilityItems.value[index]?.date;
  return dateStr ? dateStr.slice(0, 7) : '';
});
const currentMonthClass = computed(() => {
  if (!currentMonthIndex.value) {
    return '';
  }
  return `month_${currentMonthIndex.value.monthKey}--gradient`;
});

const monthLabelOffset = computed(() => {
  const current = currentMonthIndex.value;
  if (!current) {
    return 0;
  }
  const upcoming = monthStarts.value.find(
    (start) => start.index > current.index,
  );
  if (upcoming) {
    const upcomingDistance =
      upcoming.index * itemWidth.value - scrollLeft.value;
    if (upcomingDistance <= itemWidth.value) {
      return Math.min(0, upcomingDistance - itemWidth.value);
    }
  }
  return 0;
});

const onScroll = () => {
  updateScrollMetrics();
};

const upcomingMonthLabel = computed(() => {
  const current = currentMonthIndex.value;
  if (!current) {
    return null;
  }
  return monthStarts.value.find((start) => start.index > current.index) ?? null;
});

const upcomingMonthOffset = computed(() => {
  const upcoming = upcomingMonthLabel.value;
  if (!upcoming) {
    return null;
  }
  const offset = upcoming.index * itemWidth.value - scrollLeft.value;
  return offset >= 0 && offset <= scrollViewportWidth.value ? offset : null;
});

const upcomingMonthClass = computed(() => {
  if (!upcomingMonthLabel.value) {
    return '';
  }
  return `month_${upcomingMonthLabel.value.monthKey}--gradient`;
});
</script>

<template>
  <div v-if="hasAvailability !== false" ref="dialogRef">
    <div class="row items-center no-wrap q-mb-xs q-mt-sm">
      <div class="text-subtitle1 text-accent">Verfügbarkeit</div>
      <!-- Month Selection -->
      <q-btn
        v-if="!isMobile"
        dense
        flat
        class="month-nav row"
        @click="scrollByMonths(-5)"
      >
        <q-icon size="sm">
          <IconEvaArrowIosBackOutline />
        </q-icon>
      </q-btn>
      <div class="month-selector row items-center no-wrap">
        <div
          v-for="(month, idx) in nextMonths"
          :key="month.date"
          class="month-chip-wrap"
          :class="[
            month.key === activeMonthKey
              ? `month_${month.monthKey}--gradient-dark`
              : `month_${month.monthKey}--gradient`,
            {
              'month-chip-wrap--first': idx === 0,
              'month-chip-wrap--last': idx === nextMonths.length - 1,
            },
          ]"
        >
          <q-btn
            dense
            unelevated
            class="month-chip"
            :style="{ fontSize: isMobile ? '9px' : '11px' }"
            @click="
              scrollToDate(month.key === today.slice(0, 7) ? today : month.date)
            "
          >
            {{ month.label }}
          </q-btn>
        </div>
      </div>
      <q-btn
        v-if="!isMobile"
        dense
        flat
        class="month-nav"
        @click="scrollByMonths(5)"
      >
        <q-icon size="sm">
          <IconEvaArrowIosForwardOutline />
        </q-icon>
      </q-btn>
    </div>
    <div ref="containerRef" class="availability-container">
      <div
        v-if="currentMonthLabel"
        class="month-label-overlay"
        :class="currentMonthClass"
        :style="{ transform: `translateX(${monthLabelOffset}px)` }"
      >
        {{ currentMonthLabel }}
      </div>
      <div
        v-if="upcomingMonthLabel && upcomingMonthOffset !== null"
        class="month-label-overlay"
        :class="upcomingMonthClass"
        :style="{ transform: `translateX(${upcomingMonthOffset}px)` }"
      >
        {{ upcomingMonthLabel.label }}
      </div>
      <div
        v-if="error && availabilityItems.length === 0"
        class="availability-content error-content"
      >
        <div class="text-caption text-negative">{{ error }}</div>
      </div>
      <q-scroll-area
        v-else
        ref="scrollAreaRef"
        id="availability-scroll-area"
        class="availability-scroll-area"
        :horizontal-thumb-style="{ height: isMobile ? '0px' : '5px' }"
        @scroll="onScroll"
        @wheel.prevent="onWheel"
      >
        <q-virtual-scroll
          ref="virtualScrollRef"
          scroll-target="#availability-scroll-area > .scroll"
          :items="availabilityItems"
          :virtual-scroll-item-size="itemWidth"
          virtual-scroll-horizontal
          virtual-scroll-slice-ratio-before="7"
          virtual-scroll-slice-ratio-after="14"
          @virtual-scroll="onVirtualScroll"
        >
          <template v-slot="{ item, index }">
            <div :key="index" class="day-item">
              <WdHutAvailability
                :day="item"
                :is-selected="item.date === startDate"
                :is-today="isToday(item.date)"
                :type-icon="getSymbolForDay(item.hut_type)"
              />
            </div>
          </template>
        </q-virtual-scroll>
      </q-scroll-area>
    </div>
  </div>
</template>

<style scoped>
.availability-container {
  position: relative;
  --availability-item-width: 78px;
  min-height: 100%;
  height: 100%;
}

.month-selector {
  margin-left: auto;
  overflow: hidden;
  border-radius: 8px;
  border: 1px solid rgba(0, 0, 0, 0.2);
}

.month-chip-wrap {
  padding: 0;
  border-radius: 0;
  display: inline-flex;
}

.month-chip-wrap--first {
  border-top-left-radius: 8px;
  border-bottom-left-radius: 8px;
}

.month-chip-wrap--last {
  border-top-right-radius: 8px;
  border-bottom-right-radius: 8px;
}

.month-chip {
  border-radius: 0;
  font-size: 10px;
  line-height: 1;
  padding: 1px 4px;
  min-height: 16px;
}

.month-nav {
  margin-left: auto;
  min-height: 16px;
  padding: 0 4px;
  color: rgba(0, 0, 0, 0.6);
}

.month-label-overlay {
  position: absolute;
  top: 0;
  left: 0;
  font-size: 11px;
  line-height: 1;
  padding: 4px 8px;
  border-radius: 999px;
  color: rgba(0, 0, 0, 0.65);
  text-transform: capitalize;
  pointer-events: none;
  z-index: 2;
}

.availability-scroll-area {
  height: 80px;
}

.availability-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 90px;
}

.error-content {
  text-align: center;
}

.day-item {
  width: var(--availability-item-width);
  height: 70px;
  display: inline-block;
  padding-top: 23px;
  box-sizing: border-box;
  padding-right: 4px;
}
</style>
