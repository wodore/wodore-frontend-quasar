<script setup lang="ts">
import { ref, computed, watchEffect, watch } from 'vue';
import { date, QScrollArea } from 'quasar';
import { clientWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import { useDebounceFn } from '@vueuse/core';
import WdHutAvailability from './WdHutAvailability.vue';

const { formatDate, addToDate, subtractFromDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const scrollAreaRef = ref<QScrollArea | null>(null);

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
  hut_type: string;
  link: string;
  loading?: boolean; // Added for skeleton state
}

// Map to store all availability data by date
const availabilityMap = ref<Map<string, AvailabilityDay>>(new Map());
const error = ref<string | undefined>(undefined);
const loadingRequests = ref<Set<string>>(new Set()); // Track ongoing requests
const loadedRanges = ref<Set<string>>(new Set()); // Track which date ranges have been loaded

// Get start date (selected date or today)
const startDate = computed<string>(() => {
  if (selectedDate.value) {
    // Convert from DD.MM.YY to YYYY-MM-DD
    const parts = selectedDate.value.split('.');
    if (parts.length === 3) {
      const day = parts[0].padStart(2, '0');
      const month = parts[1].padStart(2, '0');
      const year = '20' + parts[2]; // Assuming 20XX
      return `${year}-${month}-${day}`;
    }
  }
  // Default to today
  return formatDate(new Date(), 'YYYY-MM-DD');
});

// Today's date for min boundary check
const today = computed<string>(() => formatDate(new Date(), 'YYYY-MM-DD'));

// Check if a date is today
const isToday = (dateStr: string): boolean => {
  return dateStr === today.value;
};

// Computed sorted array of all dates
const sortedDates = computed(() => {
  const dates = Array.from(availabilityMap.value.keys()).sort();
  return dates.map(d => availabilityMap.value.get(d)!);
});



// Generate skeleton days for a date range
const generateSkeletonDays = (startDateStr: string, days: number): AvailabilityDay[] => {
  const skeletons: AvailabilityDay[] = [];
  let currentDate = new Date(startDateStr);

  for (let i = 0; i < days; i++) {
    const dateStr = formatDate(currentDate, 'YYYY-MM-DD');
    skeletons.push({
      date: dateStr,
      reservation_status: 'loading',
      free: 0,
      total: 0,
      occupancy_percent: 0, // 0% for skeleton (no bar)
      occupancy_steps: 0,
      occupancy_status: 'empty',
      hut_type: '',
      link: '#',
      loading: true,
    });
    currentDate = addToDate(currentDate, { days: 1 });
  }

  return skeletons;
};

// Add skeleton days immediately
const addSkeletonsImmediately = (startDateStr: string, days: number) => {
  const skeletons = generateSkeletonDays(startDateStr, days);
  const newMap = new Map(availabilityMap.value);
  skeletons.forEach(skeleton => {
    if (!newMap.has(skeleton.date)) {
      newMap.set(skeleton.date, skeleton);
    }
  });
  availabilityMap.value = newMap;
  console.log('Added skeleton days:', startDateStr, 'count:', days);
};

// Load availability data for a specific date range
const loadAvailabilityData = async (startDateStr: string, days: number) => {
  if (!props.slug || props.hasAvailability === false) {
    console.log('loadAvailabilityData: No slug or hasAvailability is false');
    return;
  }

  // Check if already loading this range
  const requestKey = `${startDateStr}-${days}`;
  
  console.log('loadAvailabilityData called:', { 
    requestKey, 
    alreadyLoading: loadingRequests.value.has(requestKey),
    alreadyLoadedBefore: loadedRanges.value.has(requestKey),
    loadingRequestsSize: loadingRequests.value.size,
    loadedRangesSize: loadedRanges.value.size
  });
  
  if (loadingRequests.value.has(requestKey)) {
    console.log('Already loading this range, skipping');
    return;
  }

  // Check if this range has already been loaded
  if (loadedRanges.value.has(requestKey)) {
    console.log('Range already loaded previously, skipping');
    return;
  }

  // Check if all dates in this range already exist in the map (with real data, not skeletons)
  const allDatesExist = (() => {
    let currentDate = new Date(startDateStr);
    for (let i = 0; i < days; i++) {
      const dateStr = formatDate(currentDate, 'YYYY-MM-DD');
      const existingDay = availabilityMap.value.get(dateStr);
      // If date doesn't exist or is still loading, we need to load
      if (!existingDay || existingDay.loading) {
        console.log('Date missing or loading:', dateStr, existingDay);
        return false;
      }
      currentDate = addToDate(currentDate, { days: 1 });
    }
    return true;
  })();

  if (allDatesExist) {
    console.log('All dates in range already exist with real data, marking as loaded and skipping');
    loadedRanges.value.add(requestKey);
    return;
  }

  console.log('Starting to load data for range:', requestKey);
  loadingRequests.value.add(requestKey);
  error.value = undefined;

  // Add skeleton days immediately to show loading state
  addSkeletonsImmediately(startDateStr, days);
  
  // Scroll to selected date immediately after skeleton is added (for initial load only)
  if (loadedRanges.value.size === 0) {
    setTimeout(() => {
      scrollToSelectedDate(true);
      // Allow scroll events after a short delay to prevent immediate preloading
      setTimeout(() => {
        isInitialLoad.value = false;
        console.log('Initial load complete, scroll events now enabled');
      }, 500);
    }, 50);
  }

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
      // Replace skeleton/loading data with real data
      // Create a new Map to trigger reactivity
      const newMap = new Map(availabilityMap.value);
      data.data.forEach((day) => {
        newMap.set(day.date, { ...day, loading: false });
      });
      availabilityMap.value = newMap;
      
      // Mark this range as loaded
      loadedRanges.value.add(requestKey);
      console.log('Marked range as loaded:', requestKey, 'Total loaded ranges:', loadedRanges.value.size);
    }
  } finally {
    loadingRequests.value.delete(requestKey);
    console.log('Removed from loading requests:', requestKey);
  }
};

// Load next 14 days (forward)
const loadNext = () => {
  const dates = Array.from(availabilityMap.value.keys()).sort();
  console.log('loadNext called, current dates:', dates.length);
  if (dates.length === 0) {
    console.log('No dates yet, skipping loadNext');
    return;
  }

  const lastDate = dates[dates.length - 1];
  const nextDate = formatDate(addToDate(new Date(lastDate), { days: 1 }), 'YYYY-MM-DD');
  console.log('Loading next from:', nextDate);
  loadAvailabilityData(nextDate, 14);
};

// Load previous 14 days (backward, but not earlier than 2 days before today)
const loadPrevious = async () => {
  const dates = Array.from(availabilityMap.value.keys()).sort();
  if (dates.length === 0) return;

  const firstDate = dates[0];
  const twoDaysBeforeToday = formatDate(subtractFromDate(new Date(today.value), { days: 2 }), 'YYYY-MM-DD');

  // Don't load if we're already at or before the minimum date
  if (firstDate <= twoDaysBeforeToday) {
    return;
  }

  // Calculate how many days we can load backward
  const targetStartDate = formatDate(subtractFromDate(new Date(firstDate), { days: 14 }), 'YYYY-MM-DD');
  const actualStartDate = targetStartDate < twoDaysBeforeToday ? twoDaysBeforeToday : targetStartDate;
  const daysToLoad = Math.ceil((new Date(firstDate).getTime() - new Date(actualStartDate).getTime()) / (1000 * 60 * 60 * 24));

  if (daysToLoad > 0) {
    // Save current scroll position before loading
    const currentScrollPos = scrollAreaRef.value?.getScrollPosition().left || 0;
    console.log('Before loading previous - scroll position:', currentScrollPos, 'days to prepend:', daysToLoad);
    
    // Load the data
    await loadAvailabilityData(actualStartDate, daysToLoad);
    
    // Adjust scroll position after new data is prepended
    // Each day is 45px wide, so we need to shift by (daysToLoad * 45)
    setTimeout(() => {
      const newScrollPos = currentScrollPos + (daysToLoad * 45);
      console.log('After loading previous - adjusting scroll from', currentScrollPos, 'to', newScrollPos);
      scrollAreaRef.value?.setScrollPosition('horizontal', newScrollPos, 0);
    }, 50);
  }
};

// Track if we're in initial load to prevent premature scroll loading
const isInitialLoad = ref(true);

// Handle scroll and check if we need to load more
const onScroll = useDebounceFn((info: {
  horizontalPosition: number;
  horizontalSize: number;
  horizontalContainerSize: number;
}) => {
  if (!scrollAreaRef.value) return;
  
  // Don't trigger loading during initial setup
  if (isInitialLoad.value) {
    console.log('Skipping scroll event during initial load');
    return;
  }

  const currentScroll = info.horizontalPosition;
  const scrollWidth = info.horizontalSize;
  const containerWidth = info.horizontalContainerSize;

  console.log('Scroll event:', { currentScroll, scrollWidth, containerWidth, itemCount: sortedDates.value.length });

  // Width of 7 days (7 * 45px) - reduced trigger distance
  const sevenDaysWidth = 7 * 45;

  // Check if we're within 7 days of the end
  const distanceFromEnd = scrollWidth - currentScroll - containerWidth;
  console.log('Distance from end:', distanceFromEnd);
  if (distanceFromEnd < sevenDaysWidth) {
    console.log('Loading next...');
    loadNext();
  }

  // Check if we're within 7 days of the beginning
  console.log('Distance from start:', currentScroll);
  if (currentScroll < sevenDaysWidth) {
    console.log('Loading previous...');
    loadPrevious();
  }
}, 300); // Increased debounce to reduce triggers

// Handle horizontal scroll with vertical mouse wheel
const onWheel = (evt: WheelEvent) => {
  if (scrollAreaRef.value) {
    evt.preventDefault();
    const scrollInfo = scrollAreaRef.value.getScrollPosition();
    scrollAreaRef.value.setScrollPosition('horizontal', scrollInfo.left + evt.deltaY, 150);
  }
};

// Scroll to selected date
const scrollToSelectedDate = (immediate = false) => {
  if (!scrollAreaRef.value) return;

  const dates = Array.from(availabilityMap.value.keys()).sort();
  const selectedIndex = dates.findIndex(d => d === startDate.value);
  
  if (selectedIndex >= 0) {
    // Each day is 45px wide
    // Position selected date at the beginning (left edge) of viewport
    const scrollPosition = selectedIndex * 45;
    
    console.log('Scrolling to selected date:', {
      date: startDate.value,
      index: selectedIndex,
      position: scrollPosition,
      immediate
    });
    
    // For initial load, scroll immediately without animation
    // For date changes, use smooth animation
    const duration = immediate ? 0 : 300;
    
    setTimeout(() => {
      scrollAreaRef.value?.setScrollPosition('horizontal', scrollPosition, duration);
    }, immediate ? 0 : 100);
  }
};

// Initial load - only trigger when slug changes, not on every reactive update
const lastLoadedSlug = ref<string | undefined>(undefined);

watchEffect(() => {
  if (!props.slug || props.hasAvailability === false) {
    return;
  }

  // Only reload if the slug actually changed
  if (lastLoadedSlug.value === props.slug) {
    console.log('Slug unchanged, skipping reload');
    return;
  }

  console.log('Slug changed from', lastLoadedSlug.value, 'to', props.slug, '- clearing and reloading');
  lastLoadedSlug.value = props.slug;

  // Clear existing data
  availabilityMap.value.clear();
  loadingRequests.value.clear();
  loadedRanges.value.clear();
  isInitialLoad.value = true; // Reset initial load flag

  // Calculate start date: load 3 days before selected date for context
  const twoDaysBeforeToday = formatDate(subtractFromDate(new Date(today.value), { days: 2 }), 'YYYY-MM-DD');
  const threeDaysBeforeSelected = formatDate(subtractFromDate(new Date(startDate.value), { days: 3 }), 'YYYY-MM-DD');
  const actualStartDate = threeDaysBeforeSelected < twoDaysBeforeToday ? twoDaysBeforeToday : threeDaysBeforeSelected;
  
  // Load 30 days total (includes 3 before + selected + 26 after)
  // This gives good buffer (30 days * 45px = 1350px, typical viewport is 300-400px)
  const daysToLoad = 30;
  
  console.log('Initial load:', { actualStartDate, daysToLoad, startDate: startDate.value, today: today.value });
  
  // Load initial range: 30 days starting from 3 days before selected date
  loadAvailabilityData(actualStartDate, daysToLoad);
});

// Watch for selected date changes and scroll to it
watch(selectedDate, (newDate, oldDate) => {
  if (newDate && newDate !== oldDate && availabilityMap.value.size > 0) {
    console.log('Selected date changed from', oldDate, 'to', newDate);
    scrollToSelectedDate();
  }
});
</script>

<template>
  <div v-if="hasAvailability !== false">
    <div class="text-subtitle1 text-accent q-mb-sm q-mt-md">Verfügbarkeit</div>
    <div class="availability-container">
      <div v-if="error && sortedDates.length === 0" class="availability-content error-content">
        <div class="text-caption text-negative">{{ error }}</div>
      </div>
      <q-scroll-area v-else ref="scrollAreaRef" class="monthly overflow-hidden availability-scroll" horizontal
        @wheel.prevent="onWheel" @scroll="onScroll">
        <div class="row items-start q-pa-xs no-wrap">
          <div v-for="day in sortedDates" :key="day.date" class="day-width">
            <WdHutAvailability :day="day" :is-selected="day.date === startDate" :is-today="isToday(day.date)" />
          </div>
        </div>
      </q-scroll-area>
    </div>
  </div>
</template>

<style scoped>
.monthly {
  border-radius: 5px;
}

.availability-container {
  min-height: 140px;
  height: 140px;
}

.availability-scroll {
  height: 140px;
}

.availability-content {
  height: 140px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.loading-content {
  text-align: center;
}

.error-content {
  text-align: center;
}

.day-width {
  width: 45px;
  flex-shrink: 0;
}
</style>
