<script setup lang="ts">
import { ref, computed } from 'vue';
import { copyToClipboard } from 'quasar';
import { useIntersectionObserver } from '@vueuse/core';
import { usePlace } from '@composables/usePlace';
import { useHutImages } from '@composables/useHutImages';
import { usePlaceWeather } from '@composables/usePlaceWeather';
import { schemasWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdHutImageGallery from '@components/huts/WdHutImageGallery.vue';
import WdHutTypeChip from '@components/huts/WdHutTypeChip.vue';
import WdHutAvailabilities from '@components/huts/WdHutAvailabilities.vue';
import WdHutOpenMonthly from '@components/huts/monthly/WdHutOpenMonthly.vue';
import WdHutWeatherForecast from '@components/huts/WdHutWeatherForecast.vue';
import WdTextClamp from '@components/utils/WdTextClamp.vue';

interface Props {
  slug: string;
}

const props = defineProps<Props>();
const { selectedMonth } = storeToRefs(useHutsStore());

// Fetch place data (primary data, loaded immediately)
const { place, loading: placeLoading, error: placeError } = usePlace(computed(() => props.slug));

// Fetch images (important for UX, loaded immediately)
const { images, loading: imagesLoading } = useHutImages(computed(() => props.slug));

// Weather section (lazy loaded when visible)
const weatherSection = ref<HTMLElement>();
const weatherSectionVisible = ref(false);

useIntersectionObserver(weatherSection, ([{ isIntersecting }]) => {
  if (isIntersecting) {
    weatherSectionVisible.value = true;
  }
});

const { loading: weatherLoading } = usePlaceWeather(
  computed(() =>
    weatherSectionVisible.value && place.value?.location
      ? { lat: place.value.location.lat, lon: place.value.location.lon }
      : undefined
  )
);

// Computed properties
const isHutOpen = computed<schemasWodore['AnswerEnum']>(() => {
  const currentMonth = selectedMonth.value;
  if (!place.value?.open_monthly) return 'unknown';
  const o = place.value.open_monthly[`month_${currentMonth}`];
  return (o as schemasWodore['AnswerEnum']) ?? 'unknown';
});

const isHutClosed = computed<'yes' | 'yesish' | 'no' | 'noish' | 'maybe' | 'unknown'>(() => {
  switch (isHutOpen.value) {
    case 'yes':
      return 'no';
    case 'yesish':
      return 'noish';
    case 'no':
      return 'yes';
    case 'noish':
      return 'yesish';
  }
  return isHutOpen.value;
});
</script>

<style scoped lang="scss">
.attribution {
  font-size: x-small;
  color: rgb(171, 171, 171);
}

.attr_link :deep(a) {
  color: rgb(171, 171, 171);
  text-decoration: underline dotted;
}
</style>

<template>
  <div class="wd-place-content">
    <!-- Loading state -->
    <div v-if="placeLoading" class="q-pa-md">
      <q-skeleton type="rect" height="200px" />
      <q-skeleton type="text" class="q-mt-md" />
      <q-skeleton type="text" />
    </div>

    <!-- Error state -->
    <div v-else-if="placeError" class="q-pa-md">
      <q-banner class="bg-negative text-white"> Failed to load place information </q-banner>
    </div>

    <!-- Content -->
    <div v-else-if="place" class="q-py-md">
      <!-- Owner -->
      <h2 class="text-subtitle1 text-accent-900 q-ma-none q-mb-sm">
        {{ place.owner?.name }}
      </h2>

      <!-- Gallery and Type Chips -->
      <div class="row items-start q-gutter-sm">
        <div class="col-md-12 col-sm-7 col-7">
          <WdHutImageGallery :images="images" :loading="imagesLoading" :hut="place" />
        </div>

        <div class="col-md-12 col-sm-4 col-4">
          <div class="row items-start justify-start q-gutter-sm">
            <WdHutTypeChip
              class="shadow-0 col-md-6 col-sm-12 col-12"
              :type="place.type_open"
              :capacity="place.capacity_open"
              :open="isHutOpen"
            />
            <WdHutTypeChip
              class="shadow-0 col-md-6 col-sm-12 col-12"
              :type="place.type_closed"
              :capacity="place.capacity_closed"
              :open="isHutClosed"
            />
            <!-- Elevation chip -->
            <q-chip
              v-if="place.elevation"
              size="md"
              class="bg-grey-4 shadow-0 col-md-6 col-sm-12 col-12"
            >
              <q-avatar class="bg-grey-5" text-color="primary-500">
                <q-icon size="20px">
                  <IconMingcuteMountain2Fill />
                </q-icon>
              </q-avatar>
              <span class="text-primary-500">{{ place.elevation }} m</span>
            </q-chip>
          </div>
        </div>
      </div>

      <!-- Description -->
      <div class="text-body2 q-my-sm">
        <div
          v-if="place.description_attribution"
          class="attribution attr_link text-right"
          v-html="place.description_attribution"
        />
        <WdTextClamp :max-lines="5" :text="place.description" />
      </div>

      <!-- Availabilities -->
      <WdHutAvailabilities
        :slug="slug"
        :has-availability="place.has_availability ?? undefined"
        :symbol-map="{
          ...(place.type_open?.slug
            ? {
                [place.type_open.slug]: {
                  detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${place.type_open.slug}.png`,
                  simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${place.type_open.slug}.png`,
                },
              }
            : {}),
          ...(place.type_closed?.slug
            ? {
                [place.type_closed.slug]: {
                  detailed: `https://hub.wodore.com/media/huts/types/symbols/detailed/${place.type_closed.slug}.png`,
                  simple: `https://hub.wodore.com/media/huts/types/symbols/simple/${place.type_closed.slug}.png`,
                },
              }
            : {}),
        }"
      />

      <!-- Open Monthly -->
      <WdHutOpenMonthly
        :open_monthly="place.open_monthly"
        :type_open="place.type_open"
        :type_closed="place.type_closed"
      />

      <!-- Weather (lazy loaded) -->
      <div ref="weatherSection">
        <WdHutWeatherForecast
          v-if="weatherSectionVisible && place.location"
          :latitude="place.location.lat"
          :longitude="place.location.lon"
          :elevation="place.elevation ?? undefined"
          :loading="weatherLoading"
        />
      </div>

      <!-- Location -->
      <div class="text-subtitle1 text-accent q-mt-md">{{ $t('location') }}</div>
      <q-list dense>
        <q-item v-if="place.location">
          <q-item-section side>
            <q-icon size="xs">
              <IconFa6SolidLocationCrosshairs />
            </q-icon>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ place.location.lat.toPrecision(7) }},
              {{ place.location.lon.toPrecision(6) }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-btn
              flat
              dense
              round
              size="10pt"
              @click="
                copyToClipboard(
                  `${place.location.lat.toPrecision(7)}, ${place.location.lon.toPrecision(6)}`
                )
              "
            >
              <q-icon size="10pt">
                <IconFa6SolidCopy />
              </q-icon>
            </q-btn>
          </q-item-section>
        </q-item>
      </q-list>
    </div>
  </div>
</template>
