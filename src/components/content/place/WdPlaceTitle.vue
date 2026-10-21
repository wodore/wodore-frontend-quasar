<script setup lang="ts">
import { computed, inject } from 'vue';
import { storeToRefs } from 'pinia';
import { useI18n } from 'vue-i18n';
import { usePlace } from '@composables/usePlace';
import { useHutAvailabilityStatus } from '@composables/useHutAvailabilityStatus';
import { useHutsStore } from '@stores/huts-store';
import WdWeatherSelect from '@components/huts/WdWeatherSelect.vue';
import WdCategoryIcon from '@components/categories/WdCategoryIcon.vue';
import track from '@services/analytics';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();
const { t } = useI18n();

// Fetch place data for title
const { place } = usePlace(computed(() => props.slug));

// ── Availability briefing row (owner 2026-10) ──────────────────────
// The go/no-go bed read for the SELECTED date (topbar pill; today when
// unset), directly under the name — its own line so the overline
// (place + weather) stays airy (owner: "is the header not too crowded
// with this as well?" — yes, if inline; a dedicated row earns the
// signal its place without squeezing). Glyph + label per the
// Availability Rule (never color alone); click maximizes the minimized
// card (display-only in the mobile sheet, where no maximize exists).
const maximize = inject<(() => void) | null>('wdContentPanelMaximize', null);
const { selectedDateOrToday } = storeToRefs(useHutsStore());

const selectedDateISO = computed(() => {
  // DD.MM.YY (store) → YYYY-MM-DD (API) — same conversion the
  // availability strip applies to the selected date
  const parts = (selectedDateOrToday.value ?? '').split('.');
  if (parts.length === 3) {
    return `20${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
  }
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});

const { status: availStatus } = useHutAvailabilityStatus(
  computed(() => props.slug),
  selectedDateISO
);

const showAvail = computed(
  () =>
    place.value?.has_availability === true &&
    availStatus.value !== null &&
    // unknown = no information — no row at all (owner 2026-10: "same as
    // no info"), rather than a gray dot that reads as a state
    availStatus.value.status !== 'unknown'
);

const availLabel = computed(() =>
  availStatus.value ? t(`availability.glance.${availStatus.value.status}`) : ''
);

// Status → dot color, canonical from DESIGN.md's Availability Scale
// (both themes use the same fills; text picks the AA shade — the label
// stays in ink, the dot carries the state color).
const AVAIL_DOT_COLORS: Record<string, string> = {
  empty: '#25bf5e', // positive-500 — free
  free_unknown: '#7fab88', // muted green — free, degree unknown
  low: '#f6ad4b', // amber-300
  medium: '#ea9a37', // amber-400
  high: '#c3731f', // amber-600
  full: '#961a17', // negative-700
  unknown: '#575757', // black-100
};

const availColor = computed(
  () => AVAIL_DOT_COLORS[availStatus.value?.status ?? 'unknown'] ?? AVAIL_DOT_COLORS.unknown
);

const availTooltip = computed(() => {
  const s = availStatus.value;
  if (!s) return '';
  const counts =
    s.free != null && s.total != null ? ` (${s.free}/${s.total})` : '';
  return `${t('availability.title')}${counts}`;
});
</script>

<template>
  <q-no-ssr>
    <transition v-if="place" name="wd-title-swap" mode="out-in">
      <div :key="place.name ?? 'untitled'" class="wd-place-title row no-wrap">
      <!-- Avatar (type icon). Renders INSTANTLY from the MVT seed's
           identifier (WdCategoryIcon: direct SVG URL, module-cached);
           the payload's direct symbol URL takes over when it arrives —
           same look, no layout shift (fixed 44px box). -->
      <div class="wd-place-title__avatar col-auto q-mr-sm">
        <WdCategoryIcon
          v-if="place.type_open"
          :identifier="'accommodation.' + place.type_open.slug"
          :href="place.type_open.symbol?.color ?? null"
          variant="color"
          :size="44"
        />
      </div>

      <!-- Title block: briefing / title / owner. Availability rides
           INLINE in the briefing row after the weather (owner 2026-10) —
           status dot + short label, click maximizes. -->
      <div class="wd-place-title__text col self-center">
        <!-- Briefing row: elevation · weather · availability -->
        <div
          class="wd-place-title__overline text-caption wd-ink-soft-text"
          :class="{ invisible: !place.elevation && !place.location && !showAvail }"
        >
          <template v-if="place.elevation || place.location || showAvail">
            <span v-if="place.elevation" class="wd-place-title__elevation">
              <q-icon size="14px" name="wd-elevation-outline" />
              {{ place.elevation }}m
            </span>
            <span v-if="place.elevation && (place.location || showAvail)" class="wd-place-title__dot">•</span>
            <WdWeatherSelect
              v-if="place.location"
              :latitude="place.location.lat"
              :longitude="place.location.lon"
              collection="weather-icons-outlined-mono"
              :elevation="place.elevation ?? undefined"
              :size="18"
              :color="$q.dark.isActive ? 'accent-100' : 'accent-800'"
              :label="true"
              class="wd-place-title__weather"
              no-shadow
            />
            <template v-if="showAvail">
              <span v-if="place.location" class="wd-place-title__dot">•</span>
              <button
                type="button"
                class="wd-place-title__avail"
                :title="availTooltip"
                @click="maximize?.()"
              >
                <span
                  class="wd-place-title__avail-dot"
                  :style="{ backgroundColor: availColor }"
                  aria-hidden="true"
                />
                <span class="wd-place-title__avail-label">{{ availLabel }}</span>
              </button>
            </template>
          </template>
          <span v-else>&ZeroWidthSpace;</span>
        </div>

        <!-- Title -->
        <div
          class="wd-place-title__name"
          :class="$q.screen.xs || $q.platform.is.mobile ? 'text-h6' : 'text-h5'"
        >
          <a
            v-if="place.url"
            :href="place.url"
            target="_blank"
            @click="track('hut link click')"
            class="wd-ink-text"
          >
            {{ place.name }}
            <q-icon size="10pt" class="wd-ink-soft-text" style="transform: translateY(-6px)">
              <IconEvaExternalLinkFill />
            </q-icon>
          </a>
          <span v-else class="wd-ink-text">{{ place.name }}</span>
        </div>

        <!-- Subtitle: owner (3rd line, restored per owner 2026-10) -->
        <div
          class="wd-place-title__subtitle text-caption wd-ink-soft-text"
          :class="{ invisible: !place.owner }"
        >
          <template v-if="place.owner">{{ place.owner.name }}</template>
          <span v-else>&ZeroWidthSpace;</span>
        </div>
      </div>
    </div>
    </transition>
  </q-no-ssr>
</template>

<style lang="scss" scoped>
// ── Header swap (owner 2026-10, impeccable animate rules): re-targeting
//    fades the whole identity (icon + name + briefing) out-in. Opacity
//    only — no layout properties animate; ease-out-quint arrival
//    (~200ms), shorter ease-in exit (~140ms); reduced motion = instant.
.wd-title-swap-enter-active {
  transition: opacity 0.2s cubic-bezier(0.22, 1, 0.36, 1);
}

.wd-title-swap-leave-active {
  transition: opacity 0.14s cubic-bezier(0.64, 0, 0.78, 0);
}

.wd-title-swap-enter-from,
.wd-title-swap-leave-to {
  opacity: 0;
}

@media (prefers-reduced-motion: reduce) {
  .wd-title-swap-enter-active,
  .wd-title-swap-leave-active {
    transition: none;
  }
}

.wd-place-title {
  padding: 4px 6px;
}

.wd-place-title__text {
  min-width: 0;
}

.wd-place-title__overline {
  display: flex;
  align-items: center;
  gap: 6px;
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-place-title__elevation {
  display: inline-flex;
  align-items: center;
  gap: 2px;
  white-space: nowrap;
  flex-shrink: 0;
}

.wd-place-title__dot {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  line-height: 1;
  font-size: 1.2em;
}

.wd-place-title__name {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-place-title__subtitle {
  line-height: 1.3;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-place-title__avail-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex: none;
}
.wd-place-title__avail {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 0;
  border: none;
  background: transparent;
  color: inherit; // <button> resets color — inherit the briefing row's
  cursor: pointer;
  flex: none; // rides inline in the briefing row — never the ellipsis victim
}

.wd-place-title__avail-label {
  // Same typography as the elevation/weather siblings: inherit the
  // briefing row's text-caption + wd-ink-soft-text (owner 2026-10:
  // "use same text font as weather and elevation"). The dot alone
  // carries the state color.
  line-height: 1.3;
  white-space: nowrap;
  color: inherit;
  font-size: inherit;
  font-weight: inherit;
}

.wd-place-title__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  flex: none;
}

.wd-place-title__weather :deep(.weather-select) {
  margin-left: 0;
}

.wd-place-title__weather :deep(.weather-select__mask) {
  transform: translateY(-2px);
}
</style>
