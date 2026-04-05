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
    <div v-if="place" class="wd-place-title row no-wrap items-center">
      <!-- Avatar (type icon) -->
      <div class="wd-place-title__avatar col-auto q-mr-sm">
        <q-icon
          v-if="place.type_open && place.type_open.symbol"
          :name="'img:' + place.type_open?.symbol.detailed"
          size="40px"
        />
      </div>

      <!-- Overline + Title -->
      <div class="wd-place-title__text col">
        <q-icon size="16px" class="text-accent-900">
          <IconMingcuteMountain2Fill />
        </q-icon>
        <span v-if="place.elevation" class="wd-place-title__owner text-caption text-accent-900">
          {{ place.elevation }}m |
        </span>
        <span v-if="place.owner" class="wd-place-title__owner text-caption text-accent-900">
          {{ place.owner?.name }}
        </span>
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
            <q-icon size="11pt" style="transform: translateY(-6px)">
              <IconEvaExternalLinkFill />
            </q-icon>
          </a>
          <span v-else class="text-primary-900">{{ place.name }}</span>
        </div>
      </div>

      <!-- Weather icon -->
      <!-- <div class="wd-place-title__weather col-auto"> -->
      <!--   <WdWeatherSelect v-if="place.location" :latitude="place.location.lat" :longitude="place.location.lon" -->
      <!--     :elevation="place.elevation ?? undefined" /> -->
      <!-- </div> -->
    </div>
  </q-no-ssr>
</template>

<style lang="scss" scoped>
.wd-place-title {
  padding: 4px 6px;
}

.wd-place-title__text {
  min-width: 0; // allow text truncation in flex layout
}

.wd-place-title__name {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-place-title__owner {
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.wd-place-title__avatar {
  display: flex;
  align-items: center;
  justify-content: center;
}

.wd-place-title__weather {
  display: flex;
  align-items: center;
  justify-content: center;
}
</style>
