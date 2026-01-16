<script setup lang="ts">
import { computed } from 'vue';

interface Props {
  type: 'frontend' | 'backend';
  version?: string;
  hash?: string;
  loading?: boolean;
  error?: string | null;
}

const props = withDefaults(defineProps<Props>(), {
  version: '',
  hash: '',
  loading: false,
  error: null,
});

const shortHash = computed(() => (!props.hash ? '—' : props.hash.slice(0, 7)));
const iconName = computed(() => {
  if (props.error) return 'eva-alert-circle-outline';
  return props.type === 'frontend' ? 'wd-browser' : 'wd-server';
});
const tooltip = computed(() => {
  return props.type.charAt(0).toUpperCase() + props.type.slice(1);
});
const url = computed(() => {
  if (props.type === 'frontend') {
    return process.env.WODORE_FRONTEND_GITHUB
      ? process.env.WODORE_FRONTEND_GITHUB
      : undefined;
  } else if (props.type === 'backend') {
    return process.env.WODORE_BACKEND_GITHUB
      ? process.env.WODORE_BACKEND_GITHUB
      : undefined;
  }
  return undefined;
});
const appEnv = process.env.WODORE_ENV || 'production';
const isStaging = computed(() => appEnv === 'staging');
</script>

<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-tooltip
      self="center right"
      anchor="center right"
      :delay="1000"
      :offset="[-5, 0]"
    >
      {{ tooltip }}
    </q-tooltip>
    <q-icon :name="iconName" size="14px" color="grey-6" />
    <q-spinner v-if="loading" size="14px" color="grey-6" />
    <q-badge v-else-if="error" color="negative" text-color="white" dense rounded
      >Issue</q-badge
    >
    <span v-else class="text-caption text-grey-6">
      <span class="text-weight-medium">
        <a v-if="url" target="_blank" :href="`${url}/releases/tag/v${version}`"
          >v{{ version || '—' }}</a
        >
        <span v-else>v{{ version || '—' }}</span>
      </span>
      <span class="text-weight-light">
        (<a
          v-if="isStaging"
          target="_blank"
          :href="`${url}/commits/${shortHash}`"
          >{{ shortHash }}</a
        >
        <span v-else>{{ shortHash }}</span
        >)
      </span>
    </span>
  </div>
</template>
