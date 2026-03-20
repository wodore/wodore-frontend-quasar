<script setup lang="ts">
import { computed } from 'vue';
import { useQuasar } from 'quasar';
import { usePlace } from '@composables/usePlace';
import WdWeatherSelect from '@components/huts/WdWeatherSelect.vue';
import track from '@services/analytics';

interface Props {
  slug?: string;
}

const props = defineProps<Props>();
const $q = useQuasar();

// Fetch place data for title
const { place } = usePlace(computed(() => props.slug));
</script>

<style lang="scss" scoped>
.hut-title-row {
  position: relative;
  display: block;
  padding-right: 52px;
}

.hut-title-text {
  display: inline-block;
  max-width: 100%;
  white-space: normal;
}

.hut-title-weather {
  position: absolute;
  right: -4px;
  top: 30%;
  transform: translateY(-50%);
}

.hut-toolbar-title {
  overflow: visible;
  padding-right: 6px;
}
</style>

<template>
  <q-no-ssr>
    <q-toolbar v-if="place" class="no-background" style="background-color: unset">
      <q-toolbar-title
        style="text-wrap: wrap; transform: translateY(4px); margin-left: 3px"
        class="text-primary-900 hut-toolbar-title"
      >
        <div
          class="text-h5 q-ma-none q-mt-xs hut-title-row"
          :class="[$q.screen.xs || $q.platform.is.mobile ? 'text-h6' : 'text-h5']"
        >
          <a
            v-if="place.url"
            :href="place.url"
            target="_blank"
            @click="track('hut link click')"
            class="hut-title-text"
          >
            {{ place.name }}
            <q-icon size="11pt" style="transform: translateY(-6px)">
              <IconEvaExternalLinkFill />
            </q-icon>
          </a>
          <span v-else class="hut-title-text">{{ place.name }}</span>
          <WdWeatherSelect
            v-if="place.location"
            class="hut-title-weather"
            :latitude="place.location.lat"
            :longitude="place.location.lon"
            :elevation="place.elevation ?? undefined"
          />
        </div>
      </q-toolbar-title>
    </q-toolbar>
  </q-no-ssr>
</template>
