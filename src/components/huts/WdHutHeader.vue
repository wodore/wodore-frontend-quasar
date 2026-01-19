<script setup lang="ts">
//import { ref } from 'vue';
import { schemasWodore } from '@clients/index';
import track from '@services/analytics';
import WdWeatherSelect from './WdWeatherSelect.vue';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | null;
  ontop?: boolean;
}

defineProps<Props>();
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
  <q-header
    class="no-background"
    :class="{ 'shadow-3': ontop }"
    style="transition: box-shadow 0.2s ease; background-color: unset"
  >
    <slot />
    <q-no-ssr>
      <q-toolbar class="" v-if="hut">
        <q-toolbar-title
          style="
            text-wrap: wrap;
            transform: translateY(4px);
            margin-left: 3px;
            background-color: unset;
          "
          class="text-primary-900 hut-toolbar-title"
        >
          <div
            class="text-h5 q-ma-none q-mt-xs hut-title-row"
            :class="[
              $q.screen.xs || $q.platform.is.mobile ? 'text-h6' : 'text-h5',
            ]"
          >
            <a
              v-if="hut.url"
              :href="hut.url"
              target="_blank"
              @click="track('hut link click')"
              class="hut-title-text"
              >{{ hut.name }}
              <q-icon size="11pt" style="transform: translateY(-6px)">
                <IconEvaExternalLinkFill />
              </q-icon>
            </a>
            <span v-else class="hut-title-text">{{ hut.name }}</span>
            <WdWeatherSelect
              v-if="hut.location"
              class="hut-title-weather"
              :latitude="hut.location.lat"
              :longitude="hut.location.lon"
              :elevation="hut.elevation ?? undefined"
            />
          </div>
        </q-toolbar-title>
      </q-toolbar>
    </q-no-ssr>
  </q-header>
</template>
