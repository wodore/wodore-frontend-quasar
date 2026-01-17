<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { date, QVirtualScroll, QScrollArea } from 'quasar';
import { clientWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdHutAvailability from './WdHutAvailability.vue';

const { formatDate, addToDate, subtractFromDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const virtualScrollRef = ref<InstanceType<typeof QVirtualScroll> | null>(null);
const scrollAreaRef = ref<InstanceType<typeof QScrollArea> | null>(null);

interface Props {
  slug: string;
  hasAvailability?: boolean;
}

const props = defineProps<Props>();

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

// Check if a date is today
const isToday = (dateStr: string): boolean => {
  return dateStr === today.value;
};

// Initialize the full date range (3 days before today to 8 months after today)
const initializeDateRange = () => {
  const items: AvailabilityDay[] = [];
  const threeDaysBeforeToday = subtractFromDate(new Date(today.value), { days: 3 });
  const eightMonthsFromToday = addToDate(new Date(today.value), { months: 8 });

  let currentDate = new Date(threeDaysBeforeToday);
  const endDate = new Date(eightMonthsFromToday);

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

  console.log('Initialized date range:', items.length, 'days from', items[0].date, 'to', items[items.length - 1].date);
  return items;
};

// Load availability data for a date range and update items in-place
const loadAvailabilityDataForRange = async (startDateStr: string, days: number) => {
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
    const { data, error: err } = await clientWodore.GET('/v1/huts/{slug}/availability/{date}', {
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
    });

    if (err) {
      console.error('Availability fetch error:', err);
      error.value = 'Failed to load availability';
    } else if (data && 'data' in data && Array.isArray(data.data)) {
      console.log('Successfully fetched data for range:', requestKey, 'items:', data.data.length);

      // Update items in-place in the array
      data.data.forEach((day) => {
        const index = availabilityItems.value.findIndex(item => item.date === day.date);
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
const onVirtualScroll = (details: { index: number; from: number; to: number }) => {
  console.log('Virtual scroll:', details);
  ensureRangeLoaded(details.from, details.to);
};

// Scroll to selected date
const scrollToSelectedDate = () => {
  if (!virtualScrollRef.value || availabilityItems.value.length === 0) return;

  const index = availabilityItems.value.findIndex(item => item.date === startDate.value);

  if (index >= 0) {
    console.log('Scrolling to selected date:', startDate.value, 'at index:', index);
    // Direct call like in Quasar example - scrollTo handles timing internally
    virtualScrollRef.value.scrollTo(index, 'start-force');
  }
};

// Handle horizontal scroll with vertical mouse wheel (increased speed)
const onWheel = (evt: WheelEvent) => {
  if (scrollAreaRef.value) {
    evt.preventDefault();
    const scrollInfo = scrollAreaRef.value.getScrollPosition();
    // Multiply deltaY by 2 for faster scrolling
    scrollAreaRef.value.setScrollPosition('horizontal', scrollInfo.left + (evt.deltaY * 1.6), 150);
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
  scrollToSelectedDate();

  // Load initial data around selected date
  const selectedIndex = availabilityItems.value.findIndex(item => item.date === startDate.value);
  if (selectedIndex >= 0) {
    ensureRangeLoaded(selectedIndex, selectedIndex);
  }
});
</script>

<template>
  <div v-if="hasAvailability !== false">
    <div class="text-subtitle1 text-accent q-mb-sm q-mt-md">Verfügbarkeit</div>
    <div class="availability-container">
      <div v-if="error && availabilityItems.length === 0" class="availability-content error-content">
        <div class="text-caption text-negative">{{ error }}</div>
      </div>
      <q-scroll-area v-else ref="scrollAreaRef" id="availability-scroll-area" class="availability-scroll-area"
        :horizontal-thumb-style="{ opacity: 0.5 }" @wheel.prevent="onWheel">
        <q-virtual-scroll ref="virtualScrollRef" scroll-target="#availability-scroll-area > .scroll"
          :items="availabilityItems" virtual-scroll-item-size="45" virtual-scroll-horizontal
          @virtual-scroll="onVirtualScroll">
          <template v-slot="{ item, index }">
            <div :key="index" class="day-item">
              <WdHutAvailability :day="item" :is-selected="item.date === startDate" :is-today="isToday(item.date)" />
            </div>
          </template>
        </q-virtual-scroll>
      </q-scroll-area>
    </div>
  </div>
</template>

<style scoped>
.availability-container {
  min-height: 140px;
  height: 140px;
}

.availability-scroll-area {
  height: 140px;
}

.availability-content {
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.error-content {
  text-align: center;
}

.day-item {
  width: 45px;
  height: 140px;
  display: inline-block;
}
</style>
