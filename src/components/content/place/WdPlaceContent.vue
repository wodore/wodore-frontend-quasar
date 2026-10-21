<script setup lang="ts">
import { ref, computed } from 'vue';
import { copyToClipboard } from 'quasar';
import { useIntersectionObserver, useOnline } from '@vueuse/core';
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
const {
  place,
  loading: placeLoading,
  error: placeError,
  refetch: refetchPlace,
} = usePlace(computed(() => props.slug));

// Live connectivity: a stored error replays as 'offline' whenever the
// browser reports no connection — accurate guidance for the retry the
// user is about to click, even before they click it.
const isOnline = useOnline();

const placeErrorKind = computed(() => {
  if (!placeError.value) return null;
  return isOnline.value ? placeError.value.kind : 'offline';
});

const placeErrorHintKey = computed(() => {
  switch (placeErrorKind.value) {
    case 'offline':
      return 'hut.load_error_offline_hint';
    case 'unreachable':
      return 'hut.load_error_unreachable_hint';
    default:
      return 'hut.load_error_server_hint';
  }
});

// Fetch images (important for UX, loaded immediately)
const { images, loading: imagesLoading } = useHutImages(computed(() => props.slug));

// Weather section (lazy loaded when visible)
const weatherSection = ref<HTMLElement>();
const weatherSectionVisible = ref(false);

// Simple symbol icons for the availability section, keyed by place type slug.
// A computed keeps the object identity stable between renders (an inline
// object in the template would be rebuilt every render).
const hutTypeIcons = computed<Record<string, string>>(() => {
  const icons: Record<string, string> = {};
  const placeValue = place.value;
  for (const type of [placeValue?.type_open, placeValue?.type_closed]) {
    if (type?.slug && type.symbol?.mono) {
      icons[type.slug] = type.symbol.mono;
    }
  }
  return icons;
});

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
// ── Reserved-height scaffold (owner 2026-10: "as little flickering as
//    possible"). Heights measured on the live panel at 460px and 380px;
//    they are layout constants — if a section's design changes, re-measure
//    and update BOTH this file and WdContentPanel's minimized budget.
.wd-place-block--stripe {
  min-height: 20px; // year stripe row (18px) + rounding
}

.wd-place-block--badges {
  min-height: 32px; // one badge line (badges may wrap → block grows)
}

.wd-place-block--availability {
  min-height: 128px; // availability strip (reserved when has_availability)
}

.wd-place-block--weather {
  min-height: 157px; // forecast block (always shown once the place loads)
}

.wd-place-block--gallery {
  margin-top: 8px;
}

.attribution {
  font-size: x-small;
  color: rgb(171, 171, 171);
}

.attr_link :deep(a) {
  /* fixed grey failed AA on pine - muted ink floor */
  color: rgba(var(--wd-ink-rgb), 0.7);
  text-decoration: underline dotted;
}

// Load-failure state: a calm, centered recovery block. The drawer surface
// already is the panel — no nested card, no alarm red (availability owns
// red/green); the information voice (--wd-ink-soft) carries the state.
.wd-place-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  min-height: 45vh;
  padding: 24px 16px;
}

.wd-place-error__icon {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: var(--wd-wash);
  color: var(--wd-ink-soft);
  margin-bottom: 16px;
}

.wd-place-error__title {
  margin-bottom: 4px;
}

.wd-place-error__hint {
  margin: 0 0 24px;
  max-width: 38ch;
}

// HTTP status code line (label style; no API error body text is shown).
// :has pulls the hint's bottom margin in tight when the code follows.
.wd-place-error__hint:has(+ .wd-place-error__code) {
  margin-bottom: 4px;
}

.wd-place-error__code {
  margin: 0 0 24px;
  font-weight: 600;
  letter-spacing: 0.05em;
  font-variant-numeric: tabular-nums;
}

// Below the Quasar md breakpoint (1440px) the place renders in the mobile
// bottom sheet at its initial snap (~330px incl. header/footer): drop the
// drawer centering and compact the rhythm so heading, hint AND the retry
// action clear the fold.
@media (max-width: 1439px) {
  .wd-place-error {
    min-height: 0;
    padding: 16px;
  }

  .wd-place-error__icon {
    width: 48px;
    height: 48px;
    margin-bottom: 12px;

    .q-icon {
      font-size: 24px;
    }
  }

  .wd-place-error__hint {
    margin-bottom: 16px;
  }
}
</style>

<template>
  <div class="wd-place-content">
    <!-- Error state: calm recovery block, retry is the one action -->
    <div v-if="placeError" class="wd-place-error" role="alert">
      <div class="wd-place-error__icon" aria-hidden="true">
        <q-icon name="wd-cloud-offline-outline" size="28px" />
      </div>
      <div class="wd-place-error__title text-h6 wd-ink-text">
        {{ $t(placeErrorKind === 'offline' ? 'hut.load_error_offline_title' : 'hut.load_error') }}
      </div>
      <p class="wd-place-error__hint text-body2 wd-ink-soft-text">
        {{ $t(placeErrorHintKey) }}
      </p>
      <div
        v-if="placeErrorKind === 'http' && placeError?.status"
        class="wd-place-error__code text-caption wd-ink-text"
      >
        {{ $t('error.code') }} {{ placeError.status }}
      </div>
      <q-btn unelevated color="primary" :label="$t('hut.load_error_retry')" @click="refetchPlace" />
    </div>

    <!-- Reserved-height scaffold (owner 2026-10: "as little flickering as
         possible"). Every block below reserves its FINAL height from the
         first paint — loading, loaded and no-data states share one layout,
         so the panel never toggles sizes while data arrives. Empty space is
         the reserved state; skeletons only where a glanceable signal helps
         (the gallery). -->
    <div v-else class="wd-place-scaffold q-pb-md">
      <!-- Year stripe (open-monthly): 20px reserved; renders with place -->
      <div class="wd-place-block wd-place-block--stripe">
        <WdYearStripe
          v-if="place"
          :rows="yearStripeRows"
          :selected-month="selectedMonth ? parseInt(selectedMonth) : undefined"
          :stacked="false"
        />
      </div>

      <!-- Type badges (bed counts): one line (32px) reserved, may grow
           when wrapping — the panel's minimized height budget includes
           slack for it -->
      <div class="wd-place-block wd-place-block--badges wd-place-badges">
        <div v-if="place" class="row q-gutter-sm q-mb-sm">
          <WdPlaceTypeBadge
            v-if="place.type_open?.name"
            :color="place.type_open.color"
            :icon-identifier="'accommodation.' + place.type_open.slug"
            :icon-href="place.type_open.symbol?.mono"
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
            :icon-identifier="'accommodation.' + place.type_closed.slug"
            :icon-href="place.type_closed.symbol?.mono"
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
      </div>

      <!-- Gallery: reserved slot (variant-aware height: mobile stripe vs
           desktop 3:2) — the wrapper always occupies the final height;
           skeleton while the place loads, gallery/no-image inside after.
           See WdHutImageGallery .wd-gallery-slot. -->
      <div class="wd-place-block wd-place-block--gallery">
        <WdHutImageGallery
          :images="place ? images : []"
          :loading="placeLoading || imagesLoading"
          :hut="place ?? undefined"
        />
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
            <q-chip v-if="place.elevation" size="md" class="wd-surface-deep q-mr-none shadow-0 col-md-6 col-sm-12 col-12"
              style="min-width: 90px; max-width: 90px; max-height: 30px">
              <q-avatar class="wd-ridge-bg" text-color="primary-500">
                <q-icon size="20px">
                  <IconMingcuteMountain2Fill />
                </q-icon>
              </q-avatar>
              <span class="text-primary-500" style="font-weight: 500; width: 28px">{{ place.elevation }} m</span>
            </q-chip>
          </div>
        </div> -->

      <!-- Description: arrives atomically with the place payload — no
           reservation needed before that (owner 2026-10) -->
      <div v-if="place" class="text-body2 q-my-sm">
        <div
          v-if="place.description_attribution"
          class="attribution attr_link text-right"
          v-html="place.description_attribution"
        />
        <WdTextClamp :max-lines="5" :text="place.description" />
      </div>

      <!-- New Availability (Swiper-based): optional — the place payload
           tells us (has_availability), so the 128px slot is reserved
           BEFORE the (lazily fetched) data arrives (owner 2026-10) -->
      <div v-if="place?.has_availability" class="wd-place-block wd-place-block--availability">
        <WdAccommodationAvailabilities
          :slug="slug"
          :has-availability="place.has_availability ?? undefined"
          :hut-type-icons="hutTypeIcons"
        />
      </div>

      <!-- Weather (lazy loaded): always shown once the place exists —
           157px reserved so the lazy load cannot shift the layout -->
      <div v-if="place" ref="weatherSection" class="wd-place-block wd-place-block--weather">
        <WdWeatherForecast
          v-if="weatherSectionVisible && place.location"
          :latitude="place.location.lat"
          :longitude="place.location.lon"
          :elevation="place.elevation ?? undefined"
          collection="weather-icons-filled-animated"
        />
      </div>

      <!-- Location -->
      <div v-if="place">
        <div class="wd-section-title q-mt-md">{{ $t('location') }}</div>
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
  </div>
</template>
