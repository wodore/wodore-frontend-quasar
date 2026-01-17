<script setup lang="ts">
import { ref, computed, watchEffect } from 'vue';
import { date, QScrollArea } from 'quasar';
import { clientWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdHutAvailability from './WdHutAvailability.vue';

const { formatDate } = date;
const { selectedDate } = storeToRefs(useHutsStore());
const scrollAreaRef = ref<QScrollArea | null>(null);

interface Props {
  slug: string;
  hasAvailability?: boolean;
}

const props = defineProps<Props>();

interface AvailabilityResponse {
  slug: string;
  id: number;
  source_id: string;
  source_link: string;
  source: string;
  days: number;
  start_date: string;
  data: Array<{
    date: string;
    reservation_status: string;
    free: number;
    total: number;
    occupancy_percent: number;
    occupancy_steps: number;
    occupancy_status: 'empty' | 'low' | 'medium' | 'high' | 'full';
    hut_type: string;
    link: string;
  }>;
}

const availabilityData = ref<AvailabilityResponse['data'] | undefined>(undefined);
const loading = ref(false);
const error = ref<string | undefined>(undefined);

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

// Handle horizontal scroll with vertical mouse wheel
const onWheel = (evt: WheelEvent) => {
  if (scrollAreaRef.value) {
    evt.preventDefault();
    const scrollInfo = scrollAreaRef.value.getScrollPosition();
    scrollAreaRef.value.setScrollPosition('horizontal', scrollInfo.left + evt.deltaY, 150);
  }
};

// Fetch availability data
watchEffect(() => {
  if (!props.slug || props.hasAvailability === false) {
    return;
  }

  loading.value = true;
  error.value = undefined;

  clientWodore
    .GET('/v1/huts/{slug}/availability/{date}', {
      params: {
        path: {
          slug: props.slug,
          date: startDate.value,
        },
        query: {
          lang: 'de',
          days: 240,
        },
      },
    })
    .then(({ data, error: err }) => {
      if (err) {
        console.error('Availability fetch error:', err);
        error.value = 'Failed to load availability';
        availabilityData.value = undefined;
      } else if (data) {
        availabilityData.value = (data as AvailabilityResponse).data;
      }
    })
    .finally(() => {
      loading.value = false;
    });
});
</script>

<template>
  <div v-if="hasAvailability !== false">
    <div class="text-subtitle1 text-accent q-mb-sm q-mt-md">Verfügbarkeit</div>
    <div class="availability-container">
      <div v-if="loading" class="availability-content loading-content">
        <q-spinner color="primary-300" size="24px" />
        <div class="text-caption q-mt-sm text-grey-7">Lade Verfügbarkeit...</div>
      </div>
      <div v-else-if="error" class="availability-content error-content">
        <div class="text-caption text-negative">{{ error }}</div>
      </div>
      <q-scroll-area v-else-if="availabilityData && availabilityData.length > 0" ref="scrollAreaRef"
        class="monthly overflow-hidden availability-scroll" horizontal @wheel.prevent="onWheel">
        <div class="row items-start q-pa-xs no-wrap">
          <div v-for="day in availabilityData" :key="day.date" class="day-width">
            <WdHutAvailability :day="day" />
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
