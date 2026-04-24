<script setup lang="ts">
import { ref, computed, watchEffect, watch, nextTick } from 'vue';
import { date } from 'quasar';
import { Swiper, SwiperSlide } from 'swiper/vue';
import type { Swiper as SwiperType } from 'swiper';
import { FreeMode, Scrollbar, Virtual, Mousewheel } from 'swiper/modules';
import 'swiper/css';
import 'swiper/css/free-mode';
import 'swiper/css/scrollbar';
import { clientWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import { useSlideCount } from '@composables/useSlideCount';
import WdAccommodationDay from './WdAccommodationDay.vue';

const { formatDate, addToDate, subtractFromDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());

interface Props {
  slug: string;
  hasAvailability?: boolean;
  /** Map of hut type slug → icon URL */
  hutTypeIcons?: Record<string, string>;
}

const props = withDefaults(defineProps<Props>(), {
  hasAvailability: undefined,
  hutTypeIcons: () => ({}),
});

// --- Availability icons ---
const availabilityIcons = ref<Record<string, string>>({});

const fetchAvailabilityIcons = async () => {
  try {
    const { data, error } = await clientWodore.GET('/v1/categories/map/{parent_slug}', {
      params: {
        path: { parent_slug: 'availability' },
        query: { lang: 'de', is_active: true, media_mode: 'absolute' },
      },
    });
    if (error || !data) return;
    const icons: Record<string, string> = {};
    for (const [slug, cat] of Object.entries(data)) {
      const entry = cat as { symbol_detailed?: string | null };
      if (entry.symbol_detailed) {
        icons[slug] = entry.symbol_detailed;
      }
    }
    availabilityIcons.value = icons;
  } catch {
    // Silently fail — icons will be missing but component still works
  }
};

// --- Date range ---
type OccupancyStatus = 'empty' | 'low' | 'medium' | 'high' | 'full' | 'unknown';

interface AvailabilityDay {
  date: string;
  reservation_status: string;
  free: number;
  total: number;
  occupancy_percent: number;
  occupancy_steps: number;
  occupancy_status: OccupancyStatus;
  hut_type: string;
  type_slug?: string | null;
  type_color?: string | null;
  link: string;
  loading?: boolean;
}

const availabilityItems = ref<AvailabilityDay[]>([]);
const loadingSet = ref<Set<string>>(new Set());

const today = computed(() => formatDate(new Date(), 'YYYY-MM-DD'));

// Convert selectedDate (DD.MM.YY) to YYYY-MM-DD
const startDate = computed(() => {
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

/** Display format: dd.mm or "Heute" */
const startDateDisplay = computed(() => {
  if (startDate.value === today.value) return 'Heute';
  const d = new Date(`${startDate.value}T00:00:00`);
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}`;
});

const makeEmptyDay = (dateStr: string): AvailabilityDay => ({
  date: dateStr,
  reservation_status: 'unknown',
  free: 0,
  total: 0,
  occupancy_percent: 0,
  occupancy_steps: 0,
  occupancy_status: 'unknown',
  hut_type: 'unknown',
  link: '#',
  loading: true,
});

const initializeDateRange = (): AvailabilityDay[] => {
  const items: AvailabilityDay[] = [];
  const start = subtractFromDate(new Date(today.value), { days: 4 });
  const end = addToDate(new Date(today.value), { days: 365 });
  let current = new Date(start);
  while (current <= end) {
    items.push(makeEmptyDay(formatDate(current, 'YYYY-MM-DD')));
    current = addToDate(current, { days: 1 });
  }
  return items;
};

// --- Data loading: simple "load 14 days from index" strategy ---
const loadFromIndex = async (fromIndex: number, days: number = 14) => {
  if (!props.slug || props.hasAvailability === false) return;
  if (fromIndex < 0 || fromIndex >= availabilityItems.value.length) return;

  const maxDays = availabilityItems.value.length - fromIndex;
  const actualDays = Math.min(days, maxDays);

  // Find the actual start: first loading item at or after fromIndex
  let startIdx = fromIndex;
  while (startIdx < fromIndex + actualDays && !availabilityItems.value[startIdx].loading) {
    startIdx++;
  }
  if (startIdx >= fromIndex + actualDays) return;

  // Count consecutive loading days from startIdx
  let count = 0;
  for (let i = startIdx; i < Math.min(startIdx + actualDays, availabilityItems.value.length); i++) {
    if (availabilityItems.value[i].loading) {
      count++;
    } else {
      break;
    }
  }
  if (count === 0) return;

  const startDateStr = availabilityItems.value[startIdx].date;
  const requestKey = `${startDateStr}-${count}`;
  if (loadingSet.value.has(requestKey)) return;
  loadingSet.value.add(requestKey);

  try {
    const { data, error: err } = await clientWodore.GET('/v1/huts/{slug}/availability/{date}', {
      params: {
        path: { slug: props.slug, date: startDateStr },
        query: { lang: 'de', days: count },
      },
    });

    if (err || !data) {
      // Non-2xx response — mark requested days as unknown (not loading)
      for (let i = startIdx; i < startIdx + count; i++) {
        if (availabilityItems.value[i].loading) {
          availabilityItems.value[i] = {
            ...availabilityItems.value[i],
            loading: false,
          };
        }
      }
    } else if ('data' in data && Array.isArray(data.data)) {
      data.data.forEach(day => {
        const index = availabilityItems.value.findIndex(item => item.date === day.date);
        if (index >= 0) {
          availabilityItems.value[index] = { ...day, loading: false };
        }
      });
      // Mark any remaining loading days in the range as unknown
      for (let i = startIdx; i < startIdx + count; i++) {
        if (availabilityItems.value[i].loading) {
          availabilityItems.value[i] = {
            ...availabilityItems.value[i],
            loading: false,
          };
        }
      }
    }
  } finally {
    loadingSet.value.delete(requestKey);
  }
};

// --- Swiper ---
const swiperContainer = ref<HTMLElement | null>(null);
const { slidesPerView } = useSlideCount(swiperContainer, 68);

const swiperInstance = ref<SwiperType | null>(null);
const onSwiper = (swiper: SwiperType) => {
  swiperInstance.value = swiper;
  activeIndex.value = swiper.activeIndex;
};

const selectedSlideIndex = computed(() => {
  const idx = availabilityItems.value.findIndex(item => item.date === startDate.value);
  return idx >= 0 ? idx : 0;
});

const onSlideChange = () => {
  if (!swiperInstance.value) return;
  activeIndex.value = swiperInstance.value.activeIndex;
  loadFromIndex(activeIndex.value, 14);
};

// Scroll to selected date
watch(
  () => startDate.value,
  () => {
    if (!swiperInstance.value || availabilityItems.value.length === 0) return;
    const idx = selectedSlideIndex.value;
    if (idx >= 0) {
      nextTick(() => {
        swiperInstance.value?.slideTo(idx, 300);
      });
      loadFromIndex(Math.max(0, idx - 4), 22);
    }
  },
  { immediate: true }
);

// --- Month selector ---
const formatMonthLabel = (dateObj: Date) => {
  return dateObj.toLocaleDateString('de-CH', { month: 'short' }).toUpperCase();
};

const nextMonths = computed(() => {
  const months: { label: string; date: string; key: string; monthKey: string }[] = [];
  const base = new Date();
  for (let i = 0; i <= 5; i++) {
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

const scrollToDate = (dateStr: string) => {
  if (!swiperInstance.value || availabilityItems.value.length === 0) return;
  const index = availabilityItems.value.findIndex(item => {
    if (dateStr.length === 7) {
      return item.date.startsWith(dateStr);
    }
    return item.date === dateStr;
  });
  if (index >= 0) {
    swiperInstance.value.slideTo(index, 300);
    loadFromIndex(index, 14);
  }
};

// Track active month for selector highlight
const activeIndex = ref(0);

const activeMonthKey = computed(() => {
  if (availabilityItems.value.length === 0) return '';
  const idx = activeIndex.value;
  if (idx >= 0 && idx < availabilityItems.value.length) {
    return availabilityItems.value[idx].date.slice(0, 7);
  }
  return '';
});

// --- Initialize ---
const lastLoadedSlug = ref<string | undefined>(undefined);

watchEffect(() => {
  if (!props.slug || props.hasAvailability === false) return;
  if (lastLoadedSlug.value === props.slug) return;
  lastLoadedSlug.value = props.slug;

  fetchAvailabilityIcons();

  availabilityItems.value = initializeDateRange();

  const selectedIndex = availabilityItems.value.findIndex(item => item.date === startDate.value);
  if (selectedIndex >= 0) {
    loadFromIndex(Math.max(0, selectedIndex - 4), 22);
  }

  nextTick(() => {
    if (swiperInstance.value) {
      swiperInstance.value.slideTo(selectedSlideIndex.value, 0);
    }
  });
});
</script>

<template>
  <div
    v-if="hasAvailability !== false"
    ref="swiperContainer"
    class="wd-accommodation-availabilities"
  >
    <!-- Header -->
    <div class="row items-center no-wrap q-mb-xs q-mt-sm">
      <div class="text-subtitle1 text-accent">Verfügbarkeit</div>
      <div class="col row justify-center">
        <q-btn dense flat class="today-btn" @click="scrollToDate(startDate)">
          <q-icon name="wd-calendar" size="14px" class="q-mr-xs" />
          <span class="today-btn__label">{{ startDateDisplay }}</span>
        </q-btn>
      </div>
      <div class="month-selector row items-center no-wrap">
        <div
          v-for="(month, idx) in nextMonths"
          :key="month.date"
          class="month-chip-wrap"
          :class="[
            month.key === activeMonthKey
              ? `month_${month.monthKey}--gradient-dark`
              : `month_${month.monthKey}--gradient-light`,
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
            @click="scrollToDate(month.key === today.slice(0, 7) ? today : month.date)"
          >
            {{ month.label }}
          </q-btn>
        </div>
      </div>
    </div>

    <!-- Swiper with virtual slides -->
    <swiper
      v-if="availabilityItems.length"
      :modules="[Virtual, FreeMode, Scrollbar, Mousewheel]"
      :virtual="{
        addSlidesAfter: 14,
        addSlidesBefore: 14,
      }"
      :slides-per-view="slidesPerView"
      :space-between="0"
      :free-mode="{
        enabled: true,
        sticky: false,
        momentum: true,
        momentumRatio: 1,
        momentumBounce: false,
        minimumVelocity: 0.3,
      }"
      :scrollbar="{
        draggable: false,
        hide: true,
        snapOnRelease: false,
      }"
      :mousewheel="{
        enabled: true,
        forceToAxis: false,
        releaseOnEdges: false,
        sensitivity: 0.22,
      }"
      :initial-slide="selectedSlideIndex"
      :grab-cursor="true"
      class="wd-accommodation-availabilities__swiper"
      @swiper="onSwiper"
      @slide-change="onSlideChange"
    >
      <swiper-slide
        v-for="(item, index) in availabilityItems"
        :key="item.date"
        :virtual-index="index"
        class="wd-accommodation-availabilities__slide"
      >
        <WdAccommodationDay
          :day="item"
          :availability-icons="availabilityIcons"
          :is-selected="item.date === startDate"
          :hut-type-color="item.type_color ?? undefined"
          :hut-type-icons="props.hutTypeIcons"
          :is-past="item.date < today"
        />
      </swiper-slide>
    </swiper>
  </div>
</template>

<style scoped lang="scss">
.wd-accommodation-availabilities {
  overflow: hidden;
}

.month-selector {
  flex-shrink: 0;
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

.today-btn {
  padding: 0 6px;
  min-height: 20px;
  color: rgba(0, 0, 0, 0.6);
  font-size: 11px;
}

.today-btn__label {
  line-height: 1;
}

.wd-accommodation-availabilities__swiper {
  width: 100%;
  padding-bottom: 2px;
  cursor: grab;

  &:active {
    cursor: grabbing;
  }

  &.swiper-scrollbar-lock {
    padding-bottom: 0;
    cursor: default;
  }
}

.wd-accommodation-availabilities__slide {
  width: 68px;
  flex-shrink: 0;
}

// Scrollbar styling
.wd-accommodation-availabilities__swiper :deep(.swiper-scrollbar) {
  height: 3px;
  background: rgba(0, 0, 0, 0.08);
  border-radius: 2px;
  bottom: 2px;
}

.wd-accommodation-availabilities__swiper :deep(.swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.25);
  border-radius: 2px;
  min-width: 24px;
}

.wd-accommodation-availabilities__swiper :deep(.swiper-scrollbar:hover) {
  height: 5px;
}

.wd-accommodation-availabilities__swiper :deep(.swiper-scrollbar:hover .swiper-scrollbar-drag) {
  background: rgba(0, 0, 0, 0.35);
}
</style>
