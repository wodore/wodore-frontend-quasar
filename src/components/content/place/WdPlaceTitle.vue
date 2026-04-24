<script setup lang="ts">
import { computed } from 'vue';
import { usePlace } from '@composables/usePlace';
import WdWeatherSelect from '@components/huts/WdWeatherSelect.vue';
import track from '@services/analytics';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();

// Fetch place data for title
const { place } = usePlace(computed(() => props.slug));
</script>

<template>
  <q-no-ssr>
    <div v-if="place" class="wd-place-title row no-wrap">
      <!-- Avatar (type icon) -->
      <div class="wd-place-title__avatar col-auto q-mr-sm">
        <q-icon
          v-if="place.type_open && place.type_open.symbol"
          :name="'img:' + place.type_open?.symbol.detailed"
          size="44px"
        />
      </div>

      <!-- Title block: overline / title / subtitle -->
      <div class="wd-place-title__text col self-center">
        <!-- Overline: elevation + weather -->
        <div
          class="wd-place-title__overline text-caption text-accent-900"
          :class="{ invisible: !place.elevation && !place.location }"
        >
          <template v-if="place.elevation || place.location">
            <span v-if="place.elevation" class="wd-place-title__elevation">
              <q-icon size="14px" name="wd-elevation-outline" />
              {{ place.elevation }}m
            </span>
            <span v-if="place.elevation && place.location" class="wd-place-title__dot">•</span>
            <WdWeatherSelect
              v-if="place.location"
              :latitude="place.location.lat"
              :longitude="place.location.lon"
              collection="weather-icons-outlined-mono"
              :elevation="place.elevation ?? undefined"
              :size="18"
              color="accent-900"
              :label="true"
              class="wd-place-title__weather"
              no-shadow
            />
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
            class="text-primary-900"
          >
            {{ place.name }}
            <q-icon size="10pt" class="text-grey-5" style="transform: translateY(-6px)">
              <IconEvaExternalLinkFill />
            </q-icon>
          </a>
          <span v-else class="text-primary-900">{{ place.name }}</span>
        </div>

        <!-- Subtitle: owner -->
        <div
          class="wd-place-title__subtitle text-caption text-grey-7"
          :class="{ invisible: !place.owner }"
        >
          <template v-if="place.owner">{{ place.owner.name }}</template>
          <span v-else>&ZeroWidthSpace;</span>
        </div>
      </div>
    </div>
  </q-no-ssr>
</template>

<style lang="scss" scoped>
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

.wd-place-title__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wd-place-title__weather :deep(.weather-select) {
  margin-left: 0;
}

.wd-place-title__weather :deep(.weather-select__mask) {
  transform: translateY(-2px);
}
</style>
