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

const color = computed(() => {
  if (props.error) return 'negative';
  return props.type === 'frontend' ? 'grey-7' : 'grey-7';
});

const shortHash = computed(() => (!props.hash ? '—' : props.hash.slice(0, 7)));
const iconName = computed(() => {
  if (props.error) return 'eva-alert-circle-outline';
  return props.type === 'frontend' ? 'wd-browser' : 'wd-server';
});
</script>

<template>
  <div class="row items-center no-wrap q-gutter-xs">
    <q-icon :name="iconName" size="18px" :color="color" />
    <q-spinner v-if="loading" size="14px" color="grey-6" />
    <q-badge v-else-if="error" color="negative" text-color="white" dense rounded>Issue</q-badge>
    <span v-else class="text-caption text-grey-7">
      <b>v{{ version || '—' }}</b> ({{ shortHash }})
    </span>
  </div>
</template>

<style scoped></style>
