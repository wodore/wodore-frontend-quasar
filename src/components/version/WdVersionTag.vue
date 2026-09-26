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
    return process.env.WODORE_FRONTEND_GITHUB ? process.env.WODORE_FRONTEND_GITHUB : undefined;
  } else if (props.type === 'backend') {
    return process.env.WODORE_BACKEND_GITHUB ? process.env.WODORE_BACKEND_GITHUB : undefined;
  }
  return undefined;
});
const appEnv = process.env.WODORE_ENV || 'production';
// link the commit hash on staging AND preview (same as logged-in staging)
const isStaging = computed(() => appEnv === 'staging' || appEnv === 'preview');
</script>

<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-tooltip self="center right" anchor="center right" :delay="1000" :offset="[-5, 0]">
      {{ tooltip }}
    </q-tooltip>
    <q-icon :name="iconName" size="14px" class="wd-ink-soft-text" />
    <q-spinner v-if="loading" size="14px" class="wd-ink-soft-text" />
    <q-badge v-else-if="error" color="negative" text-color="white" dense rounded>{{
      $t('issue')
    }}</q-badge>
    <span v-else class="text-caption wd-ink-soft-text">
      <span class="text-weight-medium">
        <a v-if="url" target="_blank" :href="`${url}/releases/tag/v${version}`"
          >v{{ version || '—' }}</a
        >
        <span v-else>v{{ version || '—' }}</span>
      </span>
      <span class="text-weight-light">
        (<a v-if="isStaging" target="_blank" :href="`${url}/commit/${props.hash}`">{{
          shortHash
        }}</a>
        <span v-else>{{ shortHash }}</span
        >)
      </span>
    </span>
  </div>
</template>
