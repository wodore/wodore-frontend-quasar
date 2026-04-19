<script setup lang="ts">
import { ref, computed } from 'vue';
import { copyToClipboard } from 'quasar';
import { useIntersectionObserver } from '@vueuse/core';
import { usePlace } from '@composables/usePlace';
import { useHutImages } from '@composables/useHutImages';
import { schemasWodore } from '@clients/index';
import { useHutsStore } from '@stores/huts-store';
import { storeToRefs } from 'pinia';
import WdHutImageGallery from '@components/huts/WdHutImageGallery.vue';
// import WdHutTypeChip from '@components/huts/WdHutTypeChip.vue';
// import WdHutAvailabilities from '@components/huts/WdHutAvailabilities.vue';
import WdAccommodationAvailabilities from '@components/huts/WdAccommodationAvailabilities.vue';
// import WdHutOpenMonthly from '@components/huts/monthly/WdHutOpenMonthly.vue';
import WdWeatherForecast from '@components/content/place/WdWeatherForecast.vue';
import WdTextClamp from '@components/utils/WdTextClamp.vue';
import WdPlaceTypeBadge from '@components/content/place/WdPlaceTypeBadge.vue';
import WdStatBox from '@components/content/WdStatBox.vue';
import WdYearStripe from '@components/content/place/WdYearStripe.vue';
import type { WdYearStripeRow } from '@components/content/place/WdYearStripe.vue';

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

// Computed properties
// const isHutOpen = computed<schemasWodore['AnswerEnum']>(() => {
//   const currentMonth = selectedMonth.value;
//   if (!place.value?.open_monthly) return 'unknown';
//   const o = place.value.open_monthly[`month_${currentMonth}`];
//   return (o as schemasWodore['AnswerEnum']) ?? 'unknown';
// });
//
// const isHutClosed = computed<'yes' | 'yesish' | 'no' | 'noish' | 'maybe' | 'unknown'>(() => {
//   switch (isHutOpen.value) {
//     case 'yes':
//       return 'no';
//     case 'yesish':
//       return 'noish';
//     case 'no':
//       return 'yes';
//     case 'noish':
//       return 'yesish';
//   }
//   return isHutOpen.value;
// });

type AnswerEnum = schemasWodore['AnswerEnum'];

const answerToPercentage: Record<AnswerEnum, number | undefined> = {
  yes: 100,
  yesish: 75,
  maybe: 50,
  noish: 25,
  no: 0,
  unknown: undefined,
};

const answerToPercentageInverse: Record<AnswerEnum, number | undefined> = {
  yes: 0,
  yesish: 25,
  maybe: 50,
  noish: 75,
  no: 100,
  unknown: undefined,
};

function getMonthAnswer(month: number): AnswerEnum {
  if (!place.value?.open_monthly) return 'unknown';
  const key = `month_${month.toString().padStart(2, '0')}`;
  const o = place.value.open_monthly[key];
  return (o as AnswerEnum) ?? 'unknown';
}

const yearStripeRows = computed<WdYearStripeRow[]>(() => {
  const rows: WdYearStripeRow[] = [];
  if (place.value?.type_open?.name) {
    rows.push({
      color: place.value.type_open.color,
      months: Array.from({ length: 12 }, (_, i) => answerToPercentage[getMonthAnswer(i + 1)]),
    });
  }
  if (place.value?.type_closed?.name) {
    rows.push({
      color: place.value.type_closed.color,
      months: Array.from(
        { length: 12 },
        (_, i) => answerToPercentageInverse[getMonthAnswer(i + 1)]
      ),
    });
  }
  return rows;
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
    <div v-else-if="place" class="q-pb-md">
      <!-- Year Stripe -->
      <WdYearStripe
        :rows="yearStripeRows"
        :selected-month="selectedMonth ? parseInt(selectedMonth) : undefined"
        stacked
      />

      <!-- Type Badges -->
      <div class="row q-gutter-sm q-mb-md">
        <WdPlaceTypeBadge
          v-if="place.type_open?.name"
          :color="place.type_open.color"
          :icon="
            place.type_open.symbol?.detailed ? 'img:' + place.type_open.symbol.detailed : undefined
          "
          :label="$t('standard')"
        >
          {{ place.type_open.name }}
          <template #append>
            <WdStatBox
              v-if="place.capacity_open != null"
              icon="wd-bed-flat"
              zero-icon="wd-no-bed-flat"
              :zero="place.capacity_open === 0"
            >
              {{ place.capacity_open }}
            </WdStatBox>
          </template>
        </WdPlaceTypeBadge>
        <WdPlaceTypeBadge
          v-if="place.type_closed?.name"
          :color="place.type_closed.color"
          :icon="
            place.type_closed.symbol?.detailed
              ? 'img:' + place.type_closed.symbol.detailed
              : undefined
          "
          :label="$t('reduced')"
        >
          {{ place.type_closed.name }}
          <template #append>
            <WdStatBox
              v-if="place.capacity_closed != null"
              icon="wd-bed-flat"
              zero-icon="wd-no-bed-flat"
              :zero="place.capacity_closed === 0"
            >
              {{ place.capacity_closed }}
            </WdStatBox>
          </template>
        </WdPlaceTypeBadge>
      </div>

      <!-- Gallery and Type Chips -->
      <div class="row items-start q-gutter-sm">
        <div class="col-md-12 col-sm-7 col-7">
          <WdHutImageGallery :images="images" :loading="imagesLoading" :hut="place" />
        </div>

        <!-- <div class="col-md-12 col-sm-4 col-4">
          <div class="row items-start justify-start q-gutter-sm" :class="{
            'q-gutter-lg': $q.screen.gt.sm,
          }">
            <WdHutTypeChip class="shadow-0 col-md-6 col-sm-12 col-12" :type="place.type_open"
              :capacity="place.capacity_open" :open="isHutOpen" />
            <WdHutTypeChip class="shadow-0 col-md-6 col-sm-12 col-12" :type="place.type_closed"
              :capacity="place.capacity_closed" :open="isHutClosed" /> -->
        <!-- Elevation chip -->
        <!--
            <q-chip v-if="place.elevation" size="md" class="bg-grey-4 q-mr-none shadow-0 col-md-6 col-sm-12 col-12"
              style="min-width: 90px; max-width: 90px; max-height: 30px">
              <q-avatar class="bg-grey-5" text-color="primary-500">
                <q-icon size="20px">
                  <IconMingcuteMountain2Fill />
                </q-icon>
              </q-avatar>
              <span class="text-primary-500" style="font-weight: 500; width: 28px">{{ place.elevation }} m</span>
            </q-chip>
          </div>
        </div> -->
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
      <!--
      <WdHutAvailabilities :slug="slug" :has-availability="place.has_availability ?? undefined" :symbol-map="{
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
      }" />
-->

      <!-- New Availability (Swiper-based, for comparison) -->
      <WdAccommodationAvailabilities
        :slug="slug"
        :has-availability="place.has_availability ?? undefined"
        :hut-type-icons="{
          ...(place.type_open?.symbol?.simple && place.type_open?.slug
            ? { [place.type_open.slug]: place.type_open.symbol.simple }
            : {}),
          ...(place.type_closed?.symbol?.simple && place.type_closed?.slug
            ? { [place.type_closed.slug]: place.type_closed.symbol.simple }
            : {}),
        }"
      />

      <!-- Open Monthly -->
      <!--
      <WdHutOpenMonthly :open_monthly="place.open_monthly" :type_open="place.type_open"
        :type_closed="place.type_closed" /> -->

      <!-- Weather (lazy loaded) -->
      <div ref="weatherSection">
        <WdWeatherForecast
          v-if="weatherSectionVisible && place.location"
          :latitude="place.location.lat"
          :longitude="place.location.lon"
          :elevation="place.elevation ?? undefined"
          collection="weather-icons-filled-animated"
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
              <a
                :href="`geo:${place.location.lat},${place.location.lon}`"
                target="_blank"
                class="text-primary"
              >
                {{ place.location.lat.toPrecision(7) }},
                {{ place.location.lon.toPrecision(6) }}
              </a>
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
