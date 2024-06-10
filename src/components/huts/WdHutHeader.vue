<script setup lang="ts">
//import { ref } from 'vue';
import { schemasWodore } from '@clients/index';
import track from '@services/analytics';

interface Props {
  hut?: schemasWodore['HutSchemaDetails'] | null;
  ontop?: boolean;
}

defineProps<Props>();
</script>

<style lang="scss" scoped></style>

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
          class="text-primary-900"
        >
          <h1
            class="text-h5 q-ma-none q-mt-xs"
            :class="[
              $q.screen.xs || $q.platform.is.mobile ? 'text-h6' : 'text-h5',
            ]"
          >
            <a
              v-if="hut.url"
              :href="hut.url"
              target="_blank"
              @click="track('hut link click')"
              >{{ hut.name }}
              <q-icon size="11pt" style="transform: translateY(-6px)"
                ><IconEvaExternalLinkFill
              /></q-icon>
            </a>
            <span v-else>{{ hut.name }}</span>
          </h1>
        </q-toolbar-title>
      </q-toolbar>
    </q-no-ssr>
  </q-header>
</template>
